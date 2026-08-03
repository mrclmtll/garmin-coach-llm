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
    CadenceRange,
    Goal,
    HRCustom,
    HRZone,
    NoTarget,
    PaceRange,
    PowerCurveInterval,
    PowerCurveTarget,
    PowerRange,
    PowerZone,
    RepeatBlock,
    SpeedRange,
    Sport,
    Step,
    StepRole,
    SwimCSSPace,
    SwimEffort,
    SwimEffortTarget,
    SwimEquipment,
    SwimPace,
    SwimStroke,
    Target,
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

# Swim stroke/equipment ids, confirmed by round-tripping candidate ids
# through Garmin Connect's own editor (see schemas/workout.py docstrings).
_STROKE_ID: dict[SwimStroke, int] = {
    SwimStroke.CHOICE: 1,
    SwimStroke.BACKSTROKE: 2,
    SwimStroke.BREASTSTROKE: 3,
    SwimStroke.BUTTERFLY: 5,
    SwimStroke.FREESTYLE: 6,
    SwimStroke.IM: 7,
    SwimStroke.VARIOUS: 8,
    SwimStroke.IM_LADDER: 9,
    SwimStroke.IM_REVERSE: 10,
}
_EFFORT_ID: dict[SwimEffort, int] = {
    SwimEffort.RECOVERY: 1,
    SwimEffort.EASY: 3,
    SwimEffort.MODERATE: 4,
    SwimEffort.HARD: 5,
    SwimEffort.VERY_HARD: 6,
    SwimEffort.MAXIMUM: 7,
    SwimEffort.ASCENDING: 9,
    SwimEffort.DESCENDING: 10,
}
_EQUIPMENT_ID: dict[SwimEquipment, int] = {
    SwimEquipment.FINS: 1,
    SwimEquipment.KICKBOARD: 2,
    SwimEquipment.PADDLES: 3,
    SwimEquipment.PULL_BUOY: 4,
    SwimEquipment.SNORKEL: 5,
}

# ---- target conversion ----------------------------------------------------

_NO_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 1,
    "workoutTargetTypeKey": "no.target",
    "displayOrder": 1,
}
_POWER_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 2,
    "workoutTargetTypeKey": "power.zone",
    "displayOrder": 2,
}
_CADENCE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 3,
    # Garmin's server normalizes this to "cadence" (not "cadence.zone")
    # regardless of what's sent — confirmed by reading back a real push.
    "workoutTargetTypeKey": "cadence",
    "displayOrder": 3,
}
# Same targetType for a predefined zone (zoneNumber) and a custom bpm range
# (targetValueOne/Two) — Garmin has one heart-rate targetType, not two. The
# key follows the dot-separated convention seen in real Garmin payloads
# ("pace.zone", "power.zone", "no.target"); a prior version of this constant
# used "heart_rate.zone" (underscore), which doesn't match that convention.
_HR_ZONE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 4,
    "workoutTargetTypeKey": "heart.rate.zone",
    "displayOrder": 4,
}
_PACE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 6,
    "workoutTargetTypeKey": "pace.zone",
    "displayOrder": 6,
}
# Cycling's speed target — id confirmed via garminconnect's own TargetType
# enum (SPEED_ZONE=5).
_SPEED_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 5,
    "workoutTargetTypeKey": "speed.zone",
    "displayOrder": 5,
}
# Confirmed against a workout created directly in Garmin Connect's own swim
# editor (CSS-based target pace, "-2s" offset).
_SWIM_CSS_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 17,
    "workoutTargetTypeKey": "swim.css.offset",
    "displayOrder": 17,
}
# Confirmed the same way (effort-based target pace, all 8 levels).
_SWIM_INSTRUCTION_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 18,
    "workoutTargetTypeKey": "swim.instruction",
    "displayOrder": 18,
}
# Confirmed against a workout created directly in Garmin Connect's own
# cycling editor (power curve, 20min/90% and 5s/10%). Unlike every other
# target, the actual values live in step-level `powerCurveDuration` /
# `powerCurveScale` fields, not targetValueOne/Two — `powerCurveRange` was
# 10 in both observed examples and isn't exposed as an editable field in
# the UI, so it's sent as a constant.
_POWER_CURVE_TARGET: dict[str, Any] = {
    "workoutTargetTypeId": 16,
    "workoutTargetTypeKey": "power.curve",
    "displayOrder": 16,
}
_POWER_CURVE_RANGE = 10
_POWER_CURVE_SECONDS: dict[PowerCurveInterval, int] = {
    PowerCurveInterval.SEC_5: 5,
    PowerCurveInterval.SEC_10: 10,
    PowerCurveInterval.SEC_20: 20,
    PowerCurveInterval.SEC_30: 30,
    PowerCurveInterval.MIN_1: 60,
    PowerCurveInterval.MIN_2: 120,
    PowerCurveInterval.MIN_5: 300,
    PowerCurveInterval.MIN_10: 600,
    PowerCurveInterval.MIN_20: 1200,
    PowerCurveInterval.MIN_30: 1800,
    PowerCurveInterval.HOUR_1: 3600,
}


