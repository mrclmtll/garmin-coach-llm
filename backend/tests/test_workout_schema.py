"""Smoke tests for the schema contract — round-trip + discriminator."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.workout import RepeatBlock, Step, Workout


def _step(label: str = "x", role: str = "work") -> dict:
    return {
        "kind": "step",
        "label": label,
        "goal": {"kind": "time", "value": 60},
        "target": {"kind": "hr_zone", "zone": 2},
        "role": role,
        "sport": "running",
    }


def test_workout_with_repeat_block_round_trip() -> None:
    raw = {
        "name": "Intervals",
        "sport": "running",
        "body": [
            {"kind": "repeat", "count": 4, "steps": [_step("800m"), _step("Recovery", "recovery")]}
        ],
    }
    w = Workout.model_validate(raw)
    assert isinstance(w.body[0], RepeatBlock)
    assert w.body[0].count == 4
    assert w.body[0].steps[0].label == "800m"

    # round-trip preserves discriminator and structure
    dump = w.model_dump(mode="json")
    assert dump["body"][0]["kind"] == "repeat"
    assert dump["body"][0]["steps"][0]["kind"] == "step"


def test_workout_with_plain_step_in_body() -> None:
    raw = {"name": "Tempo", "sport": "running", "body": [_step("Steady")]}
    w = Workout.model_validate(raw)
    assert isinstance(w.body[0], Step)
    assert w.body[0].label == "Steady"


def test_invalid_target_for_sport_is_rejected_by_schema() -> None:
    # power target on a running step is not schema-rejected (target kind is
    # independent of sport in the data model), but a bogus target kind is.
    bad = {
        "name": "x",
        "sport": "running",
        "body": [
            {
                "kind": "step",
                "label": "x",
                "goal": {"kind": "time", "value": 60},
                "target": {"kind": "watts_per_kg", "min": 1, "max": 2},
                "role": "work",
                "sport": "running",
            }
        ],
    }
    with pytest.raises(ValidationError):
        Workout.model_validate(bad)


def test_distance_goal_with_pace_target_estimates_duration() -> None:
    from app.schemas.workout import Goal, HRZone, PaceRange, Sport
    from app.services.garmin_format import _estimate_duration_seconds

    # 1000m at 4:00/km (240 sec/km => 0.24 sec/m => 240s)
    sec = _estimate_duration_seconds(
        Goal(kind="distance", value=1000),
        PaceRange(min_sec_per_km=240, max_sec_per_km=240),
        Sport.RUNNING,
    )
    assert sec == pytest.approx(240.0, rel=0.01)

    # time goal is passed through
    sec = _estimate_duration_seconds(Goal(kind="time", value=600), HRZone(zone=2), Sport.RUNNING)
    assert sec == 600.0
