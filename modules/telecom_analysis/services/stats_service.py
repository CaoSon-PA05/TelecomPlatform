"""
Stats rebuild service.
Recomputes all pre-aggregated tables for a subscriber after any CDR data change.
Each rebuild is a full DELETE + INSERT (idempotent, no incremental logic needed).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..analytics import (
    ContactAnalyzer,
    IMEIAnalyzer,
    LocationAnalyzer,
    TimePatternAnalyzer,
)


class StatsService:

    def __init__(self, db: Session) -> None:
        self.db = db

    def rebuild_all(self, subscriber_id: int) -> None:
        """
        Full stats rebuild for one subscriber.
        Order matters: contacts → IMEI → time → location.
        Called automatically at the end of every successful import.
        """
        ContactAnalyzer(self.db).rebuild_stats(subscriber_id)
        IMEIAnalyzer(self.db).rebuild_stats(subscriber_id)
        TimePatternAnalyzer(self.db).rebuild_stats(subscriber_id)
        LocationAnalyzer(self.db).rebuild_stats(subscriber_id)

    def rebuild_contacts(self, subscriber_id: int) -> None:
        ContactAnalyzer(self.db).rebuild_stats(subscriber_id)

    def rebuild_imei(self, subscriber_id: int) -> None:
        IMEIAnalyzer(self.db).rebuild_stats(subscriber_id)

    def rebuild_time_patterns(self, subscriber_id: int) -> None:
        TimePatternAnalyzer(self.db).rebuild_stats(subscriber_id)

    def rebuild_locations(self, subscriber_id: int) -> None:
        LocationAnalyzer(self.db).rebuild_stats(subscriber_id)
