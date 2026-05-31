"""
Import Service — orchestrates the full file-to-database pipeline.

Pipeline
--------
  Excel file
    → read_excel_to_array
    → auto_detect_parser  (filename → content fallback)
    → parser.parse()      → ParseResult
    → normalize each row  (phone, timestamp, duration, province)
    → upsert Subscriber
    → create ImportBatch
    → get_or_create Device (per IMEI)
    → get_or_create CellTower (per LAC+CID)
    → bulk_insert CDRRecords
    → rebuild_all_stats (contacts, IMEI, time, location)
    → return ImportResult
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from ..parsers import auto_detect_parser, parse_file
from ..schemas.import_schema import ImportResult
from .stats_service import StatsService


class ImportService:

    def __init__(self, db: Session) -> None:
        self.db = db
        self._stats = StatsService(db)

    def import_file(self, path: Path, template_override: str | None = None) -> ImportResult:
        """
        Full import pipeline for one Excel file.
        Creates or updates subscriber, creates batch record, inserts CDR rows.
        Triggers stats rebuild for the subscriber on success.
        Returns ImportResult with counts and any warnings.
        """
        ...

    def import_multiple(
        self, paths: list[Path], template_override: str | None = None
    ) -> list[ImportResult]:
        """Import multiple files sequentially; collects all results."""
        ...

    def _upsert_subscriber(self, raw_info, carrier: str) -> int:
        """
        Create subscriber if phone not in DB; update PII fields if already exists.
        Returns subscriber_id.
        """
        ...

    def _create_batch(
        self, subscriber_id: int, filename: str, raw_info, template: str, status: str
    ) -> int:
        """Insert import_batches row. Returns batch_id."""
        ...

    def _get_or_create_device(self, imei_raw: str) -> int | None:
        """
        Normalize IMEI; look up devices table; create if not found.
        Returns device_id or None for empty/invalid IMEI.
        """
        ...

    def _get_or_create_tower(
        self, lac_raw: str, cell_id_raw: str, province_code_raw: str, bts_address: str
    ) -> int | None:
        """
        Look up cell_towers by (lac, cell_id); create if not found.
        Updates bts_address and province_name if new info available.
        Returns tower_id or None for missing location data.
        """
        ...

    def _bulk_insert_records(
        self, subscriber_id: int, batch_id: int, normalized_rows: list
    ) -> int:
        """Bulk insert normalized CDRRecordCreate objects. Returns count inserted."""
        ...
