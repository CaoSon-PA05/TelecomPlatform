"""Date normalization for CDR timestamps and PII date fields."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from ..utils.date_utils import parse_cdr_timestamp, parse_excel_serial_date, parse_pii_date


def normalize_timestamp(raw: str | float | None) -> Optional[datetime]:
    """
    Normalize a CDR timestamp from any observed raw format.
    Handles: string 'DD/MM/YYYY HH:MM:SS', Excel serial float, None.
    Always returns a UTC+7 aware datetime, or None.
    """
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return parse_excel_serial_date(float(raw))
    return parse_cdr_timestamp(raw)


def normalize_date(raw: str | None) -> Optional[date]:
    """
    Normalize a PII date field (DOB, issue date, activation date).
    Input: 'DD/MM/YYYY' string or None.
    """
    return parse_pii_date(raw)


def normalize_duration(raw: str | int | None) -> Optional[int]:
    """
    Normalize a CDR duration field.
    - Empty string or None → None (SMS records have no duration — not the same as 0)
    - Integer or numeric string → int (seconds, must be ≥ 0)
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        val = int(float(s))
        return val if val >= 0 else None
    except (ValueError, TypeError):
        return None