def _sec_per_km_to_mps(sec_per_km: float) -> float:
    return 1000.0 / sec_per_km


def _pace_bounds_mps(target: PaceRange) -> tuple[float, float]:
    # Garmin stores the faster bound as the *larger* m/s value. Faster pace
    # = smaller sec/km = larger m/s.
    max_mps = _sec_per_km_to_mps(target.min_sec_per_km)
    min_mps = _sec_per_km_to_mps(target.max_sec_per_km)
    return min_mps, max_mps


def _target_dict_and_values(target: Target) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return (targetType dict, extra step fields for the actual values).

    For custom ranges (pace, power, cadence, custom HR), the numeric bounds
    live on the step (as `targetValueOne` / `targetValueTwo`), not inside
    `targetType` — that is what Garmin's round-tripped workouts do, and the
    upload endpoint expects the same shape. Predefined zones (HR zone, power
    zone) use the same targetType as their custom counterpart but set
    `zoneNumber` instead.
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
    if isinstance(target, PowerZone):
        return _POWER_TARGET, {"zoneNumber": int(target.zone)}
    if isinstance(target, CadenceRange):
        return _CADENCE_TARGET, {
            "targetValueOne": float(target.min_cadence),
            "targetValueTwo": float(target.max_cadence),
        }
    if isinstance(target, HRZone):
        return _HR_ZONE_TARGET, {"zoneNumber": int(target.zone)}
    if isinstance(target, HRCustom):
        return _HR_ZONE_TARGET, {
            "targetValueOne": float(target.min_bpm),
            "targetValueTwo": float(target.max_bpm),
        }
    if isinstance(target, SwimPace):
        # Swim intensity targets are structurally different: the *primary*
        # targetType stays "no.target", and the real target (pace.zone here)
        # goes in the *secondary* slot as a single value (not a range) —
        # confirmed against a workout created directly in Garmin Connect's
        # own swim editor.
        return _NO_TARGET, {
            "secondaryTargetType": _PACE_TARGET,
            "secondaryTargetValueOne": 100.0 / target.sec_per_100m,
            "secondaryTargetValueTwo": 0.0,
        }
    if isinstance(target, SwimCSSPace):
        return _NO_TARGET, {
            "secondaryTargetType": _SWIM_CSS_TARGET,
            "secondaryTargetValueOne": float(target.offset_seconds),
            "secondaryTargetValueTwo": 0.0,
        }
    if isinstance(target, SwimEffortTarget):
        return _NO_TARGET, {
            "secondaryTargetType": _SWIM_INSTRUCTION_TARGET,
            "secondaryTargetValueOne": float(_EFFORT_ID[target.level]),
            "secondaryTargetValueTwo": 0.0,
        }
    if isinstance(target, SpeedRange):
        # Unlike pace, higher speed = faster, so no min/max inversion.
        return _SPEED_TARGET, {
            "targetValueOne": target.min_kmh * 1000 / 3600,
            "targetValueTwo": target.max_kmh * 1000 / 3600,
        }
    if isinstance(target, PowerCurveTarget):
        return _POWER_CURVE_TARGET, {
            "powerCurveDuration": _POWER_CURVE_SECONDS[target.interval],
            "powerCurveScale": target.percent,
            "powerCurveRange": _POWER_CURVE_RANGE,
        }
    assert isinstance(target, NoTarget)
    return _NO_TARGET, {}


