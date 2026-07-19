"""FastAPI entrypoint."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request

from app.db import init_db
from app.logging_config import configure_logging
from app.logging_context import get_request_id, new_request_id, set_request_id
from app.routers import workouts

configure_logging()
log = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="Garmin Coach", version="0.1.0")
    init_db()
    app.include_router(workouts.router)

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        # Honor an inbound id (useful when the frontend sets one) so the same
        # id flows through client logs and server logs; otherwise mint a new one.
        inbound = request.headers.get("X-Request-Id")
        rid = inbound or new_request_id()
        set_request_id(rid)
        log.info(
            "request started: %s %s", request.method, request.url.path
        )
        try:
            response = await call_next(request)
        except Exception:
            log.exception("request failed: %s %s", request.method, request.url.path)
            raise
        response.headers["X-Debug-Request-Id"] = rid
        log.info(
            "request finished: %s %s -> %s (id=%s)",
            request.method, request.url.path, response.status_code, get_request_id(),
        )
        return response

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
