"""
Record normalizer — converts a ParseResult into a fully typed pandas DataFrame.

This is the foundation layer that all analytics engines consume.
Every column has a well-defined type and semantics so analyzers never
need to re-parse raw strings.

DataFrame columns
-----------------
source_number_raw   str        Raw value from CDR 'Số đi' column
target_number_raw   str        Raw value from CDR 'Số đến' column
owner_phone         str        Normalized subscriber phone (e.g. '0969619929')
contact_number      str|NaN    Normalized non-owner party; NaN for service senders
direction           str        'outgoing' | 'incoming' | 'service'
timestamp           datetime   UTC+7 aware; NaT when unparseable
date                object     datetime.date or NaT
hour                Int8       0–23; NA when timestamp unknown
day_of_week         Int8       0=Monday … 6=Sunday; NA when timestamp unknown
duration_seconds    Int32      Seconds; NA for SMS (no duration)
comm_type           str        'VOICE' | 'SMS'
service_direction_raw str|NaN  Raw carrier direction label
service_category    str|NaN    'onnet'|'offnet'|'vas'|'international'
imei                str|NaN    15-char IMEI; NaN when missing
province_code_raw   str|NaN    Raw province code (e.g. 'TNH', 'T066')
province_name       str|NaN    Normalised province name (e.g. 'Tay Ninh')
bts_address         str|NaN    Full BTS station address
lac                 Int32      Location Area Code; NA when missing
cell_id             Int32      Cell ID; NA when missing
tower_key           str|NaN    '{lac}-{cell_id}'; NaN when either is missing
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

from ..normalizers.date_normalizer import normalize_duration, normalize_timestamp
from ..normalizers.phone_normalizer import resolve_direction
from ..normalizers.province_normalizer import normalize_province
from ..parsers.base_parser import ParseResult
from ..schemas.cdr_schema import RawCDRRecord
from ..schemas.subscriber_schema import RawSubscriberInfo
from ..utils.constants import SERVICE_DIRECTION_MAP
from ..utils.constants import IMEI_LENGTH

_EMPTY_COLUMNS = [
    "source_number_raw", "target_number_raw", "owner_phone", "contact_number",
    "direction", "timestamp", "date", "hour", "day_of_week", "duration_seconds",
    "comm_type", "service_direction_raw", "service_category", "imei",
    "province_code_raw", "province_name", "bts_address", "lac", "cell_id", "tower_key",
]


def build_dataframe(result: ParseResult) -> pd.DataFrame:
    """
    Convert ParseResult → normalized pd.DataFrame.
    Returns an empty DataFrame (correct columns, zero rows) for empty results.
    """
    owner_phone = result.subscriber_info.phone_normalized or ""
    return records_to_dataframe(result.records, owner_phone)


def records_to_dataframe(
    records: list[RawCDRRecord],
    owner_phone: str,
) -> pd.DataFrame:
    """
    Convert a list of RawCDRRecord + owner_phone → normalized DataFrame.
    Can be called without a full ParseResult.
    """
    if not records:
        return pd.DataFrame(columns=_EMPTY_COLUMNS)

    rows = []
    for rec in records:
        rows.append(_normalize_record(rec, owner_phone))

    df = pd.DataFrame(rows)

    # Apply nullable integer types (pandas Int32/Int8 support pd.NA)
    for col, dtype in (
        ("lac", "Int32"),
        ("cell_id", "Int32"),
        ("duration_seconds", "Int32"),
        ("hour", "Int8"),
        ("day_of_week", "Int8"),
    ):
        df[col] = pd.to_numeric(df[col], errors="coerce").astype(dtype)

    return df


def apply_time_filter(
    df: pd.DataFrame,
    date_from: Optional[pd.Timestamp] = None,
    date_to: Optional[pd.Timestamp] = None,
    time_from: Optional[str] = None,   # 'HH:MM'
    time_to: Optional[str] = None,
) -> pd.DataFrame:
    """
    Filter a CDR DataFrame by date range and/or time-of-day window.
    All filters are inclusive on both bounds.
    """
    mask = pd.Series(True, index=df.index)

    valid_ts = df["timestamp"].notna()

    if date_from is not None:
        mask &= valid_ts & (df["timestamp"] >= date_from)
    if date_to is not None:
        mask &= valid_ts & (df["timestamp"] <= date_to)
    if time_from is not None:
        h = int(time_from.split(":")[0])
        mask &= valid_ts & (df["hour"].astype("Int32") >= h)
    if time_to is not None:
        h = int(time_to.split(":")[0])
        mask &= valid_ts & (df["hour"].astype("Int32") <= h)

    return df[mask]


def apply_contact_filter(df: pd.DataFrame, contact_number: str) -> pd.DataFrame:
    """Return only rows where contact_number matches (last-9-digit normalization)."""
    from ..utils.phone_utils import get_last_9_digits
    target9 = get_last_9_digits(contact_number)
    if not target9:
        return df[df["contact_number"] == contact_number]

    def _matches(c: object) -> bool:
        if pd.isna(c):
            return False
        c9 = get_last_9_digits(str(c))
        return c9 == target9

    mask = df["contact_number"].apply(_matches)
    return df[mask]


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _normalize_record(rec: RawCDRRecord, owner_phone: str) -> dict:
    """Convert one RawCDRRecord to a flat dict of typed values."""
    src = rec.source_number_raw or ""
    tgt = rec.target_number_raw or ""

    contact, direction = resolve_direction(src, tgt, owner_phone)
    ts = normalize_timestamp(rec.timestamp_raw)
    duration = normalize_duration(rec.duration_raw)

    province_name = normalize_province(rec.province_code_raw)
    service_cat   = SERVICE_DIRECTION_MAP.get(rec.service_direction_raw or "", None)

    lac     = _safe_int(rec.lac_raw)
    cell_id = _safe_int(rec.cell_id_raw)
    tower_key = f"{lac}-{cell_id}" if lac is not None and cell_id is not None else None

    # IMEI: keep raw string if present; None if blank
    imei_raw = (rec.imei_raw or "").strip()
    imei = imei_raw if imei_raw else None

    return {
        "source_number_raw":    src,
        "target_number_raw":    tgt,
        "owner_phone":          owner_phone,
        "contact_number":       contact,
        "direction":            direction,
        "timestamp":            ts,
        "date":                 ts.date() if ts is not None else None,
        "hour":                 ts.hour   if ts is not None else None,
        "day_of_week":          ts.weekday() if ts is not None else None,
        "duration_seconds":     duration,
        "comm_type":            (rec.comm_type_raw or "SMS").upper(),
        "service_direction_raw": rec.service_direction_raw,
        "service_category":     service_cat,
        "imei":                 imei,
        "province_code_raw":    rec.province_code_raw,
        "province_name":        province_name,
        "bts_address":          rec.bts_address_raw,
        "lac":                  lac,
        "cell_id":              cell_id,
        "tower_key":            tower_key,
    }


def _safe_int(value: object) -> Optional[int]:
    """Convert a cell value to int, or None on failure."""
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None
