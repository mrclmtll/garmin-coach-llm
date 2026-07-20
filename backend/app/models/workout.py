"""Workout table.

The full workout structure is stored as JSON; the row only carries metadata
(when it was created, where it came from, push status). This keeps the schema
trivially Postgres-portable — no SQLite-specific column types, no AUTOINCREMENT
(uses SQLAlchemy `Identity`).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON, TypeDecorator

from app.db import Base
from app.db_types import TZDateTime


class PortableJSON(TypeDecorator):
    """JSON column that uses JSONB on Postgres, JSON elsewhere (SQLite)."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):  # type: ignore[override]
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


class WorkoutRow(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sport: Mapped[str] = mapped_column(String(32), nullable=False)
    # "text" | "template" | "manual"
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(PortableJSON, nullable=False)
    pushed_at: Mapped[datetime | None] = mapped_column(TZDateTime, nullable=True)
    garmin_workout_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
