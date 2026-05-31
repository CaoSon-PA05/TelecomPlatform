"""
Structured logging configuration.
- Development: human-readable coloured text to stdout
- Production:  JSON lines to stdout (for log aggregators like Datadog, Loki)
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import Any

from .config import settings


# ---------------------------------------------------------------------------
# Custom formatters
# ---------------------------------------------------------------------------

class TextFormatter(logging.Formatter):
    """Readable timestamped formatter for development."""

    LEVEL_COLOURS = {
        "DEBUG":    "\033[36m",    # cyan
        "INFO":     "\033[32m",    # green
        "WARNING":  "\033[33m",    # yellow
        "ERROR":    "\033[31m",    # red
        "CRITICAL": "\033[35m",    # magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        colour = self.LEVEL_COLOURS.get(record.levelname, "")
        ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        name = record.name.split(".")[-1]  # last segment only
        return (
            f"{colour}{ts}{self.RESET} "
            f"{colour}{record.levelname:<8}{self.RESET} "
            f"\033[90m{name}\033[0m  "
            f"{record.getMessage()}"
        )


class JSONFormatter(logging.Formatter):
    """Structured JSON formatter for production log aggregation."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts":      datetime.now(tz=timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        if hasattr(record, "request_id"):
            payload["request_id"] = record.request_id
        return json.dumps(payload, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Setup function called at app startup
# ---------------------------------------------------------------------------

def setup_logging() -> None:
    """Configure root logger and quieten noisy third-party libraries."""
    level = getattr(logging, settings.LOG_LEVEL, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    formatter: logging.Formatter = (
        JSONFormatter() if settings.LOG_FORMAT == "json" else TextFormatter()
    )
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

    # Quieten noisy libraries
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging configured | level=%s format=%s env=%s",
        settings.LOG_LEVEL, settings.LOG_FORMAT, settings.ENV,
    )


# ---------------------------------------------------------------------------
# Request-scoped logger helper
# ---------------------------------------------------------------------------

def get_logger(name: str) -> logging.Logger:
    """Convenience wrapper — use in every module instead of logging.getLogger."""
    return logging.getLogger(f"telecom.{name}")
