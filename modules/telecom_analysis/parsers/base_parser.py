"""Abstract base class and shared infrastructure for all CDR file parsers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from ..schemas.cdr_schema import RawCDRRecord
from ..schemas.subscriber_schema import RawSubscriberInfo


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ColumnMap:
    """
    Maps each logical CDR field to its 0-based column index in the data rows.
    None means the column was not detected in the header row.
    """
    source_number:     Optional[int] = None
    target_number:     Optional[int] = None
    timestamp:         Optional[int] = None
    duration_seconds:  Optional[int] = None
    imei:              Optional[int] = None
    province_code:     Optional[int] = None
    comm_type:         Optional[int] = None
    service_direction: Optional[int] = None
    bts_address:       Optional[int] = None
    lac:               Optional[int] = None
    cell_id:           Optional[int] = None


@dataclass
class ParseResult:
    """Complete output of one parser run on one Excel file."""
    subscriber_info:  RawSubscriberInfo
    records:          list[RawCDRRecord]
    column_map:       ColumnMap
    header_row_index: int
    missing_required: list[str] = field(default_factory=list)
    warnings:         list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Abstract base class
# ---------------------------------------------------------------------------

class BaseParser(ABC):
    """
    Each carrier sub-class must implement `can_parse` and `parse`.
    The shared helpers (_build_column_map, _validate_column_map, _levenshtein,
    _similarity) are provided here so all parsers behave consistently.
    """

    # --- Abstract interface ------------------------------------------------

    @abstractmethod
    def can_parse(self, data: list[list]) -> bool:
        """
        Return True if this parser recognises the file structure.
        Used by auto_detector to select the correct parser.
        """

    @abstractmethod
    def parse(self, data: list[list], filename: str = "") -> ParseResult:
        """
        Parse a 2-D Excel array into structured records.
        data is the full sheet as returned by read_excel_to_array (0-indexed).
        """

    # --- Shared helpers (called by sub-classes) ----------------------------

    def _build_column_map(self, header_row: list) -> ColumnMap:
        """
        Fuzzy-match column header strings to ColumnMap fields using keyword
        scoring and Levenshtein similarity.
        Lazy import avoids circular dependency with column_mapper.
        """
        from .column_mapper import build_column_map
        return build_column_map(header_row)

    def _validate_column_map(self, cm: ColumnMap) -> tuple[list[str], list[str]]:
        """
        Return (missing_required_fields, warning_fields).
        Required: source_number, target_number, timestamp.
        Recommended: imei, lac, cell_id, comm_type.
        """
        from .column_mapper import validate
        return validate(cm)

    # --- Low-level string utilities ----------------------------------------

    @staticmethod
    def _levenshtein(a: str, b: str) -> int:
        """Standard edit-distance DP — O(m·n) time, O(n) space."""
        m, n = len(a), len(b)
        if m == 0:
            return n
        if n == 0:
            return m
        dp = list(range(n + 1))
        for i in range(1, m + 1):
            prev = dp[0]
            dp[0] = i
            for j in range(1, n + 1):
                temp = dp[j]
                dp[j] = prev if a[i - 1] == b[j - 1] else 1 + min(prev, dp[j], dp[j - 1])
                prev = temp
        return dp[n]

    @staticmethod
    def _similarity(a: str, b: str) -> float:
        """Return 0.0–1.0 normalized edit similarity between two strings."""
        a_l, b_l = a.lower(), b.lower()
        longer = max(len(a_l), len(b_l))
        if longer == 0:
            return 1.0
        return (longer - BaseParser._levenshtein(a_l, b_l)) / longer
