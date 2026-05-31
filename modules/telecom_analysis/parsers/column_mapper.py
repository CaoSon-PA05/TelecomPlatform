"""
Fuzzy column mapper — port of buildColumnMap() + validateColumns() from Mau/script.js.

Scoring cascade for each (header_cell, field_name) pair:
  1.0   exact match
  0.9   header contains keyword
  0.8   keyword contains header
  0.6+  Levenshtein similarity ≥ 0.6 (scaled to 0.42–0.6)

Any score ≥ 0.5 assigns the column; the best-scoring field wins conflicts.
"""

from __future__ import annotations

from dataclasses import fields as dc_fields
from typing import Optional

from ..utils.constants import COLUMN_KEYWORDS
from .base_parser import BaseParser, ColumnMap

_REQUIRED_FIELDS    = ("source_number", "target_number", "timestamp")
_RECOMMENDED_FIELDS = ("imei", "lac", "cell_id", "comm_type")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_column_map(header_row: list) -> ColumnMap:
    """
    Score each cell in the header row against COLUMN_KEYWORDS patterns.
    Assigns the best-matching column index to each ColumnMap field.
    """
    cm = ColumnMap()
    field_names = [f.name for f in dc_fields(ColumnMap)]
    best_scores: dict[str, float] = {f: 0.0 for f in field_names}

    for col_idx, cell in enumerate(header_row):
        if cell is None:
            continue
        cell_str = str(cell).strip().lower()
        if not cell_str:
            continue

        for field_name in field_names:
            score = _score_cell(cell_str, field_name)
            if score >= 0.5 and score > best_scores[field_name]:
                setattr(cm, field_name, col_idx)
                best_scores[field_name] = score

    return cm


def validate(column_map: ColumnMap) -> tuple[list[str], list[str]]:
    """
    Return (missing_required, warning_fields).

    missing_required: fields without which import fails
    warning_fields:   fields whose absence degrades analysis (import still proceeds)
    """
    missing  = [f for f in _REQUIRED_FIELDS    if getattr(column_map, f) is None]
    warnings = [f for f in _RECOMMENDED_FIELDS if getattr(column_map, f) is None]
    return missing, warnings


# ---------------------------------------------------------------------------
# Internal scoring
# ---------------------------------------------------------------------------

def _score_cell(cell_value: str, field_name: str) -> float:
    """
    Return 0.0–1.0 match score for one normalised cell value against a field's keyword list.
    """
    keywords = COLUMN_KEYWORDS.get(field_name, [])
    if not keywords:
        return 0.0

    best = 0.0
    for kw in keywords:
        kw_l = kw.lower()
        if cell_value == kw_l:
            return 1.0                              # exact match — short-circuit
        if kw_l in cell_value:
            best = max(best, 0.9)
        elif cell_value in kw_l:
            best = max(best, 0.8)
        else:
            sim = BaseParser._similarity(cell_value, kw_l)
            if sim >= 0.6:
                best = max(best, sim * 0.7)         # scale: 0.42 – 0.7

    return best
