"""Internal Workout model.

Pydantic is the source of truth. SQLAlchemy exists to persist the JSON shape.
Garmin-specific types are intentionally absent here — that conversion lives in
`app/services/garmin_format.py`.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter


class Sport(StrEnum):
    RUNNING = "running"
    CYCLING = "cycling"
    SWIMMING = "swimming"


class StepRole(StrEnum):
    """Garmin "Abschnittstyp". Each value is a genuinely distinct Garmin
    stepType id (warmup=1, cooldown=2, interval=3, recovery=4, rest=5,
    other=7). Confirmed via Garmin Connect's own editor (round-tripped
    through the API): "Gehen" (walk) has no separate step type — it saves
    as stepTypeId 3 ("interval"), identical to "Laufen" (run). Use WORK for
    both; distinguish them with the step's label, not a separate role."""

    WARMUP = "warmup"
    WORK = "work"
    RECOVERY = "recovery"
    REST = "rest"
    OTHER = "other"
    COOLDOWN = "cooldown"


class TimeGoal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["time"] = "time"
    value: float = Field(gt=0)  # seconds


class DistanceGoal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["distance"] = "distance"
    value: float = Field(gt=0)  # meters


class LapButtonGoal(BaseModel):
    """Open-ended: the step ends when the athlete presses the lap button."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["lap_button"] = "lap_button"


class CaloriesGoal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["calories"] = "calories"
    value: int = Field(gt=0)  # kcal


class HeartRateGoal(BaseModel):
    """The step ends once heart rate reaches this value (bpm)."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["heart_rate"] = "heart_rate"
    value: int = Field(gt=0, le=250)  # bpm


class PowerGoal(BaseModel):
    """Cycling only — the step ends once power reaches this value (watts)."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["power"] = "power"
    value: int = Field(gt=0)  # watts


Goal = Annotated[
    TimeGoal | DistanceGoal | LapButtonGoal | CaloriesGoal | HeartRateGoal | PowerGoal,
    Field(discriminator="kind"),
]


class PaceRange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["pace"] = "pace"
    # seconds per kilometer (running/swimming)
    min_sec_per_km: float = Field(gt=0)
    max_sec_per_km: float = Field(gt=0)


class PowerRange(BaseModel):
    """Custom power target — an exact watt range you set yourself."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["power"] = "power"
    min_watts: int = Field(gt=0)
    max_watts: int = Field(gt=0)


class PowerZone(BaseModel):
    """Predefined power zone (Garmin cycling power zones, 1..7)."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["power_zone"] = "power_zone"
    zone: int = Field(ge=1, le=7)


class CadenceRange(BaseModel):
    """Steps/min (running) or rpm (cycling) — unit follows the step's sport."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["cadence"] = "cadence"
    min_cadence: int = Field(gt=0)
    max_cadence: int = Field(gt=0)


