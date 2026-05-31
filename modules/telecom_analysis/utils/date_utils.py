"""Date/time parsing utilities for CDR and PII date fields."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

_VN_TZ = timezone(timedelta(hours=7))

# All timestamp formats observed in real CDR Excel files (most specific first)
_CDR_TIMESTAMP_FORMATS = [
    "%d/%m/%Y %H:%M:%S",   # primary: "11/07/2025 17:12:47"
    "%Y-%m-%d %H:%M:%S",   # ISO with time
    "%d-%m-%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
    "%Y-%m-%d",
]

_PII_DATE_FORMATS = [
    "%d/%m/%Y",
    "%Y-%m-%d",
    "%d-%m-%Y",
]

# Excel date epoch (with the historical Lotus 1-2-3 leap year bug)
_EXCEL_EPOCH = datetime(1899, 12, 30)


def parse_cdr_timestamp(raw: str | None) -> Optional[datetime]:
    """
    Parse a CDR timestamp string into a UTC+7 aware datetime.
    Returns None on failure — never raises.
    """
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw.replace(tzinfo=_VN_TZ) if raw.tzinfo is None else raw

    s = str(raw).strip()
    if not s:
        return None

    for fmt in _CDR_TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=_VN_TZ)
        except ValueError:
            continue
    return None


def parse_pii_date(raw: str | None) -> Optional[date]:
    """
    Parse a subscriber PII date string (DOB, issue date, activation date).
    Input: 'DD/MM/YYYY' or 'YYYY-MM-DD' string. Returns date object or None.
    """
    if not raw:
        return None
    s = str(raw).strip()
    for fmt in _PII_DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_excel_serial_date(serial: float) -> Optional[datetime]:
    """
    Convert an Excel serial date number to a UTC+7 aware datetime.
    Handles both Windows (1900) and Mac (1904) epoch — defaults to 1900.
    """
    try:
        return (_EXCEL_EPOCH + timedelta(days=float(serial))).replace(tzinfo=_VN_TZ)
    except (TypeError, ValueError, OverflowError):
        return None


def format_iso(dt: datetime | date | None) -> Optional[str]:
    """Return ISO 8601 string, or None."""
    if dt is None:
        return None
    return dt.isoformat()
