"""
Frontend tab adapters — transform service layer outputs into
the exact JSON shape expected by each frontend tab.

These sit between the FastAPI route handlers and the analytics service,
ensuring that schema changes in the DB layer never break the frontend contract.
"""

from __future__ import annotations

from ..schemas.analytics_schema import (
    ActivityReport,
    IMEIItem,
    MovementPoint,
    TowerFrequencyItem,
)
from ..schemas.contact_schema import ContactProfileResponse
from ..schemas.cdr_schema import CDRRecordResponse


def format_subscriber_tab(subscriber) -> dict:
    """Tab 1: Thong tin thue bao — subscriber PII card."""
    ...


def format_call_history_tab(
    records: list[CDRRecordResponse], total: int, page: int, page_size: int
) -> dict:
    """Tab 2: Lich su cuoc goi — paginated CDR table."""
    ...


def format_contacts_tab(
    contacts: list[ContactProfileResponse],
    total: int,
    page: int,
    page_size: int,
) -> dict:
    """Tab 3: So lien lac — paginated contact table with stats summary."""
    ...


def format_imei_tab(items: list[IMEIItem]) -> dict:
    """Tab 4: IMEI — device list with stats counters."""
    ...


def format_location_tab(
    towers: list[TowerFrequencyItem],
    total: int,
    page: int,
    page_size: int,
) -> dict:
    """Tab 5: Vi tri — location frequency table with stats."""
    ...


def format_reports_tab(report: ActivityReport) -> dict:
    """Tab 6: Bao cao — hourly/weekly chart data in Chart.js dataset format."""
    ...


def format_maps_tab(timeline: list[MovementPoint]) -> dict:
    """Tab 7: Ban do — GeoJSON-compatible movement data for Leaflet."""
    ...


def format_compare_tab(results: list, result_type: str) -> dict:
    """Tab 8: So sanh — comparison table with dynamic column headers."""
    ...
