"""Per-request logging context.

A `contextvars.ContextVar` holds the current `request_id` for the in-flight
HTTP request. `RequestIdAdapter` reads it on every `log` call so the `[id]`
slot in the formatter is always populated — without manually threading the id
through every service call.

Single-user MVP today, multi-tenant ready tomorrow: each request gets a stable
id, all log lines for that request are greppable, and the same id is returned
to the client via `X-Debug-Request-Id` so they can quote it when reporting a
problem.
"""

from __future__ import annotations

import contextvars
import logging
import uuid

_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


def new_request_id() -> str:
    return uuid.uuid4().hex[:12]


def set_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def get_request_id() -> str:
    return _request_id_var.get()


class RequestIdAdapter(logging.LoggerAdapter):
    """Injects the current request_id into every log record."""

    def process(self, msg: str, kwargs: dict):  # type: ignore[override]
        return msg, {"extra": {"request_id": get_request_id()}}


def get_logger(name: str) -> RequestIdAdapter:
    return RequestIdAdapter(logging.getLogger(name), {})
