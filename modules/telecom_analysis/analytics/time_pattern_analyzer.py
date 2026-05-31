"""
Temporal activity pattern analytics.

Answers:
- During which hours of the day is the subscriber most active?
- Which days of the week show the most activity?
- What are the peak hours for voice calls vs SMS?
"""

from __future__ import annotations

from typing import Optional

import pandas as pd

from .base_analyzer import BaseAnalyzer
from .results import DailyBucket, HourlyBucket, TimePatternResult

_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class TimePatternAnalyzer(BaseAnalyzer):

    def _analyze_dataframe(
        self,
        df: pd.DataFrame,
        owner_phone: str,
    ) -> TimePatternResult:
        """
        Build 24-bucket hourly and 7-bucket weekly activity histograms.
        Returns a TimePatternResult with all 31 buckets always populated (zeros included).
        """
        if df.empty:
            return self._empty_result(owner_phone)

        ts_df = df[df["timestamp"].notna()].copy()
        if ts_df.empty:
            return self._empty_result(owner_phone)

        # ---- Hourly histogram (0–23) ----
        hourly_total  = ts_df.groupby("hour")["direction"].count()
        hourly_voice  = ts_df[ts_df["comm_type"] == "VOICE"].groupby("hour")["direction"].count()
        hourly_sms    = ts_df[ts_df["comm_type"] == "SMS"].groupby("hour")["direction"].count()
        hourly_out    = ts_df[ts_df["direction"] == "outgoing"].groupby("hour")["direction"].count()
        hourly_in     = ts_df[ts_df["direction"] == "incoming"].groupby("hour")["direction"].count()

        hourly_buckets: list[HourlyBucket] = []
        for h in range(24):
            hourly_buckets.append(HourlyBucket(
                hour=h,
                total_count=int(hourly_total.get(h, 0)),
                voice_count=int(hourly_voice.get(h, 0)),
                sms_count=int(hourly_sms.get(h, 0)),
                outgoing_count=int(hourly_out.get(h, 0)),
                incoming_count=int(hourly_in.get(h, 0)),
            ))

        # ---- Weekly histogram (0=Monday … 6=Sunday) ----
        weekly_total = ts_df.groupby("day_of_week")["direction"].count()
        weekly_voice = ts_df[ts_df["comm_type"] == "VOICE"].groupby("day_of_week")["direction"].count()
        weekly_sms   = ts_df[ts_df["comm_type"] == "SMS"].groupby("day_of_week")["direction"].count()

        weekly_buckets: list[DailyBucket] = []
        for d in range(7):
            weekly_buckets.append(DailyBucket(
                day_of_week=d,
                day_label=_DAY_LABELS[d],
                total_count=int(weekly_total.get(d, 0)),
                voice_count=int(weekly_voice.get(d, 0)),
                sms_count=int(weekly_sms.get(d, 0)),
            ))

        # Peak hour and peak day (ignore zeros)
        total_by_hour = {b.hour: b.total_count for b in hourly_buckets}
        total_by_day  = {b.day_of_week: b.total_count for b in weekly_buckets}

        peak_hour = (
            max(total_by_hour, key=total_by_hour.get)
            if any(total_by_hour.values()) else None
        )
        peak_day = (
            max(total_by_day, key=total_by_day.get)
            if any(total_by_day.values()) else None
        )

        return TimePatternResult(
            owner_phone=owner_phone,
            hourly=hourly_buckets,
            weekly=weekly_buckets,
            peak_hour=peak_hour,
            peak_day=peak_day,
            total_records=len(ts_df),
        )

    def analyze(
        self, df: pd.DataFrame, owner_phone: str
    ) -> TimePatternResult:
        return self._analyze_dataframe(df, owner_phone)

    def get_peak_hour(self, df: pd.DataFrame) -> Optional[int]:
        result = self._analyze_dataframe(df, "")
        return result.peak_hour

    def get_peak_day(self, df: pd.DataFrame) -> Optional[int]:
        result = self._analyze_dataframe(df, "")
        return result.peak_day

    def get_hourly_vector(self, df: pd.DataFrame) -> list[int]:
        """Return a 24-element list of counts for Chart.js consumption."""
        result = self._analyze_dataframe(df, "")
        return [b.total_count for b in result.hourly]

    def get_weekly_vector(self, df: pd.DataFrame) -> list[int]:
        """Return a 7-element list of counts for Chart.js consumption."""
        result = self._analyze_dataframe(df, "")
        return [b.total_count for b in result.weekly]

    @staticmethod
    def _empty_result(owner_phone: str) -> TimePatternResult:
        return TimePatternResult(
            owner_phone=owner_phone,
            hourly=[
                HourlyBucket(h, 0, 0, 0, 0, 0)
                for h in range(24)
            ],
            weekly=[
                DailyBucket(d, _DAY_LABELS[d], 0, 0, 0)
                for d in range(7)
            ],
            peak_hour=None,
            peak_day=None,
            total_records=0,
        )
