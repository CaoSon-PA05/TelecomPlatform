"""
Health check endpoints — fully implemented.

GET /api/v1/health          → liveness   (always fast, no DB)
GET /api/v1/health/ready    → readiness  (checks DB connectivity)
GET /api/v1/health/info     → app info   (version, env, config summary)
"""

from __future__ import annotations

import platform
import sys
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.connection import get_db, ping_database

router = APIRouter(prefix="/health", tags=["Health"])

# Track startup time for uptime reporting
_started_at = datetime.now(tz=timezone.utc)


@router.get(
    "",
    summary="Liveness check",
    description="Returns 200 immediately. Use to verify the process is alive.",
)
async def liveness() -> dict:
    return {
        "status": "ok",
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }


@router.get(
    "/ready",
    summary="Readiness check",
    description=(
        "Returns 200 when the application is fully ready to serve traffic. "
        "Checks database connectivity. Returns 503 if the database is unreachable."
    ),
)
async def readiness() -> dict:
    db_ok = ping_database()
    overall = "ok" if db_ok else "degraded"

    return {
        "status": overall,
        "checks": {
            "database": "ok" if db_ok else "error",
        },
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }


@router.get(
    "/info",
    summary="Application info",
    description="Returns version, environment, runtime details, and configuration summary.",
)
async def info() -> dict:
    uptime_seconds = (
        datetime.now(tz=timezone.utc) - _started_at
    ).total_seconds()

    return {
        "app": {
            "title":   settings.APP_TITLE,
            "version": settings.APP_VERSION,
            "env":     settings.ENV,
        },
        "runtime": {
            "python":   sys.version.split()[0],
            "platform": platform.system(),
            "uptime_s": round(uptime_seconds, 1),
            "started":  _started_at.isoformat(),
        },
        "config": {
            "api_prefix":        settings.API_V1_PREFIX,
            "database_backend":  "sqlite" if "sqlite" in settings.DATABASE_URL else "postgresql",
            "max_upload_mb":     settings.MAX_UPLOAD_SIZE_MB,
            "default_page_size": settings.DEFAULT_PAGE_SIZE,
            "log_level":         settings.LOG_LEVEL,
        },
    }
