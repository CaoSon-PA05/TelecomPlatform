"""
Carrier / template auto-detection.
Port of the detection logic from Mau/script.js.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from ..utils.constants import COLUMN_KEYWORDS
from ..utils.file_utils import extract_phone_from_filename  # correct module
from ..utils.phone_utils import detect_carrier


class DetectedTemplate(str, Enum):
    VIETTEL = "viettel"   # Template 1: fixed cell PII, 'Số đi'/'Số đến' headers
    VINA    = "vina"      # Template 2: a_subs/b_subs column headers
    MOBI    = "mobi"      # Template 3: STT column + free-text PII rows
    UNKNOWN = "unknown"


# -------------------------------------------------------------------------
# Public API
# -------------------------------------------------------------------------

def detect_from_filename(filename: str) -> DetectedTemplate:
    """
    Fast detection: extract phone from filename → carrier prefix → template.
    '0_0382733506.xlsx' → 038 → VIETTEL
    Returns UNKNOWN if no phone number can be extracted.
    """
    phone = extract_phone_from_filename(filename)
    if not phone:
        return DetectedTemplate.UNKNOWN
    carrier = detect_carrier(phone)
    return _CARRIER_TO_TEMPLATE.get(carrier, DetectedTemplate.UNKNOWN)


def detect_from_content(data: list[list]) -> DetectedTemplate:
    """
    Content-based fallback: scan cell structure for carrier-specific patterns.
    Cascade: Viettel → Vina → Mobi → UNKNOWN.
    """
    if _has_template1_structure(data):
        return DetectedTemplate.VIETTEL
    if _has_template2_structure(data):
        return DetectedTemplate.VINA
    if _has_template3_structure(data):
        return DetectedTemplate.MOBI
    return DetectedTemplate.UNKNOWN


def find_header_row(data: list[list]) -> int:
    """
    Score-based search for the CDR column header row.
    Scans the first 35 rows; returns the 0-based index of the best candidate.
    Raises ValueError if no row scores above the minimum threshold.
    """
    all_keywords = [kw for kws in COLUMN_KEYWORDS.values() for kw in kws]

    best_row   = -1
    best_score = 0

    for i, row in enumerate(data[:35]):
        if not any(c is not None for c in row):
            continue

        score = 0
        for cell in row:
            if cell is None:
                continue
            cell_s = str(cell).lower().strip()
            for kw in all_keywords:
                if kw in cell_s or cell_s == kw:
                    score += 1
                    break   # count each cell only once

        if score > best_score and score >= 3:
            best_score = score
            best_row   = i

    if best_row >= 0:
        return best_row
    raise ValueError(
        f"Could not find CDR column header row (max score={best_score}, need ≥3)"
    )


# -------------------------------------------------------------------------
# Private structure detectors
# -------------------------------------------------------------------------

def _has_template1_structure(data: list[list]) -> bool:
    """
    Viettel: subscriber PII at fixed cells — rows 6 and 7 both have a
    non-empty value in column 2 (name and phone number respectively).
    Confirmed from both real Viettel sample files.
    """
    try:
        return (
            len(data) > 16
            and data[6][2] is not None and str(data[6][2]).strip() != ""
            and data[7][2] is not None and str(data[7][2]).strip() != ""
        )
    except IndexError:
        return False


def _has_template2_structure(data: list[list]) -> bool:
    """
    Vinaphone: any of the first 10 rows contains both 'a_subs' and 'b_subs'.
    """
    for row in data[:10]:
        row_lower = [str(c).lower().strip() for c in row if c is not None]
        has_a = any("a_subs" in c or "a-subs" in c for c in row_lower)
        has_b = any("b_subs" in c or "b-subs" in c for c in row_lower)
        if has_a and has_b:
            return True
    return False


def _has_template3_structure(data: list[list]) -> bool:
    """
    Mobifone: any of the first 10 rows has a cell that matches the STT pattern.
    STT = 'Số thứ tự' (serial number column).
    """
    for row in data[:10]:
        for cell in row:
            if cell is not None and _is_stt(str(cell)):
                return True
    return False


def _is_stt(value: str) -> bool:
    """Return True for cells that represent the STT (serial number) column."""
    v = value.strip().upper()
    return (
        v == "STT"
        or "SỐ THỨ TỰ" in v
        or "SO THU TU" in v
    )


_CARRIER_TO_TEMPLATE: dict[str, DetectedTemplate] = {
    "viettel": DetectedTemplate.VIETTEL,
    "vina":    DetectedTemplate.VINA,
    "mobi":    DetectedTemplate.MOBI,
}
