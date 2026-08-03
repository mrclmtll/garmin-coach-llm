"""HTTP-level smoke tests using FastAPI's TestClient.

Ollama and Garmin are not exercised here — only the wiring and error paths.
"""

from __future__ import annotations

import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db.close()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db.name}")
    # ensure settings pick up the override
    from app.config import settings as app_settings

    app_settings.database_url = f"sqlite:///{db.name}"

    from app.db import Base, engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    from app.main import app

    with TestClient(app) as c:
        yield c


def test_healthz(client: TestClient) -> None:
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_get_missing_workout_returns_404(client: TestClient) -> None:
    r = client.get("/workouts/999")
    assert r.status_code == 404


def test_get_garmin_workout_converts_raw_payload(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.routers import workouts as workouts_router

    raw = {
        "workoutName": "Easy Run",
        "sportType": {"sportTypeKey": "running"},
        "poolLength": None,
        "workoutSegments": [
            {
                "workoutSteps": [
                    {
                        "type": "ExecutableStepDTO",
                        "stepType": {"stepTypeKey": "interval"},
                        "endCondition": {"conditionTypeKey": "time"},
                        "endConditionValue": 600,
                        "targetType": {"workoutTargetTypeKey": "no.target"},
                        "description": "Steady",
                    }
                ]
            }
        ],
    }
    monkeypatch.setattr(workouts_router.garmin, "get_workout", lambda workout_id: raw)
    r = client.get("/workouts/garmin/12345")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Easy Run"
    assert body["sport"] == "running"
    assert body["body"][0]["label"] == "Steady"
    assert body["body"][0]["goal"] == {"kind": "time", "value": 600}


def test_get_garmin_workout_missing_creds_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.routers import workouts as workouts_router

    def _raise(workout_id: str) -> None:
        raise RuntimeError("GARMIN_EMAIL and GARMIN_PASSWORD must be set in the environment")

    monkeypatch.setattr(workouts_router.garmin, "get_workout", _raise)
    r = client.get("/workouts/garmin/12345")
    assert r.status_code == 503


def test_update_garmin_workout_calls_service_and_echoes_workout(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.routers import workouts as workouts_router

    calls: list[tuple[str, object]] = []
    monkeypatch.setattr(
        workouts_router.garmin,
        "update_workout",
        lambda workout_id, workout: calls.append((workout_id, workout)) or {},
    )
    payload = {
        "name": "Updated",
        "sport": "running",
        "body": [
            {
                "kind": "step",
                "label": "x",
                "goal": {"kind": "time", "value": 60},
                "target": {"kind": "hr_zone", "zone": 2},
                "role": "work",
                "sport": "running",
            }
        ],
    }
    r = client.put("/workouts/garmin/12345", json=payload)
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"
    assert len(calls) == 1
    assert calls[0][0] == "12345"


def test_from_text_returns_422_when_ollama_unreachable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Force the LLM service to raise a generation failure, regardless of
    # whether Ollama happens to be running on the test host. The endpoint
    # should translate that to a 422 with a useful detail message.
    from app.routers import workouts as workouts_router
    from app.services import llm

    def _raise(*, mode, user_text, sport=None):
        raise llm.WorkoutGenerationError("Ollama request failed: ConnectionError")

    monkeypatch.setattr(workouts_router.llm, "generate_workout", _raise)
    r = client.post("/workouts/from-text", json={"text": "easy 5k"})
    assert r.status_code == 422
    assert "detail" in r.json()


def test_generate_from_text_does_not_persist(monkeypatch: pytest.MonkeyPatch) -> None:
    """Generation only returns {workout} — nothing is written to the DB until
    the client explicitly calls POST /workouts (Save) or /workouts/{id}/push."""
    from app.schemas.workout import Workout

    fake_workout = Workout.model_validate(
        {
            "name": "Easy Run",
            "sport": "running",
            "body": [
                {
                    "kind": "step",
                    "label": "x",
                    "goal": {"kind": "time", "value": 600},
                    "target": {"kind": "hr_zone", "zone": 2},
                    "role": "work",
                    "sport": "running",
                }
            ],
        }
    )

    class FakeLLM:
        def generate_workout(self, *, mode, user_text, sport=None):
            return fake_workout

    from app.services import llm

    monkeypatch.setattr(llm, "generate_workout", FakeLLM().generate_workout)

    # also override the DB the client uses
    db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db.close()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db.name}")
    from app.config import settings as app_settings

    app_settings.database_url = f"sqlite:///{db.name}"
    from app.db import Base, engine

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    from app.main import app

    with TestClient(app) as c:
        r = c.post("/workouts/from-text", json={"text": "easy run"})
        assert r.status_code == 200
        body = r.json()
        assert "id" not in body
        assert body["workout"]["name"] == "Easy Run"
        assert c.get("/workouts").json() == []

        # Saving persists it and hands back an id for a subsequent push.
        r = c.post("/workouts", json={"workout": body["workout"], "source": "text"})
        assert r.status_code == 201
        saved = r.json()
        assert isinstance(saved["id"], int)
        assert saved["workout"]["name"] == "Easy Run"
        assert len(c.get("/workouts").json()) == 1