class HRZone(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["hr_zone"] = "hr_zone"
    # 1..5 (Garmin-style)
    zone: int = Field(ge=1, le=5)


class HRCustom(BaseModel):
    """Custom heart-rate target — an exact bpm range you set yourself."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["hr_custom"] = "hr_custom"
    min_bpm: int = Field(gt=0, le=250)
    max_bpm: int = Field(gt=0, le=250)


class SpeedRange(BaseModel):
    """Cycling's speed target — a min/max range in km/h. Unlike pace, higher
    is faster, so min/max follow plain ascending order (no inversion)."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["speed"] = "speed"
    min_kmh: float = Field(gt=0)
    max_kmh: float = Field(gt=0)


class NoTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["no_target"] = "no_target"


class SwimPace(BaseModel):
    """Swimming's own pace target: a single value (not a min/max range), in
    seconds per 100m — confirmed against Garmin Connect's own swim editor,
    which shows e.g. "2:00/100m" rather than a range."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["swim_pace"] = "swim_pace"
    sec_per_100m: float = Field(gt=0)


class SwimCSSPace(BaseModel):
    """Swimming's CSS-based pace target: an offset in seconds from the
    athlete's Critical Swim Speed (e.g. "-2s"), confirmed against a workout
    created directly in Garmin Connect's own editor."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["swim_css_pace"] = "swim_css_pace"
    offset_seconds: float  # can be negative, zero, or positive


class SwimEffort(StrEnum):
    """Garmin's "Anstrengungsbasiert" (effort-based) swim target levels.
    Ids confirmed by round-tripping all 8 through Garmin Connect's own
    editor — ids 2 and 8 don't correspond to any of the 8 UI options and are
    deliberately left out."""

    RECOVERY = "recovery"  # 1
    EASY = "easy"  # 3
    MODERATE = "moderate"  # 4
    HARD = "hard"  # 5
    VERY_HARD = "very_hard"  # 6
    MAXIMUM = "maximum"  # 7
    ASCENDING = "ascending"  # 9
    DESCENDING = "descending"  # 10


class SwimEffortTarget(BaseModel):
    """Swimming's effort-based target: a named exertion level rather than a
    pace number."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["swim_effort"] = "swim_effort"
    level: SwimEffort


class PowerCurveInterval(StrEnum):
    """Garmin's fixed set of power-curve interval durations — the same 11
    options as the "Leistungskurveninterval" dropdown."""

    SEC_5 = "5s"
    SEC_10 = "10s"
    SEC_20 = "20s"
    SEC_30 = "30s"
    MIN_1 = "1min"
    MIN_2 = "2min"
    MIN_5 = "5min"
    MIN_10 = "10min"
    MIN_20 = "20min"
    MIN_30 = "30min"
    HOUR_1 = "1hour"


class PowerCurveTarget(BaseModel):
    """Cycling's power curve target: ride at a percentage of the athlete's
    best-ever average power for the chosen interval duration (Garmin's
    personal power profile). Confirmed against a workout created directly
    in Garmin Connect's own editor."""

    model_config = ConfigDict(extra="forbid")
    kind: Literal["power_curve"] = "power_curve"
    interval: PowerCurveInterval
    percent: float = Field(gt=0)  # free-text "Ziel (% des Intervalls)"


Target = Annotated[
    PaceRange
    | PowerRange
    | PowerZone
    | CadenceRange
    | HRZone
    | HRCustom
    | NoTarget
    | SwimPace
    | SwimCSSPace
    | SwimEffortTarget
    | SpeedRange
    | PowerCurveTarget,
    Field(discriminator="kind"),
]


class SwimStroke(StrEnum):
    """Garmin's swim stroke ids, confirmed by round-tripping through Garmin
    Connect's own editor. Id 4 renders as an unlabeled "Wahl + Übung" — not
    one of the 9 real stroke choices — so it's deliberately left out."""

    CHOICE = "choice"  # 1 ("Wahl")
    BACKSTROKE = "backstroke"  # 2
    BREASTSTROKE = "breaststroke"  # 3
    BUTTERFLY = "butterfly"  # 5
    FREESTYLE = "freestyle"  # 6 ("Kraul")
    IM = "im"  # 7 ("Lagen")
    VARIOUS = "various"  # 8 ("Verschieden")
    IM_LADDER = "im_ladder"  # 9 ("Lagen nach Runden")
    IM_REVERSE = "im_reverse"  # 10 ("Lagen mit umgekehrter Reihenfolge")


class SwimEquipment(StrEnum):
    """Garmin's swim equipment ids, confirmed the same way as SwimStroke."""

    FINS = "fins"  # 1
    KICKBOARD = "kickboard"  # 2
    PADDLES = "paddles"  # 3
    PULL_BUOY = "pull_buoy"  # 4
    SNORKEL = "snorkel"  # 5


class Step(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["step"] = "step"
    label: str
    goal: Goal
    target: Target
    role: StepRole
    sport: Sport
    # Swimming only — None means "no stroke" / "no equipment" specified.
    stroke: SwimStroke | None = None
    equipment: SwimEquipment | None = None
    # Cycling only — Garmin Connect lets you stack a second target (e.g.
    # power zone + cadence) alongside the primary one. None means unset.
    secondary_target: Target | None = None


class RepeatBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["repeat"] = "repeat"
    count: int = Field(ge=1, le=50)
    steps: list[Step] = Field(min_length=1)


BodyItem = Annotated[Step | RepeatBlock, Field(discriminator="kind")]


class Workout(BaseModel):
    """Canonical internal workout. Everything in the system that *creates* a
    workout produces this; everything that *sends* a workout to a device
    consumes this."""

    model_config = ConfigDict(extra="forbid")

    name: str
    sport: Sport
    warmup: Step | None = None
    body: list[BodyItem] = Field(default_factory=list)
    cooldown: Step | None = None
    # Swimming only — Garmin requires a pool length on every swim workout.
    pool_length_m: float = Field(default=25.0, gt=0)


# Used by the LLM service to validate the model's JSON output.
workout_adapter: TypeAdapter[Workout] = TypeAdapter(Workout)


def dump_workout_json(workout: Workout) -> dict[str, Any]:
    """Stable JSON shape for storage (the schema's full dict, tags included)."""
    return workout.model_dump(mode="json")
