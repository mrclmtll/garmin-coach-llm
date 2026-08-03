"""Workout HTTP endpoints.

Both creation paths (free-text, template) hit the LLM service and return the
same `Workout` shape. Edits and push are also exposed here.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.logging_context import get_logger
from app.models.workout import WorkoutRow
from app.schemas.workout import Workout
from app.services import garmin, garmin_format, llm

log = get_logger(__name__)

router = APIRouter(prefix="/workouts", tags=["workouts"])


class FromTextRequest(BaseModel):
    text: str = Field(min_length=1)
    sport: str | None = None  # optional hint to the LLM


class FromTemplateRequest(BaseModel):
    text: str = Field(min_length=1)
    sport: str | None = None


class GeneratedWorkout(BaseModel):
    """Returned by the LLM generation endpoints. Not yet persisted."""

    workout: Workout


class SaveWorkoutRequest(BaseModel):
    workout: Workout
    source: str = "manual"


class CreatedWorkout(BaseModel):
    """Returned once a workout is persisted so the client can push without a second roundtrip."""

    id: int
    workout: Workout


class PushRequest(BaseModel):
    # None = upload to Garmin Connect only; set to also queue the workout to
    # that specific device (see GET /workouts/devices for valid ids).
    device_id: str | None = None


class PushResponse(BaseModel):
    workout_id: int
    garmin_workout_id: str | None
    queued_to_device: bool
    raw: dict


class GarminDeviceSummary(BaseModel):
    id: str
    name: str
    is_primary: bool


class WorkoutSummary(BaseModel):
    """Lightweight row for the saved-workouts list — no full payload."""

    id: int
    name: str
    sport: str
    source: str
    created_at: datetime
    pushed_at: datetime | None
    garmin_workout_id: str | None


class GarminWorkoutSummary(BaseModel):
    """Lightweight row for a workout that lives in the Garmin workout library."""

    id: str
    name: str
    sport: str | None
    created_at: str | None
    updated_at: str | None


def _map_garmin_workout(raw: dict) -> GarminWorkoutSummary:
    sport_type = raw.get("sportType") or {}
    return GarminWorkoutSummary(
        id=str(raw.get("workoutId")),
        name=raw.get("workoutName") or "Untitled",
        sport=sport_type.get("sportTypeKey"),
        created_at=raw.get("createdDate"),
        updated_at=raw.get("updatedDate"),
    )


def _row_to_workout(row: WorkoutRow) -> Workout:
    return Workout.model_validate(row.payload)


def _persist(db: Session, workout: Workout, source: str) -> WorkoutRow:
    row = WorkoutRow(
        name=workout.name,
        sport=workout.sport.value,
        source=source,
        payload=workout.model_dump(mode="json"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/from-text", response_model=GeneratedWorkout)
def create_from_text(req: FromTextRequest) -> GeneratedWorkout:
    try:
        workout = llm.generate_workout(mode="free_text", user_text=req.text, sport=req.sport)
    except llm.WorkoutGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return GeneratedWorkout(workout=workout)


@router.post("/from-template", response_model=GeneratedWorkout)
def create_from_template(req: FromTemplateRequest) -> GeneratedWorkout:
    try:
        workout = llm.generate_workout(mode="template", user_text=req.text, sport=req.sport)
    except llm.WorkoutGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return GeneratedWorkout(workout=workout)


@router.post("", response_model=CreatedWorkout, status_code=status.HTTP_201_CREATED)
def create_workout(
    req: SaveWorkoutRequest, db: Annotated[Session, Depends(get_db)]
) -> CreatedWorkout:
    row = _persist(db, req.workout, source=req.source)
    return CreatedWorkout(id=row.id, workout=req.workout)


@router.get("", response_model=list[WorkoutSummary])
def list_workouts(db: Annotated[Session, Depends(get_db)]) -> list[WorkoutSummary]:
    rows = db.execute(select(WorkoutRow).order_by(WorkoutRow.created_at.desc())).scalars().all()
    return [
        WorkoutSummary(
            id=r.id,
            name=r.name,
            sport=r.sport,
            source=r.source,
            created_at=r.created_at,
            pushed_at=r.pushed_at,
            garmin_workout_id=r.garmin_workout_id,
        )
        for r in rows
    ]


@router.get("/garmin", response_model=list[GarminWorkoutSummary])
def list_garmin_workouts() -> list[GarminWorkoutSummary]:
    try:
        raw = garmin.list_workouts()
    except RuntimeError as e:
        # Missing creds etc.
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # garminconnect raises a variety of types
        raise HTTPException(status_code=502, detail=f"garmin fetch failed: {e}") from e
    return [_map_garmin_workout(w) for w in raw]


@router.get("/garmin/{garmin_workout_id}", response_model=Workout)
def get_garmin_workout(garmin_workout_id: str) -> Workout:
    try:
        raw = garmin.get_workout(garmin_workout_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # garminconnect raises a variety of types
        raise HTTPException(status_code=502, detail=f"garmin fetch failed: {e}") from e
    try:
        return garmin_format.from_garmin_workout(raw)
    except Exception as e:
        raise HTTPException(
            status_code=422, detail=f"could not import Garmin workout: {e}"
        ) from e


@router.put("/garmin/{garmin_workout_id}", response_model=Workout)
def update_garmin_workout(garmin_workout_id: str, workout: Workout) -> Workout:
    """Replace an existing Garmin workout in place with the edited version —
    the Garmin-side counterpart to `PATCH /workouts/{workout_id}`."""
    try:
        garmin.update_workout(garmin_workout_id, workout)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # garminconnect raises a variety of types
        raise HTTPException(status_code=502, detail=f"garmin update failed: {e}") from e
    return workout


@router.get("/devices", response_model=list[GarminDeviceSummary])
def list_garmin_devices() -> list[GarminDeviceSummary]:
    try:
        devices = garmin.list_devices()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # garminconnect raises a variety of types
        raise HTTPException(status_code=502, detail=f"garmin device fetch failed: {e}") from e
    return [GarminDeviceSummary(**d) for d in devices]


@router.get("/{workout_id}", response_model=Workout)
def get_workout(workout_id: int, db: Annotated[Session, Depends(get_db)]) -> Workout:
    row = db.get(WorkoutRow, workout_id)
    if row is None:
        raise HTTPException(status_code=404, detail="workout not found")
    return _row_to_workout(row)


@router.patch("/{workout_id}", response_model=Workout)
def update_workout(
    workout_id: int,
    workout: Workout,
    db: Annotated[Session, Depends(get_db)],
) -> Workout:
    row = db.get(WorkoutRow, workout_id)
    if row is None:
        raise HTTPException(status_code=404, detail="workout not found")
    row.name = workout.name
    row.sport = workout.sport.value
    row.payload = workout.model_dump(mode="json")
    # The saved content no longer matches whatever was last pushed (if
    # anything) — clear the push markers so the "pushed" badge doesn't lie
    # about this row being in sync with Garmin until it's pushed again.
    row.pushed_at = None
    row.garmin_workout_id = None
    db.commit()
    db.refresh(row)
    return _row_to_workout(row)


@router.post("/{workout_id}/push", response_model=PushResponse)
def push_workout(
    workout_id: int,
    db: Annotated[Session, Depends(get_db)],
    req: PushRequest | None = None,
) -> PushResponse:
    row = db.get(WorkoutRow, workout_id)
    if row is None:
        raise HTTPException(status_code=404, detail="workout not found")

    workout = _row_to_workout(row)
    try:
        result = garmin.push_workout(workout)
    except RuntimeError as e:
        # Missing creds etc.
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:  # garminconnect raises a variety of types
        raise HTTPException(status_code=502, detail=f"garmin push failed: {e}") from e

    garmin_id = None
    if isinstance(result, dict):
        # garminconnect typically returns the workout JSON with a `workoutId`.
        garmin_id = str(result.get("workoutId")) if result.get("workoutId") is not None else None

    row.pushed_at = datetime.now(UTC)
    row.garmin_workout_id = garmin_id
    db.commit()

    device_id = req.device_id if req else None
    queued_to_device = False
    if garmin_id is not None and device_id is not None:
        try:
            garmin.send_workout_to_device(garmin_workout_id=garmin_id, device_id=device_id)
            queued_to_device = True
        except Exception as e:
            # The upload to Garmin Connect already succeeded and is committed
            # above; only the explicit device queue step failed.
            log.warning(
                "could not queue workout %s to device %s", garmin_id, device_id, exc_info=True
            )
            raise HTTPException(
                status_code=502,
                detail=f"uploaded to Garmin Connect, but couldn't queue it to the device: {e}",
            ) from e

    return PushResponse(
        workout_id=row.id,
        garmin_workout_id=garmin_id,
        queued_to_device=queued_to_device,
        raw=result if isinstance(result, dict) else {"result": str(result)},
    )