def _secondary_target_fields(target: Target) -> dict[str, Any]:
    """Same conversion as the primary target, but renamed onto Garmin's
    "secondary" slot — confirmed for swim (which always sends this on the
    secondary slot) and extended here for cycling's optional second target
    (e.g. power zone + cadence stacked on one step)."""
    if isinstance(target, PowerCurveTarget):
        # Only ever observed as a *primary* target — there's no confirmed
        # "secondary" shape for powerCurveDuration/Scale/Range, so fail
        # loudly instead of guessing and silently sending something wrong.
        raise ValueError("power curve is not supported as a secondary target")
    type_dict, values = _target_dict_and_values(target)
    out: dict[str, Any] = {"secondaryTargetType": type_dict}
    if "targetValueOne" in values:
        out["secondaryTargetValueOne"] = values["targetValueOne"]
    if "targetValueTwo" in values:
        out["secondaryTargetValueTwo"] = values["targetValueTwo"]
    if "zoneNumber" in values:
        out["secondaryZoneNumber"] = values["zoneNumber"]
    return out


# ---- duration estimation --------------------------------------------------


def _default_speed_m_per_s(sport: Sport) -> float:
    """Default speed (m/s) when Goal.distance has no pace/power target."""
    if sport == Sport.CYCLING:
        return _FALLBACK_CYCLING_KMH * 1000 / 3600
    pace = _FALLBACK_PACE_SEC_PER_KM if sport == Sport.RUNNING else _FALLBACK_SWIM_PACE_SEC_PER_KM
    return 1000 / pace


# Flat guess for goals with no time/distance value to derive a duration from
# (lap-button, calories, heart-rate-threshold end conditions). Only feeds
# `estimatedDurationInSecs`, which Garmin's UI uses for display — not
# behavior — so a rough number is fine.
_FALLBACK_OPEN_ENDED_SECONDS = 300.0


def _estimate_duration_seconds(goal: Goal, target: Target, sport: Sport) -> float:
    if goal.kind == "time":
        return float(goal.value)
    if goal.kind in ("lap_button", "calories", "heart_rate", "power"):
        return _FALLBACK_OPEN_ENDED_SECONDS
    # distance in meters
    if isinstance(target, PaceRange):
        # sec/km -> sec/m
        avg_sec_per_m = ((target.min_sec_per_km + target.max_sec_per_km) / 2) / 1000
        return float(goal.value) * avg_sec_per_m
    if isinstance(target, SwimPace):
        return float(goal.value) * (target.sec_per_100m / 100.0)
    # No pace info to translate distance into time (power, cadence, HR
    # targets, or no target at all) — fall back to a sport-default speed.
    return float(goal.value) / _default_speed_m_per_s(sport)


# ---- step construction ----------------------------------------------------

# Garmin stepType id + key (matches garminconnect.workout.StepType + the
# round-tripped output above). displayOrder always matches the id in every
# observed Garmin payload, so the id doubles as displayOrder below.
_STEP_TYPE: dict[StepRole, tuple[str, int]] = {
    StepRole.WARMUP: ("warmup", 1),
    StepRole.COOLDOWN: ("cooldown", 2),
    StepRole.WORK: ("interval", 3),
    StepRole.RECOVERY: ("recovery", 4),
    StepRole.REST: ("rest", 5),
    StepRole.OTHER: ("other", 7),
}

