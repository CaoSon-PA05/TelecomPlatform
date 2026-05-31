"""
FastAPI application factory.

Run in development:
    uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

Run in production:
    gunicorn backend.app.main:app -k uvicorn.workers.UvicornWorker -w 4

The module is structured as a factory (create_app) so that tests can
instantiate a fresh app without sharing global state.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.app.api.v1.router import api_v1_router
from backend.app.core.config import settings
from backend.app.core.exceptions import register_exception_handlers
from backend.app.core.logging import setup_logging
from backend.app.database.connection import create_tables

log = logging.getLogger("telecom.main")


# ---------------------------------------------------------------------------
# Lifespan — startup and shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ---- STARTUP ----
    setup_logging()
    log.info(
        "Starting %s v%s [%s]",
        settings.APP_TITLE, settings.APP_VERSION, settings.ENV,
    )

    if settings.is_development or settings.is_testing:
        # Auto-create tables in dev/test; use migrations in production
        create_tables()

    log.info("Application ready — listening on %s", settings.API_V1_PREFIX)
    yield

    # ---- SHUTDOWN ----
    log.info("Shutting down %s", settings.APP_TITLE)


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------

async def _request_logging_middleware(request, call_next):
    """Log method + path for every request (debug level to avoid noise)."""
    log.debug("%s %s", request.method, request.url.path)
    response = await call_next(request)
    log.debug("%s %s → %d", request.method, request.url.path, response.status_code)
    return response


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_TITLE,
        description=settings.APP_DESCRIPTION,
        version=settings.APP_VERSION,
        docs_url=settings.docs_url,
        redoc_url=settings.redoc_url,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------
    # Middleware (applied in reverse registration order)
    # ------------------------------------------------------------------

    # Compress responses > 1 KB
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    # CORS — must be last registered (executes first)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],   # required for file downloads
    )

    # ------------------------------------------------------------------
    # Exception handlers
    # ------------------------------------------------------------------
    register_exception_handlers(app)

    # ------------------------------------------------------------------
    # Routers
    # ------------------------------------------------------------------
    app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    # ------------------------------------------------------------------
    # Root redirect
    # ------------------------------------------------------------------
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "service": settings.APP_TITLE,
            "version": settings.APP_VERSION,
            "docs":    f"{settings.API_V1_PREFIX.rstrip('/')}/docs"
                       if not settings.is_production else None,
            "health":  f"{settings.API_V1_PREFIX}/health",
        }

    return app


# ---------------------------------------------------------------------------
# Module-level app instance — used by uvicorn/gunicorn
# ---------------------------------------------------------------------------
app = create_app()
