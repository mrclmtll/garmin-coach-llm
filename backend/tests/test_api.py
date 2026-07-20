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


def test_from_text_returns_422_when_ollama_unreachable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Force the LLM service to raise a generation failure, regardless of
    # whether Ollama happens to be running on the test host. The endpoint
    # should translate that to a 422 with a useful detail message.
    from app.routers import workouts as workouts_router
    from app.services import llm

    def _raise(*, mode, user_text):
        raise llm.WorkoutGenerationError("Ollama request failed: ConnectionError")

    monkeypatch.setattr(workouts_router.llm, "generate_workout", _raise)
    r = client.post("/workouts/from-text", json={"text": "easy 5k"})
    assert r.status_code == 422
    assert "detail" in r.json()


def test_create_response_shape_includes_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sanity check: the create endpoint returns {id, workout}, not just the workout.
    The client relies on `id` to push without a second roundtrip."""
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
        def generate_workout(self, *, mode, user_text):
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
        assert r.status_code == 201
        body = r.json()
        assert "id" in body and isinstance(body["id"], int)
        assert body["workout"]["name"] == "Easy Run"