_END_CONDITION_LAP_BUTTON: dict[str, Any] = {
    "conditionTypeId": 1,
    "conditionTypeKey": "lap.button",
    "displayOrder": 1,
    "displayable": True,
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
_END_CONDITION_CALORIES: dict[str, Any] = {
    "conditionTypeId": 4,
    "conditionTypeKey": "calories",
    "displayOrder": 4,
    "displayable": True,
}
_END_CONDITION_HEART_RATE: dict[str, Any] = {
    "conditionTypeId": 6,
    "conditionTypeKey": "heart.rate",
    "displayOrder": 6,
    "displayable": True,
}
_END_CONDITION_POWER: dict[str, Any] = {
    "conditionTypeId": 5,
    "conditionTypeKey": "power",
    "displayOrder": 5,
    "displayable": True,
}
_PREFERRED_UNIT_KM: dict[str, Any] = {
    "unitId": 2,
    "unitKey": "kilometer",
    "factor": 100000.0,
}
# Swim distances are entered/displayed in meters (pool lengths), not
# kilometers — confirmed by the real Garmin-authored showcase workout.
_PREFERRED_UNIT_METER: dict[str, Any] = {
    "unitId": 1,
    "unitKey": "meter",
    "factor": 100.0,
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

    end_condition_value: float | None
    preferred_unit: dict[str, Any] | None = None
    if step.goal.kind == "time":
        end_condition = _END_CONDITION_TIME
        end_condition_value = float(step.goal.value)
    elif step.goal.kind == "distance":
        end_condition = _END_CONDITION_DISTANCE
        end_condition_value = float(step.goal.value)
        preferred_unit = _PREFERRED_UNIT_METER if step.sport == Sport.SWIMMING else _PREFERRED_UNIT_KM
    elif step.goal.kind == "lap_button":
        end_condition = _END_CONDITION_LAP_BUTTON
        end_condition_value = None
    elif step.goal.kind == "calories":
        end_condition = _END_CONDITION_CALORIES
        end_condition_value = float(step.goal.value)
    elif step.goal.kind == "heart_rate":
        end_condition = _END_CONDITION_HEART_RATE
        end_condition_value = float(step.goal.value)
    else:  # power
        end_condition = _END_CONDITION_POWER
        end_condition_value = float(step.goal.value)

    type_key, type_id = _STEP_TYPE[step.role]
    step_type = {"stepTypeId": type_id, "stepTypeKey": type_key, "displayOrder": type_id}

    fields: dict[str, Any] = {
        "stepOrder": step_order,
        "stepType": step_type,
        "endCondition": end_condition,
        "endConditionValue": end_condition_value,
        "targetType": target_type,
        "childStepId": child_step_id,
        "description": step.label or None,
    }
    if preferred_unit is not None:
        fields["preferredEndConditionUnit"] = preferred_unit
        fields["endConditionCompare"] = "gt"
    if step.stroke is not None:
        stroke_id = _STROKE_ID[step.stroke]
        fields["strokeType"] = {"strokeTypeId": stroke_id, "displayOrder": stroke_id}
    if step.equipment is not None:
        equip_id = _EQUIPMENT_ID[step.equipment]
        fields["equipmentType"] = {"equipmentTypeId": equip_id, "displayOrder": equip_id}
    fields.update(value_fields)
    if step.secondary_target is not None:
        # Cycling can stack a second target (e.g. power zone + cadence) onto
        # one step. Swim targets already route themselves onto this same
        # slot (see _target_dict_and_values) and never set secondary_target
        # themselves, so there's no collision in practice.
        fields.update(_secondary_target_fields(step.secondary_target))

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
        result = SwimmingWorkout(
            **common,
            poolLength=workout.pool_length_m,
            poolLengthUnit=_PREFERRED_UNIT_METER,
        )
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
