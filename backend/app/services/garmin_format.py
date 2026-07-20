"""Internal Workout -> garminconnect workout model.

This is the *only* place that knows about garminconnect types. If the package
breaks or gets swapped, only this file changes.

Conversion rules (Garmin's own structure, observed in round-tripped workouts):

- Goal.time  -> `endCondition: time`, `endConditionValue: seconds`
- Goal.distance -> `endCondition: distance`, `endConditionValue: meters`,
  with `preferredEndConditionUnit` set to kilometer. We translate the
  pace-target into the step duration estimate used by the rest of the app.
- Target.pace  -> targetType `{workoutTargetTypeId: 6, workoutTargetTypeKey:
  "pace.zone"}` and the bounds go on the step as `targetValueOne` /
  `targetValueTwo` in METERS PER SECOND (NOT seconds per km). Pace min is
  the *faster* bound, so it maps to the *larger* m/s.
- Target.power -> targetType `{workoutTargetTypeId: 2, ...}`. Power bounds
  go on the step as `targetValueOne` / `targetValueTwo` in watts.
- Target.hr_zone -> targetType `{workoutTargetTypeId: 4, ...}` with
  `zoneNumber` on the step.
- `displayOrder` is set on every nested dict (sportType, stepType,
  endCondition, targetType) to match Garmin's own format.
- Steps inside a RepeatGroup get `childStepId: 1`; outer steps get `None`.
- RepeatGroups get `skipLastRestStep: false` to match Garmin's default.
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
    create_repeat_group,
)

from app.logging_context import get_logger
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

log = get_logger(__name__)

# ---- sport id/key mapping (per garminconnect conventions) ---------------

_SPORT_META: dict[Sport, dict[str, int | str]] = {
    Sport.RUNNING: {"sportTypeId": 1, "sportTypeKey": "running", "displayOrder": 1},
    Sport.CYCLING: {"sportTypeId": 2, "sportTypeKey": "cycling", "displayOrder": 2},
    Sport.SWIMMING: {"sportTypeId": 5, "sportTypeKey": "swimming", "displayOrder": 3},
}

# Fallback pace (sec/km) or speed (km/h) when Goal.distance has no pace target.
_FALLBACK_PACE_SEC_PER_KM = 5 * 60  # 5:00/km
_FALLBACK_CYCLING_KMH = 30.0
_FALLBACK_SWIM_PACE_SEC_PER_KM = 2 * 60  # 2:00/km (= 1:12 / 100m)

# ---- target conversion ----------------------------------------------------

_PACE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 6,
    "workoutTargetTypeKey": "pace.zone",
    "displayOrder": 6,
}
_POWER_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 2,
    "workoutTargetTypeKey": "power.zone",
    "displayOrder": 2,
}
_HR_ZONE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 4,
    "workoutTargetTypeKey": "heart_rate.zone",
    "displayOrder": 4,
}


def _sec_per_km_to_mps(sec_per_km: float) -> float:
    return 1000.0 / sec_per_km


def _pace_bounds_mps(target: PaceRange) -> tuple[float, float]:
    # Garmin stores the faster bound as the *larger* m/s value. Faster pace
    # = smaller sec/km = larger m/s.
    max_mps = _sec_per_km_to_mps(target.min_sec_per_km)
    min_mps = _sec_per_km_to_mps(target.max_sec_per_km)
    return min_mps, max_mps


def _target_dict_and_values(
    target: PaceRange | PowerRange | HRZone,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (targetType dict, extra step fields for the actual values).

    For pace and power, the numeric bounds live on the step (as
    `targetValueOne` / `targetValueTwo`), not inside `targetType` — that is
    what Garmin's round-tripped workouts do, and the upload endpoint expects
    the same shape.
    """
    if isinstance(target, PaceRange):
        min_mps, max_mps = _pace_bounds_mps(target)
        return _PACE_TARGET, {
            "targetValueOne": max_mps,
            "targetValueTwo": min_mps,
        }
    if isinstance(target, PowerRange):
        return _POWER_TARGET, {
            "targetValueOne": float(target.min_watts),
            "targetValueTwo": float(target.max_watts),
        }
    return _HR_ZONE_TARGET, {"zoneNumber": int(target.zone)}


