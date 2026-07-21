"""Workout template table.

Built-in templates (Norwegian 4x4, Tempo Run, etc.) are seeded on startup by
`app.services.workout_templates.seed_workout_templates` — see that module for
the canonical list. Rows are keyed by a stable slug `id` so seeding can
upsert without duplicating on repeated startups, and so new templates can be
added directly in the database without touching code.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.db_types import PortableJSON


class WorkoutTemplateRow(Base):
    __tablename__ = "workout_templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    structure: Mapped[str] = mapped_column(String(512), nullable=False)
    intensity: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(String(512), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(PortableJSON, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
