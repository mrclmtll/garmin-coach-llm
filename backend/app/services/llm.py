"""Ollama client with Pydantic validation + automatic retry.

Both workout-creation paths (free text, template) flow through here. The only
difference between them is the system prompt selected in `prompts.py`.

Debug surface: every attempt logs the user input, the full message list sent
to Ollama, and the raw model response. Validation errors log the structured
Pydantic issue. All lines carry the per-request id so the full trace is
greppable in `logs/garmin-coach.log` even when the UI just shows the
generated workout.
"""

from __future__ import annotations

import json
from typing import Any

import httpx
from pydantic import ValidationError

from app.config import settings
from app.logging_context import get_logger
from app.schemas.workout import Workout
from app.services.prompts import build_messages, retry_message

log = get_logger(__name__)

_MAX_LOG_CHARS = 4000  # cap individual message bodies so the log stays readable


def _truncate(text: str, limit: int = _MAX_LOG_CHARS) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}... <truncated, {len(text) - limit} more chars>"


class WorkoutGenerationError(RuntimeError):
    """Raised when the model can't produce a valid Workout after the retry budget."""


def _chat(client: httpx.Client, messages: list[dict[str, str]]) -> str:
    """Call Ollama's /api/chat with format=json and return the assistant content."""
    url = f"{settings.ollama_base_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "format": "json",
        "stream": False,
        # Disable chain-of-thought: required for qwen3.5 (otherwise it loops
        # indefinitely inside the thinking block).
        "think": False,
        # Keep generation bounded — schema validation already retries on miss.
        "options": {"num_predict": 2048},
    }
    resp = client.post(url, json=payload, timeout=120.0)
    resp.raise_for_status()
    data = resp.json()
    return data["message"]["content"]


def _parse_and_validate(text: str) -> tuple[Workout | None, str | None, dict | None]:
    """Try to parse the model's text as a Workout.

    Returns (workout, error_msg, parsed_obj). `parsed_obj` is the raw JSON
    the model produced, kept around for the log even when validation fails —
    that's often where the smoking gun is.
    """
    try:
        obj: Any = json.loads(text)
    except json.JSONDecodeError as e:
        return None, f"invalid JSON: {e.msg} (line {e.lineno}, col {e.colno})", None

    if not isinstance(obj, dict):
        return None, "response is not a JSON object", obj

    try:
        return Workout.model_validate(obj), None, obj
    except ValidationError as e:
        # Compact error string — keep the first few issues.
        issues = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()[:5]
        )
        return None, f"schema mismatch: {issues}", obj


def _log_messages(messages: list[dict[str, str]]) -> None:
    for i, m in enumerate(messages):
        log.debug(
            "  msg[%d] role=%s content=%s",
            i,
            m["role"],
            _truncate(m["content"]),
        )


def generate_workout(*, mode: str, user_text: str) -> Workout:
    """Generate a Workout from free text or a template.

    Validates the model's JSON output against the Workout schema. On failure,
    re-sends the error to the model and tries again, up to `ollama_max_retries`
    total attempts.
    """
    messages = build_messages(mode=mode, user_text=user_text)
    max_attempts = max(1, settings.ollama_max_retries)

    log.info(
        "llm.generate_workout start: mode=%s model=%s max_attempts=%d user_text=%r",
        mode,
        settings.ollama_model,
        max_attempts,
        _truncate(user_text, 1000),
    )
    log.debug("full message stack sent to Ollama (%d messages):", len(messages))
    _log_messages(messages)

    with httpx.Client() as client:
        last_error: str | None = None
        for attempt in range(1, max_attempts + 1):
            log.debug("llm attempt %d/%d — calling Ollama", attempt, max_attempts)
            try:
                text = _chat(client, messages)
            except httpx.HTTPError as e:
                # Network/connection issues — not worth retrying inside the
                # same request, surface immediately.
                log.error("Ollama HTTP error: %s", e)
                raise WorkoutGenerationError(f"Ollama request failed: {e}") from e

            log.debug("raw model response (attempt %d): %s", attempt, _truncate(text))

            workout, err, parsed_obj = _parse_and_validate(text)
            if workout is not None:
                log.info(
                    "llm.generate_workout ok: mode=%s attempt=%d name=%r steps=%d",
                    mode,
                    attempt,
                    workout.name,
                    sum(1 if item.kind == "step" else 1 + len(item.steps) for item in workout.body),
                )
                log.debug("parsed workout JSON: %s", _truncate(json.dumps(parsed_obj)))
                return workout

            last_error = err
            log.warning(
                "llm validation failed: mode=%s attempt=%d/%d error=%s",
                mode,
                attempt,
                max_attempts,
                err,
            )
            if parsed_obj is not None:
                log.debug("offending parsed JSON: %s", _truncate(json.dumps(parsed_obj)))
            if attempt < max_attempts:
                retry = retry_message(err or "unknown error")
                log.debug("appending retry message: %s", _truncate(retry, 500))
                messages.append({"role": "user", "content": retry})

    log.error(
        "llm.generate_workout exhausted retries: mode=%s attempts=%d last_error=%s",
        mode,
        max_attempts,
        last_error,
    )
    raise WorkoutGenerationError(
        f"Model failed to produce a valid Workout after {max_attempts} attempts. "
        f"Last error: {last_error}"
    )
