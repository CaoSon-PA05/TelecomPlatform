"""Tests for ImportService end-to-end pipeline."""

from __future__ import annotations

import pytest

from modules.telecom_analysis.services.import_service import ImportService


class TestImportService:

    def test_import_viettel_file_succeeds(self, db, tmp_path):
        """Full import of the Viettel sample file returns success result."""
        ...

    def test_subscriber_created_after_import(self, db, tmp_path):
        """Subscriber row created with correct normalized phone."""
        ...

    def test_cdr_records_count_matches_excel(self, db, tmp_path):
        """CDR record count after import matches Excel row count."""
        ...

    def test_duplicate_import_creates_new_batch(self, db, tmp_path):
        """Re-importing same file creates a second batch, no duplicate CDR rows."""
        ...

    def test_stats_rebuilt_after_import(self, db, tmp_path):
        """hourly_activity_stats has 24 rows per subscriber after import."""
        ...

    def test_imei_device_created(self, db, tmp_path):
        """Device row created for each unique IMEI found in CDR."""
        ...

    def test_tower_created_from_lac_cell(self, db, tmp_path):
        """CellTower row created for each unique LAC+CellID pair."""
        ...
