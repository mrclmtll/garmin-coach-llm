from datetime import UTC

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON, DateTime, TypeDecorator


class PortableJSON(TypeDecorator):
    """JSON column that uses JSONB on Postgres, JSON elsewhere (SQLite)."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):  # type: ignore[override]
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())


class TZDateTime(TypeDecorator):
    """A timezone-aware DateTime column type for SQLAlchemy.

    This type ensures that all datetime values are stored in UTC in the database
    and are returned as timezone-aware datetime objects in UTC.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                raise ValueError("Naive datetime is not allowed. Provide a timezone-aware value.")
            # Convert to UTC before storing
            return value.astimezone(UTC)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            # Ensure the returned datetime is timezone-aware and in UTC
            return value.replace(tzinfo=UTC)
        return value
