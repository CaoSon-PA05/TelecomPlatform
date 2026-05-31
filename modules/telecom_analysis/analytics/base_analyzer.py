"""
BaseAnalyzer — dual-mode abstract base class.

Mode A — in-memory (primary):
    analyzer.from_dataframe(df, owner_phone)   → result dataclass
    Works directly on a pandas DataFrame from record_normalizer.build_dataframe().
    No database required. Used immediately after parsing.

Mode B — DB-backed (secondary):
    analyzer.compute(subscriber_id, db=session)  → result schema
    Reads from the SQLAlchemy database after CDR records are persisted.
    Used by the FastAPI service layer.

Sub-classes implement `_analyze_dataframe()` for Mode A and optionally
override `compute()` for Mode B.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

import pandas as pd


class BaseAnalyzer(ABC):

    # -------------------------------------------------------------------
    # Mode A — in-memory, pandas DataFrame
    # -------------------------------------------------------------------

    @abstractmethod
    def _analyze_dataframe(self, df: pd.DataFrame, owner_phone: str) -> Any:
        """
        Core analytics logic operating on a normalized CDR DataFrame.
        Called by from_dataframe(); implement in every sub-class.
        Returns the typed result dataclass defined in results.py.
        """

    def from_dataframe(self, df: pd.DataFrame, owner_phone: str = "") -> Any:
        """
        Run analytics on an in-memory DataFrame.
        Handles the empty-DataFrame edge case before delegating.
        """
        return self._analyze_dataframe(df, owner_phone)

    def from_parse_result(self, result: Any) -> Any:
        """
        Convenience: build DataFrame from ParseResult then analyze.
        Avoids re-importing record_normalizer at every call site.
        """
        from .record_normalizer import build_dataframe
        df = build_dataframe(result)
        owner = result.subscriber_info.phone_normalized or ""
        return self.from_dataframe(df, owner)

    # -------------------------------------------------------------------
    # Mode B — database-backed (stubs; implement when DB layer is ready)
    # -------------------------------------------------------------------

    def compute(self, subscriber_id: int, **kwargs: Any) -> Any:
        """
        DB-backed analytics. Requires a `db` keyword argument (SQLAlchemy Session).
        Not implemented yet — raises until the import pipeline is wired up.
        """
        raise NotImplementedError(
            f"{type(self).__name__}.compute() requires the database import pipeline. "
            "Use from_parse_result() for in-memory analysis."
        )

    def rebuild_stats(self, subscriber_id: int, **kwargs: Any) -> None:
        """
        Rebuild pre-aggregated DB stats for this subscriber.
        Called after every successful CDR import.
        """
        raise NotImplementedError(
            f"{type(self).__name__}.rebuild_stats() requires the database layer."
        )

    # -------------------------------------------------------------------
    # Shared pandas utilities
    # -------------------------------------------------------------------

    @staticmethod
    def _safe_first(series: pd.Series) -> Optional[Any]:
        """Return first non-NaT/NaN value, or None."""
        valid = series.dropna()
        return valid.iloc[0] if not valid.empty else None

    @staticmethod
    def _safe_min(series: pd.Series) -> Optional[Any]:
        if series.isna().all():
            return None
        return series.dropna().min()

    @staticmethod
    def _safe_max(series: pd.Series) -> Optional[Any]:
        if series.isna().all():
            return None
        return series.dropna().max()

    @staticmethod
    def _to_py_int(val: Any) -> int:
        """Convert numpy/pandas int to native Python int safely."""
        try:
            return int(val)
        except (TypeError, ValueError):
            return 0
