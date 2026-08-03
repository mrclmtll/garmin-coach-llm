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
    from app.schemas.workout import DistanceGoal, HRZone, PaceRange, Sport, TimeGoal
    from app.services.garmin_format import _estimate_duration_seconds

    # 1000m at 4:00/km (240 sec/km => 0.24 sec/m => 240s)
    sec = _estimate_duration_seconds(
        DistanceGoal(value=1000),
        PaceRange(min_sec_per_km=240, max_sec_per_km=240),
        Sport.RUNNING,
    )
    assert sec == pytest.approx(240.0, rel=0.01)

    # time goal is passed through
    sec = _estimate_duration_seconds(TimeGoal(value=600), HRZone(zone=2), Sport.RUNNING)
    assert sec == 600.0


def test_every_goal_and_target_kind_converts_to_garmin_step() -> None:
    """Every Goal/Target variant must survive `to_garmin_workout` — this is
    the full Garmin Connect parity surface (Dauer x Intensitätsziel)."""
    from app.schemas.workout import (
        CadenceRange,
        CaloriesGoal,
        DistanceGoal,
        HeartRateGoal,
        HRCustom,
        HRZone,
        LapButtonGoal,
        NoTarget,
        PaceRange,
        PowerRange,
        PowerZone,
        Step,
        TimeGoal,
        Workout,
    )
    from app.services.garmin_format import to_garmin_workout

    goals = [
        TimeGoal(value=300),
        DistanceGoal(value=1000),
        LapButtonGoal(),
        CaloriesGoal(value=200),
        HeartRateGoal(value=160),
    ]
    targets = [
        PaceRange(min_sec_per_km=300, max_sec_per_km=270),
        PowerRange(min_watts=200, max_watts=250),
        PowerZone(zone=3),
        CadenceRange(min_cadence=170, max_cadence=180),
        HRZone(zone=2),
        HRCustom(min_bpm=140, max_bpm=160),
        NoTarget(),
    ]
    roles = ["warmup", "work", "recovery", "rest", "other", "cooldown"]

    body = [
        Step(label=f"g{gi}-t{ti}", goal=goal, target=target, role=roles[(gi + ti) % len(roles)], sport="running")
        for gi, goal in enumerate(goals)
        for ti, target in enumerate(targets)
    ]
    workout = Workout(name="parity-check", sport="running", body=body)

    garmin_workout = to_garmin_workout(workout)
    payload = garmin_workout.to_dict()
    steps = payload["workoutSegments"][0]["workoutSteps"]
    assert len(steps) == len(goals) * len(targets)
    for step, model_step in zip(steps, body, strict=True):
        assert step["description"] == model_step.label


def test_from_garmin_workout_round_trips_to_garmin_workout() -> None:
    """to_garmin_workout -> from_garmin_workout should reconstruct an
    equivalent Workout for every well-supported goal/target kind — the same
    parity surface as test_every_goal_and_target_kind_converts_to_garmin_step,
    but for loading a Garmin workout back into the editor.

    Body roles deliberately exclude warmup/cooldown: those are only
    reconstructed correctly at the workout's dedicated warmup/cooldown slots
    (Garmin's wire format has no field marking "this step is the dedicated
    warmup slot" vs. "this step's role happens to be warmup" — the position
    at the very start/end of the step list is the only signal, same
    heuristic Garmin Connect's own UI relies on)."""
    from app.schemas.workout import (
        CadenceRange,
        CaloriesGoal,
        DistanceGoal,
        HeartRateGoal,
        HRCustom,
        HRZone,
        LapButtonGoal,
        NoTarget,
        PaceRange,
        PowerRange,
        PowerZone,
        RepeatBlock,
        Step,
        TimeGoal,
        Workout,
    )
    from app.services.garmin_format import from_garmin_workout, to_garmin_workout

    goals = [
        TimeGoal(value=300),
        DistanceGoal(value=1000),
        LapButtonGoal(),
        CaloriesGoal(value=200),
        HeartRateGoal(value=160),
    ]
    targets = [
        PaceRange(min_sec_per_km=300, max_sec_per_km=270),
        PowerRange(min_watts=200, max_watts=250),
        PowerZone(zone=3),
        CadenceRange(min_cadence=170, max_cadence=180),
        HRZone(zone=2),
        HRCustom(min_bpm=140, max_bpm=160),
        NoTarget(),
    ]
    roles = ["work", "recovery", "rest", "other"]

    plain_steps = [
        Step(label=f"g{gi}-t{ti}", goal=goal, target=target, role=roles[(gi + ti) % len(roles)], sport="running")
        for gi, goal in enumerate(goals)
        for ti, target in enumerate(targets)
    ]
    warmup = Step(label="Warmup", goal=TimeGoal(value=600), target=HRZone(zone=1), role="warmup", sport="running")
    cooldown = Step(label="Cooldown", goal=TimeGoal(value=300), target=NoTarget(), role="cooldown", sport="running")
    repeat = RepeatBlock(count=4, steps=[plain_steps[0], plain_steps[1]])
    body = [repeat, *plain_steps[2:]]
    workout = Workout(name="round-trip-check", sport="running", warmup=warmup, body=body, cooldown=cooldown)

    raw = to_garmin_workout(workout).to_dict()
    reimported = from_garmin_workout(raw)

    assert reimported.name == workout.name
    assert reimported.sport == workout.sport
    assert reimported.warmup == workout.warmup
    assert reimported.cooldown == workout.cooldown
    assert len(reimported.body) == len(workout.body)

    reimported_repeat = reimported.body[0]
    assert isinstance(reimported_repeat, RepeatBlock)
    assert reimported_repeat.count == repeat.count
    for original, back in zip(repeat.steps, reimported_repeat.steps, strict=True):
        assert back.label == original.label
        assert back.goal == original.goal
        assert back.target == original.target

    for original, back in zip(body[1:], reimported.body[1:], strict=True):
        assert isinstance(back, Step)
        assert back.label == original.label
        assert back.goal == original.goal
        assert back.target == original.target
