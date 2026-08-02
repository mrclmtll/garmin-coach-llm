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


Goal = Annotated[
    TimeGoal | DistanceGoal | LapButtonGoal | CaloriesGoal | HeartRateGoal,
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


class NoTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["no_target"] = "no_target"


Target = Annotated[
    PaceRange | PowerRange | PowerZone | CadenceRange | HRZone | HRCustom | NoTarget,
    Field(discriminator="kind"),
]


class Step(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["step"] = "step"
    label: str
    goal: Goal
    target: Target
    role: StepRole
    sport: Sport


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


# Used by the LLM service to validate the model's JSON output.
workout_adapter: TypeAdapter[Workout] = TypeAdapter(Workout)


def dump_workout_json(workout: Workout) -> dict[str, Any]:
    """Stable JSON shape for storage (the schema's full dict, tags included)."""
    return workout.model_dump(mode="json")
