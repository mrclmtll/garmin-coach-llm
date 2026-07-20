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
    WARMUP = "warmup"
    WORK = "work"
    RECOVERY = "recovery"
    COOLDOWN = "cooldown"


class Goal(BaseModel):
    """Discriminated by `kind`: either time-based or distance-based."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["time", "distance"]
    # seconds when kind=time, meters when kind=distance
    value: float = Field(gt=0)


class PaceRange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["pace"] = "pace"
    # seconds per kilometer (running/swimming)
    min_sec_per_km: float = Field(gt=0)
    max_sec_per_km: float = Field(gt=0)


class PowerRange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["power"] = "power"
    min_watts: int = Field(gt=0)
    max_watts: int = Field(gt=0)


class HRZone(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["hr_zone"] = "hr_zone"
    # 1..5 (Garmin-style)
    zone: int = Field(ge=1, le=5)


Target = Annotated[PaceRange | PowerRange | HRZone, Field(discriminator="kind")]


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
