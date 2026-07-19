"""Internal Workout -> garminconnect workout model.

This is the *only* place that knows about garminconnect types. If the package
breaks or gets swapped, only this file changes.

Conversion rules (approximate; Garmin's own structure):

- Goal.time  -> step duration in seconds
- Goal.distance -> duration is `value / estimated_pace_sec_per_m`. We use the
  target pace when present, else the role's default.
- Target.pace  -> `{ "workoutTargetTypeId": 6, "workoutTargetTypeKey": "pace.zone",
                     "absoluteValue": min_sec_per_km, "secondaryAbsoluteValue": max_sec_per_km }`
- Target.power -> `{ "workoutTargetTypeId": 2, ..., "absoluteValue": min, ...max }`
- Target.hr_zone -> `{ "workoutTargetTypeId": 1, "zoneNumber": zone }`
- Goal.distance with no pace target falls back to a reasonable default
  per sport (running 5:00/km, cycling 30 km/h, swimming 2:00/100m).
"""

from __future__ import annotations

from typing import Any

from garminconnect.workout import (
    CyclingWorkout,
    ExecutableStep,
    RepeatGroup,
    RunningWorkout,
    SwimmingWorkout,
    WorkoutSegment,
    create_cooldown_step,
    create_interval_step,
    create_recovery_step,
    create_repeat_group,
    create_warmup_step,
)

from app.schemas.workout import (
    Goal,
    HRZone,
    PaceRange,
    PowerRange,
    RepeatBlock,
    Sport,
    Step,
    StepRole,
    Workout,
)

# ---- sport id/key mapping (per garminconnect conventions) ---------------

_SPORT_META: dict[Sport, dict[str, int | str]] = {
    Sport.RUNNING: {"sportTypeId": 1, "sportTypeKey": "running"},
    Sport.CYCLING: {"sportTypeId": 2, "sportTypeKey": "cycling"},
    Sport.SWIMMING: {"sportTypeId": 5, "sportTypeKey": "swimming"},
}

# Fallback pace (sec/km) or speed (km/h) when Goal.distance has no pace target.
_FALLBACK_PACE_SEC_PER_KM = 5 * 60  # 5:00/km
_FALLBACK_CYCLING_KMH = 30.0
_FALLBACK_SWIM_PACE_SEC_PER_KM = 2 * 60  # 2:00/km (= 1:12 / 100m)

# ---- target conversion ----------------------------------------------------

_PACE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 6,
    "workoutTargetTypeKey": "pace.zone",
}
_POWER_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 2,
    "workoutTargetTypeKey": "power.zone",
}
_HR_ZONE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 1,
    "workoutTargetTypeKey": "heart_rate.zone",
}


def _target_dict(target: PaceRange | PowerRange | HRZone) -> dict[str, Any]:
    if isinstance(target, PaceRange):
        return {
            **_PACE_TARGET,
            "absoluteValue": target.min_sec_per_km,
            "secondaryAbsoluteValue": target.max_sec_per_km,
        }
    if isinstance(target, PowerRange):
        return {
            **_POWER_TARGET,
            "absoluteValue": target.min_watts,
            "secondaryAbsoluteValue": target.max_watts,
        }
    # HRZone
    return {**_HR_ZONE_TARGET, "zoneNumber": target.zone}


# ---- duration estimation --------------------------------------------------

def _default_speed_m_per_s(sport: Sport) -> float:
    """Default speed (m/s) when Goal.distance has no pace/power target."""
    if sport == Sport.CYCLING:
        return _FALLBACK_CYCLING_KMH * 1000 / 3600
    pace = _FALLBACK_PACE_SEC_PER_KM if sport == Sport.RUNNING else _FALLBACK_SWIM_PACE_SEC_PER_KM
    return 1000 / pace


def _estimate_duration_seconds(goal: Goal, target: PaceRange | PowerRange | HRZone, sport: Sport) -> float:
    if goal.kind == "time":
        return float(goal.value)
    # distance in meters
    if isinstance(target, PaceRange):
        # sec/km -> sec/m
        avg_sec_per_m = ((target.min_sec_per_km + target.max_sec_per_km) / 2) / 1000
        return float(goal.value) * avg_sec_per_m
    if isinstance(target, PowerRange):
        # We can't translate watts into a time from a distance. Garmin's API
        # would want a duration here; fall back to a sport-default speed.
        return float(goal.value) / _default_speed_m_per_s(sport)
    # HR zone — no pace info, use sport default.
    return float(goal.value) / _default_speed_m_per_s(sport)


# ---- step construction ----------------------------------------------------

def _make_step(step: Step, step_order: int) -> ExecutableStep:
    duration = _estimate_duration_seconds(step.goal, step.target, step.sport)
    target = _target_dict(step.target)
    if step.role == StepRole.WARMUP:
        return create_warmup_step(duration, step_order, target_type=target)
    if step.role == StepRole.COOLDOWN:
        return create_cooldown_step(duration, step_order, target_type=target)
    if step.role == StepRole.RECOVERY:
        return create_recovery_step(duration, step_order, target_type=target)
    return create_interval_step(duration, step_order, target_type=target)


def _steps_to_executables(steps: list[Step], start_order: int) -> list[ExecutableStep | RepeatGroup]:
    out: list[ExecutableStep | RepeatGroup] = []
    order = start_order
    for step in steps:
        out.append(_make_step(step, order))
        order += 1
    return out


# ---- segment assembly -----------------------------------------------------

def _build_segment(workout: Workout) -> WorkoutSegment:
    meta = _SPORT_META[workout.sport]
    steps: list[ExecutableStep | RepeatGroup] = []
    order = 1

    if workout.warmup is not None:
        steps.append(_make_step(workout.warmup, order))
        order += 1

    for item in workout.body:
        if isinstance(item, Step):
            steps.append(_make_step(item, order))
            order += 1
        else:  # RepeatBlock
            inner = _steps_to_executables(item.steps, 1)
            steps.append(create_repeat_group(item.count, inner, order))
            order += 1

    if workout.cooldown is not None:
        steps.append(_make_step(workout.cooldown, order))
        order += 1

    return WorkoutSegment(
        segmentOrder=1,
        sportType=meta,
        workoutSteps=steps,
    )


def _estimate_total_seconds(workout: Workout) -> int:
    """Rough estimate for `estimatedDurationInSecs`. Uses the same fallbacks as
    step duration estimation; only used by Garmin's UI for display."""

    def _step_seconds(step: Step) -> float:
        return _estimate_duration_seconds(step.goal, step.target, step.sport)

    def _block_seconds(block: RepeatBlock) -> float:
        return float(block.count) * sum(_step_seconds(s) for s in block.steps)

    total = 0.0
    if workout.warmup:
        total += _step_seconds(workout.warmup)
    for item in workout.body:
        if isinstance(item, Step):
            total += _step_seconds(item)
        else:
            total += _block_seconds(item)
    if workout.cooldown:
        total += _step_seconds(workout.cooldown)
    return int(total)


def to_garmin_workout(workout: Workout) -> Any:
    """Translate internal Workout -> garminconnect workout model."""
    duration = _estimate_total_seconds(workout)
    segment = _build_segment(workout)
    common = {
        "workoutName": workout.name,
        "estimatedDurationInSecs": duration,
        "workoutSegments": [segment],
    }
    if workout.sport == Sport.RUNNING:
        return RunningWorkout(**common)
    if workout.sport == Sport.CYCLING:
        return CyclingWorkout(**common)
    if workout.sport == Sport.SWIMMING:
        return SwimmingWorkout(**common)
    raise ValueError(f"unsupported sport: {workout.sport}")
