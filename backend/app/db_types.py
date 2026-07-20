from datetime import timezone
from sqlalchemy.types import TypeDecorator, DateTime

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
                raise ValueError("Naive datetime is not allowed. Please provide a timezone-aware datetime.")
            # Convert to UTC before storing
            return value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            # Ensure the returned datetime is timezone-aware and in UTC
            return value.replace(tzinfo=timezone.utc)
        return value