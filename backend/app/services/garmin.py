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
        raise RuntimeError("GARMIN_EMAIL and GARMIN_PASSWORD must be set in the environment")

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


def list_workouts(start: int = 0, limit: int = 100) -> list[dict[str, Any]]:
    """Return raw workout dicts currently stored in the Garmin workout library."""
    client = _get_client()
    return client.get_workouts(start=start, limit=limit)


def _get_primary_device_id(client: Garmin) -> str | None:
    """Best-effort lookup of the account's primary training device id.

    `garminconnect` doesn't document this endpoint's response shape, so we
    check the nesting patterns Garmin's other device endpoints use rather
    than assume one; any miss just means the frontend's dropdown won't have
    a device pre-marked as primary, not a hard failure.
    """
    try:
        raw = client.get_primary_training_device()
    except Exception:
        log.warning("could not fetch primary training device", exc_info=True)
        return None
    candidate = raw
    if isinstance(raw, dict):
        candidate = raw.get("device") or raw.get("primaryTrainingDevice") or raw
    device_id = candidate.get("deviceId") if isinstance(candidate, dict) else None
    return str(device_id) if device_id is not None else None


def list_devices() -> list[dict[str, Any]]:
    """List every device registered on this account as {id, name, is_primary}.

    Ordered primary-first, then alphabetically by name — the order the
    frontend's push dropdown shows them in.
    """
    client = _get_client()
    raw_devices = client.get_devices()
    primary_id = _get_primary_device_id(client)

    entries = []
    for d in raw_devices:
        device_id = str(d.get("deviceId"))
        name = d.get("displayName") or d.get("deviceName") or f"Device {device_id}"
        entries.append({"id": device_id, "name": name, "is_primary": device_id == primary_id})

    primary = [e for e in entries if e["is_primary"]]
    rest = sorted((e for e in entries if not e["is_primary"]), key=lambda e: e["name"].lower())
    return primary + rest


def send_workout_to_device(*, garmin_workout_id: str, device_id: str) -> dict[str, Any]:
    """Queue an already-uploaded workout for delivery to a specific device.

    Delegates to garminconnect's own `push_workout_to_device` (0.3.7+) — it
    mirrors the request Garmin Connect's web UI makes when you click "Send to
    Device": it doesn't push bytes directly, it queues a message the watch
    picks up next time it syncs (Bluetooth via Connect Mobile, or USB via
    Garmin Express).
    """
    client = _get_client()
    log.info("queuing workout %s for device %s", garmin_workout_id, device_id)
    raw = client.push_workout_to_device(workout_id=garmin_workout_id, device_id=device_id)
    log.info("device queue ok: workout=%s device=%s", garmin_workout_id, device_id)
    return {"raw": raw}


def push_workout(workout: Workout) -> dict[str, Any]:
    """Translate to the garminconnect workout model and upload it.

    Returns the raw response (includes the assigned workoutId).
    """
    client = _get_client()
    garmin_workout = to_garmin_workout(workout)
    log.info(
        "garmin push: sport=%s name=%r steps=%d",
        workout.sport.value,
        workout.name,
        sum(1 if item.kind == "step" else 1 + len(item.steps) for item in workout.body),
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
