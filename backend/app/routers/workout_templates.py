"""Read-only listing of the workout templates shown in the Templates gallery.

Templates are seeded into the database on startup (see
`app.services.workout_templates.seed_workout_templates`) — there is no write
endpoint here yet since MVP scope is "browse a curated list", not "author
templates from the UI".
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.workout_template import WorkoutTemplateRow
from app.schemas.workout import Workout

router = APIRouter(prefix="/workout-templates", tags=["workout-templates"])


class WorkoutTemplateOut(BaseModel):
    id: str
    name: str
    category: str
    structure: str
    intensity: str
    purpose: str
    workout: Workout


@router.get("", response_model=list[WorkoutTemplateOut])
def list_workout_templates(db: Annotated[Session, Depends(get_db)]) -> list[WorkoutTemplateOut]:
    rows = (
        db.execute(select(WorkoutTemplateRow).order_by(WorkoutTemplateRow.sort_order))
        .scalars()
        .all()
    )
    return [
        WorkoutTemplateOut(
            id=r.id,
            name=r.name,
            category=r.category,
            structure=r.structure,
            intensity=r.intensity,
            purpose=r.purpose,
            workout=Workout.model_validate(r.payload),
        )
        for r in rows
    ]
