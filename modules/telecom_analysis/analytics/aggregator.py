"""
Statistics aggregator — single-pass overall subscriber summary.

Combines outputs from all individual analyzers into one SubscriberSummary.
This is the root data structure returned to the frontend dashboard tab.
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

from ..parsers.base_parser import ParseResult
from ..utils.phone_utils import detect_carrier
from .base_analyzer import BaseAnalyzer
from .contact_analyzer import ContactAnalyzer
from .frequency_analyzer import CommunicationFrequencyAnalyzer
from .imei_analyzer import IMEIAnalyzer
from .location_analyzer import LocationAnalyzer
from .record_normalizer import build_dataframe
from .results import SubscriberSummary
from .time_pattern_analyzer import TimePatternAnalyzer


class StatisticsAggregator(BaseAnalyzer):
    """
    Orchestrates all sub-analyzers and returns a single SubscriberSummary.
    Efficient: builds the DataFrame once and passes it to each analyzer.
    """

    def __init__(self) -> None:
        self._contact  = ContactAnalyzer()
        self._imei     = IMEIAnalyzer()
        self._location = LocationAnalyzer()
        self._time     = TimePatternAnalyzer()
        self._freq     = CommunicationFrequencyAnalyzer()

    def _analyze_dataframe(
        self, df: pd.DataFrame, owner_phone: str
    ) -> SubscriberSummary:
        """Internal — all sub-analyzers share the same DataFrame."""
        freq_result   = self._freq.analyze(df, owner_phone)
        contact_result = self._contact.analyze(df, owner_phone)
        imei_result   = self._imei.analyze(df, owner_phone)
        loc_result    = self._location.analyze(df, owner_phone)
        time_result   = self._time.analyze(df, owner_phone)

        # Date range
        ts_df = df[df["timestamp"].notna()]
        date_from = self._safe_min(ts_df["timestamp"]) if not ts_df.empty else None
        date_to   = self._safe_max(ts_df["timestamp"]) if not ts_df.empty else None

        # Average daily activity
        daily_counts = list(freq_result.daily_activity.values())
        avg_daily = (
            round(sum(daily_counts) / len(daily_counts), 1)
            if daily_counts else 0.0
        )

        return SubscriberSummary(
            owner_phone=owner_phone,
            carrier=detect_carrier(owner_phone),
            full_name=None,              # populated by the service layer from sub_info
            date_range_from=date_from.to_pydatetime() if date_from is not None else None,
            date_range_to=date_to.to_pydatetime()     if date_to   is not None else None,
            total_records=freq_result.total_records,
            unique_contacts=contact_result.total_contacts,
            unique_towers=loc_result.unique_towers,
            unique_imei=imei_result.unique_count,
            voice_count=freq_result.voice_count,
            sms_count=freq_result.sms_count,
            outgoing_count=freq_result.outgoing_count,
            incoming_count=freq_result.incoming_count,
            service_count=freq_result.service_count,
            avg_daily_activity=avg_daily,
            peak_hour=time_result.peak_hour,
            peak_day=time_result.peak_day,
            has_device_swaps=imei_result.has_swaps,
        )

    def summarize(self, result: ParseResult) -> SubscriberSummary:
        """Build a complete summary from a ParseResult in one call."""
        df = build_dataframe(result)
        owner = result.subscriber_info.phone_normalized or ""
        summary = self._analyze_dataframe(df, owner)
        # Enrich with PII fields from the parse result
        summary.full_name = result.subscriber_info.full_name
        return summary

    def summarize_dataframe(
        self, df: pd.DataFrame, owner_phone: str, full_name: Optional[str] = None
    ) -> SubscriberSummary:
        summary = self._analyze_dataframe(df, owner_phone)
        summary.full_name = full_name
        return summary
