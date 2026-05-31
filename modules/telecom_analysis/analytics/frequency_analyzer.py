"""
Communication frequency analysis + repeated communication detection.

Answers:
- What is the overall voice/SMS/direction breakdown?
- Are there burst patterns (many interactions with one contact in a short window)?
- How does daily activity vary across the observation period?
- What is the message classification breakdown (onnet/offnet/VAS/international)?
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

from .base_analyzer import BaseAnalyzer
from .results import BurstPattern, CommFrequencyResult, MessageClassification, RepeatedCommResult


class CommunicationFrequencyAnalyzer(BaseAnalyzer):
    """Overall communication frequency statistics."""

    def _analyze_dataframe(
        self,
        df: pd.DataFrame,
        owner_phone: str,
    ) -> CommFrequencyResult:
        if df.empty:
            return _empty_comm_result(owner_phone)

        total       = len(df)
        voice_df    = df[df["comm_type"] == "VOICE"]
        sms_df      = df[df["comm_type"] == "SMS"]
        outgoing_df = df[df["direction"] == "outgoing"]
        incoming_df = df[df["direction"] == "incoming"]
        service_df  = df[df["direction"] == "service"]

        # Voice duration stats
        durations = voice_df["duration_seconds"].dropna()
        avg_duration = float(durations.mean()) if not durations.empty else 0.0
        max_duration = int(durations.max()) if not durations.empty else 0

        # Message classification
        cat = df["service_category"].value_counts()
        classification = MessageClassification(
            onnet=int(cat.get("onnet", 0)),
            offnet=int(cat.get("offnet", 0)),
            vas=int(cat.get("vas", 0)),
            international=int(cat.get("international", 0)),
            unknown=int(
                df[df["service_category"].isna()].shape[0]
            ),
        )

        # Daily activity (only rows with valid timestamps)
        daily: dict[str, int] = {}
        if "date" in df.columns:
            date_df = df[df["date"].notna()].copy()
            daily_counts = (
                date_df.groupby(date_df["date"].astype(str))["direction"]
                .count()
                .to_dict()
            )
            daily = {str(k): int(v) for k, v in daily_counts.items()}

        voice_ratio = len(voice_df) / total if total else 0.0

        return CommFrequencyResult(
            owner_phone=owner_phone,
            total_records=total,
            voice_count=len(voice_df),
            sms_count=len(sms_df),
            outgoing_count=len(outgoing_df),
            incoming_count=len(incoming_df),
            service_count=len(service_df),
            avg_voice_duration_sec=round(avg_duration, 1),
            max_voice_duration_sec=max_duration,
            message_classification=classification,
            daily_activity=daily,
            voice_ratio=round(voice_ratio, 4),
        )

    def analyze(
        self, df: pd.DataFrame, owner_phone: str
    ) -> CommFrequencyResult:
        return self._analyze_dataframe(df, owner_phone)


class RepeatedCommunicationDetector(BaseAnalyzer):
    """Burst-pattern and repeated communication detector."""

    DEFAULT_WINDOW_MINUTES  = 60
    DEFAULT_BURST_THRESHOLD = 3
    DEFAULT_HIGH_FREQ_TOP_N = 10

    def _analyze_dataframe(
        self,
        df: pd.DataFrame,
        owner_phone: str,
        *,
        window_minutes: int = DEFAULT_WINDOW_MINUTES,
        burst_threshold: int = DEFAULT_BURST_THRESHOLD,
        top_n: int = DEFAULT_HIGH_FREQ_TOP_N,
    ) -> RepeatedCommResult:
        """
        Detect:
        - Burst patterns: ≥ burst_threshold interactions with the same contact
          within a rolling window_minutes window.
        - High-frequency contacts: top-N contacts by interaction count.
        - Mutual contacts: contacts with both incoming and outgoing interactions.
        """
        contact_df = df[
            df["contact_number"].notna() &
            (df["direction"] != "service") &
            df["timestamp"].notna()
        ].copy()

        if contact_df.empty:
            return RepeatedCommResult(
                owner_phone=owner_phone,
                bursts=[],
                mutual_contacts=[],
                high_frequency_contacts=[],
                total_contacts_analyzed=0,
            )

        # High-frequency contacts (top N by total interaction count)
        freq = contact_df.groupby("contact_number").size()
        high_freq = freq.nlargest(top_n).index.tolist()

        # Mutual contacts (both outgoing and incoming)
        out_phones = set(
            contact_df[contact_df["direction"] == "outgoing"]["contact_number"]
        )
        in_phones = set(
            contact_df[contact_df["direction"] == "incoming"]["contact_number"]
        )
        mutual = sorted(out_phones & in_phones)

        # Burst detection via rolling time window per contact
        bursts: list[BurstPattern] = []
        window_delta = timedelta(minutes=window_minutes)

        for contact, group in contact_df.sort_values("timestamp").groupby("contact_number"):
            timestamps = group["timestamp"].sort_values().tolist()
            for i, start_ts in enumerate(timestamps):
                window_end = start_ts + window_delta
                window_rows = group[
                    (group["timestamp"] >= start_ts) &
                    (group["timestamp"] <= window_end)
                ]
                if len(window_rows) >= burst_threshold:
                    burst_ts_list = window_rows["timestamp"].tolist()
                    bursts.append(BurstPattern(
                        contact_number=str(contact),
                        burst_start=start_ts.to_pydatetime(),
                        burst_end=burst_ts_list[-1].to_pydatetime(),
                        interaction_count=len(window_rows),
                        comm_types=sorted(
                            window_rows["comm_type"].unique().tolist()
                        ),
                    ))
                    break   # one burst per contact is enough

        # Deduplicate bursts (same contact, overlapping windows)
        seen: set[str] = set()
        unique_bursts: list[BurstPattern] = []
        for b in sorted(bursts, key=lambda x: x.interaction_count, reverse=True):
            if b.contact_number not in seen:
                unique_bursts.append(b)
                seen.add(b.contact_number)

        return RepeatedCommResult(
            owner_phone=owner_phone,
            bursts=unique_bursts,
            mutual_contacts=mutual,
            high_frequency_contacts=high_freq,
            total_contacts_analyzed=int(contact_df["contact_number"].nunique()),
        )

    def detect_bursts(
        self,
        df: pd.DataFrame,
        owner_phone: str,
        window_minutes: int = DEFAULT_WINDOW_MINUTES,
        threshold: int = DEFAULT_BURST_THRESHOLD,
    ) -> list[BurstPattern]:
        result = self._analyze_dataframe(
            df, owner_phone,
            window_minutes=window_minutes,
            burst_threshold=threshold,
        )
        return result.bursts

    def analyze(
        self,
        df: pd.DataFrame,
        owner_phone: str,
        **kwargs,
    ) -> RepeatedCommResult:
        return self._analyze_dataframe(df, owner_phone, **kwargs)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _empty_comm_result(owner_phone: str) -> CommFrequencyResult:
    return CommFrequencyResult(
        owner_phone=owner_phone,
        total_records=0, voice_count=0, sms_count=0,
        outgoing_count=0, incoming_count=0, service_count=0,
        avg_voice_duration_sec=0.0, max_voice_duration_sec=0,
        message_classification=MessageClassification(0, 0, 0, 0, 0),
        daily_activity={},
        voice_ratio=0.0,
    )
