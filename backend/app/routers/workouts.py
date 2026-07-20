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
from app.models.workout import WorkoutRow
from app.schemas.workout import Workout
from app.services import garmin, llm

router = APIRouter(prefix="/workouts", tags=["workouts"])


class FromTextRequest(BaseModel):
    text: str = Field(min_length=1)
    sport: str | None = None  # optional hint to the LLM


class FromTemplateRequest(BaseModel):
    text: str = Field(min_length=1)
    sport: str | None = None


class CreatedWorkout(BaseModel):
    """Returned by create endpoints so the client can push without a second roundtrip."""

    id: int
    workout: Workout


class PushResponse(BaseModel):
    workout_id: int
    garmin_workout_id: str | None
    raw: dict


class WorkoutSummary(BaseModel):
    """Lightweight row for the saved-workouts list — no full payload."""

    id: int
    name: str
    sport: str
    source: str
    created_at: datetime
    pushed_at: datetime | None
    garmin_workout_id: str | None


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


@router.post("/from-text", response_model=CreatedWorkout, status_code=status.HTTP_201_CREATED)
def create_from_text(
    req: FromTextRequest, db: Annotated[Session, Depends(get_db)]
) -> CreatedWorkout:
    try:
        workout = llm.generate_workout(mode="free_text", user_text=req.text)
    except llm.WorkoutGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    row = _persist(db, workout, source="text")
    return CreatedWorkout(id=row.id, workout=workout)


@router.post("/from-template", response_model=CreatedWorkout, status_code=status.HTTP_201_CREATED)
def create_from_template(
    req: FromTemplateRequest, db: Annotated[Session, Depends(get_db)]
) -> CreatedWorkout:
    try:
        workout = llm.generate_workout(mode="template", user_text=req.text)
    except llm.WorkoutGenerationError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    row = _persist(db, workout, source="template")
    return CreatedWorkout(id=row.id, workout=workout)


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
    db.commit()
    db.refresh(row)
    return _row_to_workout(row)


@router.post("/{workout_id}/push", response_model=PushResponse)
def push_workout(workout_id: int, db: Annotated[Session, Depends(get_db)]) -> PushResponse:
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

    return PushResponse(
        workout_id=row.id,
        garmin_workout_id=garmin_id,
        raw=result if isinstance(result, dict) else {"result": str(result)},
    )
