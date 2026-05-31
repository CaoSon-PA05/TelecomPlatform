"""
FastAPI dependency injection providers.
All service instances are created here via Depends() — routes import nothing
except these dependency functions, keeping routes thin and testable.

Usage in a route:
    @router.get("/subscribers/{id}")
    async def get_subscriber(
        id: int,
        svc: SubscriberService = Depends(get_subscriber_service),
    ):
        ...
"""

from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db

# ---------------------------------------------------------------------------
# Database session — foundation for all service dependencies
# ---------------------------------------------------------------------------

DBSession = Depends(get_db)


# ---------------------------------------------------------------------------
# Service providers
# Telecom logic is not yet implemented — these are the injection points.
# Replace the placeholder bodies with real service construction once
# modules/telecom_analysis/services/ implementations are complete.
# ---------------------------------------------------------------------------

def get_subscriber_service(db: Session = Depends(get_db)):
    """Provides SubscriberService bound to the current request's DB session."""
    from modules.telecom_analysis.services import SubscriberService
    return SubscriberService(db)


def get_import_service(db: Session = Depends(get_db)):
    """Provides ImportService bound to the current request's DB session."""
    from modules.telecom_analysis.services import ImportService
    return ImportService(db)


def get_analytics_service(db: Session = Depends(get_db)):
    """Provides AnalyticsService bound to the current request's DB session."""
    from modules.telecom_analysis.services import AnalyticsService
    return AnalyticsService(db)


def get_export_service(db: Session = Depends(get_db)):
    """Provides ExportService bound to the current request's DB session."""
    from modules.telecom_analysis.services import ExportService
    return ExportService(db)


def get_stats_service(db: Session = Depends(get_db)):
    """Provides StatsService bound to the current request's DB session."""
    from modules.telecom_analysis.services import StatsService
    return StatsService(db)
