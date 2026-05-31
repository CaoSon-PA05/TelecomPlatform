"""
Upload metadata extraction.

Uses two libraries with complementary strengths:
  openpyxl (read-only mode): efficient sheet names, row counts, column counts
  pandas:                    structural analysis, header row detection, column mapping

Both are called via asyncio.to_thread() to avoid blocking the event loop.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import openpyxl
import pandas as pd
from pydantic import BaseModel

from .validator import ValidationResult

log = logging.getLogger("telecom.upload.metadata")

# Rows to sample for header/structure detection (lightweight, not full file load)
_SAMPLE_ROWS = 30

# CDR header keywords used to confirm a sheet contains CDR data
_CDR_HEADER_KEYWORDS = {
    "so di", "so den", "thoi gian", "imei", "lac", "cell",
    "a_subs", "b_subs", "direction", "type", "stt",
}


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class SheetInfo:
    name:       str
    row_count:  int          # total rows including headers (from openpyxl max_row)
    col_count:  int
    headers:    list[str]    # detected column names (best-guess header row)
    is_cdr:     bool = False  # True when header keywords match CDR columns


class ValidationSummary(BaseModel):
    valid:    bool
    errors:   list[str]
    warnings: list[str]


class UploadMetadata(BaseModel):
    upload_id:            str
    original_filename:    str
    stored_filename:      str
    file_size_bytes:      int
    file_size_kb:         float
    extension:            str
    uploaded_at:          str     # ISO 8601
    detected_phone:       Optional[str] = None
    detected_carrier:     Optional[str] = None
    sheet_names:          list[str] = []
    sheets:               list[dict] = []   # SheetInfo serialised
    primary_sheet:        Optional[str] = None
    estimated_records:    int = 0
    validation:           ValidationSummary

    model_config = {"arbitrary_types_allowed": True}


# ---------------------------------------------------------------------------
# Async entry point
# ---------------------------------------------------------------------------

async def extract_metadata(
    stored_path: Path,
    original_filename: str,
    upload_id: str,
    validation: ValidationResult,
) -> UploadMetadata:
    """
    Extract metadata from a saved Excel file.
    Blocking openpyxl + pandas work is offloaded to a thread pool.
    """
    # Detect phone number and carrier from original filename
    detected_phone   = _extract_phone_from_filename(original_filename)
    detected_carrier = _detect_carrier(detected_phone) if detected_phone else None

    # Run blocking I/O in thread pool
    try:
        sheet_infos: list[SheetInfo] = await asyncio.to_thread(
            _extract_sheet_info, stored_path
        )
    except Exception as exc:
        log.warning("Failed to extract sheet info from '%s': %s", original_filename, exc)
        sheet_infos = []

    # Pick the primary CDR sheet
    primary_sheet = _pick_primary_sheet(sheet_infos)

    # Estimate CDR record count (total rows - header overhead)
    estimated_records = 0
    if primary_sheet:
        for s in sheet_infos:
            if s.name == primary_sheet:
                # CDR data starts after ~22 header rows for Viettel format
                estimated_records = max(0, s.row_count - 22)
                break

    return UploadMetadata(
        upload_id=upload_id,
        original_filename=original_filename,
        stored_filename=stored_path.name,
        file_size_bytes=validation.file_size_bytes,
        file_size_kb=validation.file_size_kb,
        extension=validation.extension,
        uploaded_at=datetime.now(tz=timezone.utc).isoformat(),
        detected_phone=detected_phone,
        detected_carrier=detected_carrier,
        sheet_names=[s.name for s in sheet_infos],
        sheets=[_sheet_to_dict(s) for s in sheet_infos],
        primary_sheet=primary_sheet,
        estimated_records=estimated_records,
        validation=ValidationSummary(
            valid=validation.valid,
            errors=validation.errors,
            warnings=validation.warnings,
        ),
    )


# ---------------------------------------------------------------------------
# Blocking helpers (run in thread pool via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _extract_sheet_info(path: Path) -> list[SheetInfo]:
    """
    Extract per-sheet metadata using openpyxl (row/col counts) and
    pandas (header detection and column name extraction).
    """
    # ---- openpyxl: efficient row/col counts ----
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    raw_shapes: dict[str, tuple[int, int]] = {}
    for name in wb.sheetnames:
        ws = wb[name]
        raw_shapes[name] = (ws.max_row or 0, ws.max_column or 0)
    wb.close()

    # ---- pandas: header detection on sample rows ----
    sheets: list[SheetInfo] = []
    for sheet_name, (n_rows, n_cols) in raw_shapes.items():
        headers, is_cdr = _detect_headers_pandas(path, sheet_name)
        sheets.append(
            SheetInfo(
                name=sheet_name,
                row_count=n_rows,
                col_count=n_cols,
                headers=headers,
                is_cdr=is_cdr,
            )
        )

    return sheets


def _detect_headers_pandas(path: Path, sheet_name: str) -> tuple[list[str], bool]:
    """
    Load the first _SAMPLE_ROWS rows with pandas and identify the best header row.

    Strategy:
      - Row with the most non-null string cells is likely the header.
      - Score rows against known CDR column keywords.
      - Return the column names from the best-scoring row.
    """
    try:
        df = pd.read_excel(
            path,
            sheet_name=sheet_name,
            header=None,
            nrows=_SAMPLE_ROWS,
            dtype=str,        # treat all cells as strings for keyword matching
            engine="openpyxl" if path.suffix.lower() == ".xlsx" else "xlrd",
        )
    except Exception as exc:
        log.debug("pandas could not read sheet '%s': %s", sheet_name, exc)
        return [], False

    if df.empty:
        return [], False

    best_row_idx = -1
    best_score   = 0

    for i, row in df.iterrows():
        # Filter non-null string cells
        cells = [str(c).strip().lower() for c in row if pd.notna(c) and str(c).strip()]
        if not cells:
            continue

        # Count how many cells match known CDR keywords
        keyword_hits = sum(
            1 for cell in cells
            if any(kw in cell for kw in _CDR_HEADER_KEYWORDS)
        )
        # Prefer rows with many non-null cells and keyword hits
        score = keyword_hits * 10 + len(cells)

        if score > best_score and len(cells) >= 4:
            best_score   = score
            best_row_idx = int(i)  # type: ignore[arg-type]

    if best_row_idx < 0:
        # Fallback: treat last sample row as header
        best_row_idx = min(21, len(df) - 1)

    headers = [
        str(v).strip() for v in df.iloc[best_row_idx]
        if pd.notna(v) and str(v).strip()
    ]
    is_cdr = best_score >= 20  # at least 2 keyword matches

    return headers, is_cdr


def _pick_primary_sheet(sheets: list[SheetInfo]) -> Optional[str]:
    """
    Return the name of the sheet most likely to contain CDR data.
    Priority: CDR-detected sheet > sheet with most rows > first sheet.
    """
    if not sheets:
        return None

    # Prefer sheets explicitly detected as CDR
    cdr_sheets = [s for s in sheets if s.is_cdr]
    if cdr_sheets:
        return max(cdr_sheets, key=lambda s: s.row_count).name

    # Otherwise largest sheet
    return max(sheets, key=lambda s: s.row_count).name


def _sheet_to_dict(s: SheetInfo) -> dict:
    return {
        "name":       s.name,
        "row_count":  s.row_count,
        "col_count":  s.col_count,
        "headers":    s.headers,
        "is_cdr":     s.is_cdr,
    }


# ---------------------------------------------------------------------------
# Phone / carrier helpers (inline — module utils are stubs at this stage)
# ---------------------------------------------------------------------------

_PHONE_RE = re.compile(r"(?<!\d)(0[3-9]\d{8})(?!\d)")

_VIETTEL_PREFIXES = frozenset(
    ["032","033","034","035","036","037","038","039","086","096","097","098"]
)
_VINA_PREFIXES = frozenset(
    ["081","082","083","084","085","088","091","094"]
)
_MOBI_PREFIXES = frozenset(
    ["070","076","077","078","079","089","090","093"]
)


def _extract_phone_from_filename(filename: str) -> Optional[str]:
    """
    Extract a Vietnamese 10-digit phone number from a filename.
    '0_0382733506.xlsx' → '0382733506'
    '1_0969619929.xlsx' → '0969619929'
    """
    # Direct 10-digit match
    match = _PHONE_RE.search(Path(filename).stem)
    if match:
        return match.group(1)

    # Try 9-digit (missing leading 0) → prepend 0
    nine = re.search(r"(?<!\d)([3-9]\d{8})(?!\d)", Path(filename).stem)
    if nine:
        candidate = "0" + nine.group(1)
        if _PHONE_RE.match(candidate):
            return candidate

    return None


def _detect_carrier(phone: str) -> Optional[str]:
    """Return 'viettel' | 'vina' | 'mobi' | None from phone prefix."""
    prefix = phone[:3] if len(phone) >= 3 else ""
    if prefix in _VIETTEL_PREFIXES:
        return "viettel"
    if prefix in _VINA_PREFIXES:
        return "vina"
    if prefix in _MOBI_PREFIXES:
        return "mobi"
    return None
