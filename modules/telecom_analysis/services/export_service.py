"""
Export Service — produces Excel and ZIP exports matching the legacy CDR Analyzer output.

Output format is compatible with re-import (the 'export_all' multi-sheet workbook
can be re-loaded by ImportService with the isExportAllFile detection path).
"""

from __future__ import annotations

from io import BytesIO
from datetime import date

from sqlalchemy.orm import Session

from modules.telecom_analysis.exports import (
    ExcelExporter,
    FlaExporter,
    GtpExporter,
    SHEET_COLUMNS,
    ZipExporter,
)


class ExportService:

    def __init__(self, db: Session) -> None:
        self.db = db
        self._excel = ExcelExporter()
        self._zip   = ZipExporter()

    # ------------------------------------------------------------------
    # Dashboard exports — data passed directly, no DB required
    # ------------------------------------------------------------------

    def export_gtp(self, records: list[dict]) -> BytesIO:
        """
        Export filtered GTP telemetry records to a 3-sheet workbook.
        records: list of dicts with keys time, lac, cell, label, ip, strength, lat, lng.
        """
        exporter = GtpExporter()
        today = date.today().isoformat()
        return exporter.export(records, filename=f"GTP_Report_{today}.xlsx")

    def export_fla(self, records: list[dict]) -> BytesIO:
        """
        Export filtered FLA financial records to a 3-sheet workbook.
        records: list of dicts with keys date, bank, amount, code, content, flag.
        """
        exporter = FlaExporter()
        today = date.today().isoformat()
        return exporter.export(records, filename=f"FLA_Report_{today}.xlsx")

    # ------------------------------------------------------------------
    # Subscriber-based exports (DB-backed) — requires data models
    # ------------------------------------------------------------------

    def export_all(self, subscriber_id: int) -> BytesIO:
        """
        Generate a multi-sheet workbook matching the legacy export format.
        Sheets: TTTB, LIST, Contact, IMEI, Location.
        """
        sheets: dict[str, list[dict]] = {name: [] for name in SHEET_COLUMNS}
        # TODO: populate each sheet from DB queries via self.db
        return self._excel.export_multi_sheet(sheets)

    def export_call_history(
        self, subscriber_id: int, filtered_ids: list[int] | None = None
    ) -> BytesIO:
        """Tab LIST export — CDR records (optionally filtered by record IDs)."""
        rows: list[dict] = []
        # TODO: query CDR records for subscriber_id, optionally limited to filtered_ids
        return self._excel.export(rows, filename=f"{subscriber_id}_calls.xlsx", sheet_name="LIST")

    def export_contacts(
        self, subscriber_id: int, filtered_phones: list[str] | None = None
    ) -> BytesIO:
        """Tab Contact export — contact profiles with annotations."""
        rows: list[dict] = []
        # TODO: query contact profiles for subscriber_id
        return self._excel.export(rows, filename=f"{subscriber_id}_contacts.xlsx", sheet_name="Contact")

    def export_imei(self, subscriber_id: int) -> BytesIO:
        """Tab IMEI export — IMEI list with models and notes."""
        rows: list[dict] = []
        # TODO: query IMEI records for subscriber_id
        return self._excel.export(rows, filename=f"{subscriber_id}_imei.xlsx", sheet_name="IMEI")

    def export_location(self, subscriber_id: int) -> BytesIO:
        """Tab Location export — tower frequency list with coordinates."""
        rows: list[dict] = []
        # TODO: query location frequency data for subscriber_id
        return self._excel.export(rows, filename=f"{subscriber_id}_location.xlsx", sheet_name="Location")

    def export_compare_results(self, results: list, result_type: str) -> BytesIO:
        """Tab comparison export — shared contacts/IMEI/locations."""
        rows: list[dict] = [r if isinstance(r, dict) else vars(r) for r in results]
        return self._excel.export(
            rows,
            filename=f"compare_{result_type}.xlsx",
            sheet_name=f"Compare_{result_type[:24]}",
        )

    def export_all_subscribers_zip(self, subscriber_ids: list[int]) -> BytesIO:
        """
        Batch export: one export_all workbook per subscriber, zipped together.
        Filenames inside the ZIP: {subscriber_id}_export_all.xlsx
        """
        workbooks: dict[str, BytesIO] = {}
        for sub_id in subscriber_ids:
            workbooks[f"{sub_id}_export_all.xlsx"] = self.export_all(sub_id)
        return self._zip.bundle_workbooks(workbooks)
