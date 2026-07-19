"""Garmin client wrapper.

Single point that talks to the `garminconnect` package. Caches the login
session via the package's token store so we don't re-authenticate on every
push. Credentials come from env (config.settings) — never hardcoded.
"""

from __future__ import annotations

from typing import Any

from garminconnect import Garmin

from app.config import settings
from app.logging_context import get_logger
from app.schemas.workout import Sport, Workout
from app.services.garmin_format import to_garmin_workout

log = get_logger(__name__)

_client: Garmin | None = None


def _get_client() -> Garmin:
    global _client
    if _client is not None:
        return _client

    if not settings.garmin_email or not settings.garmin_password:
        raise RuntimeError(
            "GARMIN_EMAIL and GARMIN_PASSWORD must be set in the environment"
        )

    # garminconnect reads/writes tokens at this path so subsequent logins
    # don't require MFA / interactive auth.
    settings.tokenstore_path.mkdir(parents=True, exist_ok=True)

    log.info("logging in to garminconnect (tokenstore=%s)", settings.tokenstore_path)
    _client = Garmin(
        email=settings.garmin_email,
        password=settings.garmin_password,
    )
    _client.login(tokenstore=str(settings.tokenstore_path))
    return _client


def push_workout(workout: Workout) -> dict[str, Any]:
    """Translate to the garminconnect workout model and upload it.

    Returns the raw response (includes the assigned workoutId).
    """
    client = _get_client()
    garmin_workout = to_garmin_workout(workout)
    log.info(
        "garmin push: sport=%s name=%r steps=%d",
        workout.sport.value, workout.name,
        sum(
            1 if item.kind == "step" else 1 + len(item.steps)
            for item in workout.body
        ),
    )
    try:
        if workout.sport == Sport.RUNNING:
            result = client.upload_running_workout(garmin_workout)
        elif workout.sport == Sport.CYCLING:
            result = client.upload_cycling_workout(garmin_workout)
        elif workout.sport == Sport.SWIMMING:
            result = client.upload_swimming_workout(garmin_workout)
        else:
            raise ValueError(f"unsupported sport: {workout.sport}")
    except Exception:
        log.exception("garmin push failed: sport=%s name=%r", workout.sport.value, workout.name)
        raise

    log.info("garmin push ok: name=%r result=%r", workout.name, result)
    return result
