"""Centralized logging configuration.

- Console handler (stdout) at INFO for dev visibility.
- Rotating file handler at DEBUG in `logs/garmin-coach.log` so we can inspect
  full LLM traffic later without rerunning the request.
- Configurable via env: `LOG_LEVEL` (default INFO), `LOG_FILE` (default
  `logs/garmin-coach.log`), `LOG_MAX_BYTES` (default 5 MB), `LOG_BACKUPS`
  (default 3).
- Idempotent: calling `configure_logging()` twice replaces handlers, so it
  plays nice with `uvicorn --reload`.
"""

from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

_CONFIGURED = False


def _resolve_level() -> int:
    name = os.getenv("LOG_LEVEL", "INFO").upper()
    return getattr(logging, name, logging.INFO)


def configure_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        # Clear existing handlers so reconfiguration (e.g. after a code reload)
        # doesn't double-emit each line.
        root = logging.getLogger()
        for h in list(root.handlers):
            root.removeHandler(h)

    level = _resolve_level()
    fmt = "%(asctime)s %(levelname)-7s [%(request_id)s] %(name)s: %(message)s"
    formatter = logging.Formatter(fmt)

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(level)
    console.setFormatter(formatter)

    log_path = Path(os.getenv("LOG_FILE", "logs/garmin-coach.log"))
    max_bytes = int(os.getenv("LOG_MAX_BYTES", str(5 * 1024 * 1024)))
    backups = int(os.getenv("LOG_BACKUPS", "3"))
    log_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = RotatingFileHandler(
        log_path, maxBytes=max_bytes, backupCount=backups, encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.addHandler(console)
    root.addHandler(file_handler)

    # Quiet down noisy third-party loggers — keep at WARNING unless user
    # explicitly wants more.
    for noisy in ("httpx", "httpcore", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True