# ---- duration estimation --------------------------------------------------


def _default_speed_m_per_s(sport: Sport) -> float:
    """Default speed (m/s) when Goal.distance has no pace/power target."""
    if sport == Sport.CYCLING:
        return _FALLBACK_CYCLING_KMH * 1000 / 3600
    pace = _FALLBACK_PACE_SEC_PER_KM if sport == Sport.RUNNING else _FALLBACK_SWIM_PACE_SEC_PER_KM
    return 1000 / pace


def _estimate_duration_seconds(
    goal: Goal, target: PaceRange | PowerRange | HRZone, sport: Sport
) -> float:
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

# Garmin stepType keys + displayOrder (matches library + round-tripped output).
_STEP_TYPE: dict[StepRole, tuple[str, int]] = {
    StepRole.WARMUP: ("warmup", 1),
    StepRole.COOLDOWN: ("cooldown", 2),
    StepRole.WORK: ("interval", 3),
    StepRole.RECOVERY: ("recovery", 4),
}

_END_CONDITION_TIME: dict[str, Any] = {
    "conditionTypeId": 2,
    "conditionTypeKey": "time",
    "displayOrder": 2,
    "displayable": True,
}
_END_CONDITION_DISTANCE: dict[str, Any] = {
    "conditionTypeId": 3,
    "conditionTypeKey": "distance",
    "displayOrder": 3,
    "displayable": True,
}
_PREFERRED_UNIT_KM: dict[str, Any] = {
    "unitId": 2,
    "unitKey": "kilometer",
    "factor": 100000.0,
}


def _make_step(
    step: Step,
    step_order: int,
    *,
    child_step_id: int | None = None,
) -> ExecutableStep:
    """Build an ExecutableStep. The optional `child_step_id` is set to 1
    for steps nested inside a RepeatGroup, None for outer steps (matches
    Garmin's own round-tripped output)."""
    target_type, value_fields = _target_dict_and_values(step.target)

    if step.goal.kind == "time":
        end_condition = _END_CONDITION_TIME
        end_condition_value: float = float(step.goal.value)
        preferred_unit: dict[str, Any] | None = None
    else:  # distance in meters
        end_condition = _END_CONDITION_DISTANCE
        end_condition_value = float(step.goal.value)
        preferred_unit = _PREFERRED_UNIT_KM

    type_key, type_display_order = _STEP_TYPE[step.role]
    step_type = {
        "stepTypeId": {"warmup": 1, "cooldown": 2, "interval": 3, "recovery": 4}[type_key],
        "stepTypeKey": type_key,
        "displayOrder": type_display_order,
    }

    fields: dict[str, Any] = {
        "stepOrder": step_order,
        "stepType": step_type,
        "endCondition": end_condition,
        "endConditionValue": end_condition_value,
        "targetType": target_type,
        "childStepId": child_step_id,
    }
    if preferred_unit is not None:
        fields["preferredEndConditionUnit"] = preferred_unit
        fields["endConditionCompare"] = "gt"
    fields.update(value_fields)

    return ExecutableStep(**fields)


def _steps_to_executables(
    steps: list[Step], start_order: int
) -> list[ExecutableStep | RepeatGroup]:
    out: list[ExecutableStep | RepeatGroup] = []
    order = start_order
    for step in steps:
        out.append(_make_step(step, order, child_step_id=1))
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
            rg = create_repeat_group(item.count, inner, order)
            rg.skipLastRestStep = False
            rg.smartRepeat = False
            steps.append(rg)
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
        result: Any = RunningWorkout(**common)
    elif workout.sport == Sport.CYCLING:
        result = CyclingWorkout(**common)
    elif workout.sport == Sport.SWIMMING:
        result = SwimmingWorkout(**common)
    else:
        raise ValueError(f"unsupported sport: {workout.sport}")

    payload = result.to_dict()
    log.info(
        "garmin workout payload: name=%r sport=%s payload=%s",
        workout.name,
        workout.sport.value,
        _compact_json(payload),
    )
    return result


def _compact_json(payload: Any) -> str:
    """Render the workout payload as a single-line JSON string for logs."""
    import json

    return json.dumps(payload, separators=(",", ":"), default=str)
