"""
Database connection — wraps backend/database/session.py.
Provides engine and session factory driven by app Settings,
overriding the hardcoded URL in the lower-level session module.
"""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from backend.database.base import Base
from backend.app.core.config import settings

log = logging.getLogger("telecom.database")

# ---------------------------------------------------------------------------
# Engine — configured from settings, not hardcoded
# ---------------------------------------------------------------------------

_engine_kwargs: dict = {
    "echo": settings.DB_ECHO_SQL,
}

if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite needs check_same_thread disabled for FastAPI's thread model
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL / other RDBMS — use connection pooling
    _engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    _engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    _engine_kwargs["pool_pre_ping"] = True

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# Enable WAL mode for SQLite to support concurrent reads during writes
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db() -> Session:
    """
    Yield a database session and guarantee cleanup.
    Use as a FastAPI dependency:
        db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Lifecycle helpers
# ---------------------------------------------------------------------------

def create_tables() -> None:
    """Create all ORM-mapped tables. Called at startup in non-production envs."""
    log.info("Creating database tables if not exist...")
    Base.metadata.create_all(bind=engine)
    log.info("Database tables ready.")


def ping_database() -> bool:
    """Return True if the database is reachable. Used by the health check."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        log.error("Database ping failed: %s", exc)
        return False
