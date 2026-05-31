"""
Contact frequency and relationship analytics.

Answers:
- Who does the subscriber communicate with, and how often?
- Which contacts are mutual (both called and received calls)?
- What are the top contacts by interaction count?
- Filter by date/time window for period-specific analysis.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd

from ..utils.phone_utils import detect_carrier
from .base_analyzer import BaseAnalyzer
from .results import ContactFrequencyItem, ContactFrequencyResult


class ContactAnalyzer(BaseAnalyzer):

    def _analyze_dataframe(
        self,
        df: pd.DataFrame,
        owner_phone: str,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        time_from: Optional[str] = None,
        time_to: Optional[str] = None,
        search: Optional[str] = None,
        top_n: Optional[int] = None,
    ) -> ContactFrequencyResult:
        """
        Aggregate contacts from the CDR DataFrame.
        Optional date/time range narrows the analysis window.
        """
        from .record_normalizer import apply_time_filter

        # Apply optional time filter
        work_df = apply_time_filter(df, date_from, date_to, time_from, time_to)

        # Keep only real contact interactions (not service senders)
        contact_df = work_df[
            work_df["contact_number"].notna() &
            (work_df["direction"] != "service")
        ].copy()

        if contact_df.empty:
            return ContactFrequencyResult(
                owner_phone=owner_phone,
                total_contacts=0,
                total_interactions=0,
                contacts=[],
                mutual_contacts=[],
            )

        # Apply optional text search on contact_number
        if search:
            contact_df = contact_df[
                contact_df["contact_number"].str.contains(search, na=False)
            ]

        # Aggregate per contact number
        agg = (
            contact_df
            .groupby("contact_number", sort=False)
            .agg(
                total_count       = ("direction",   "count"),
                outgoing_count    = ("direction",   lambda x: (x == "outgoing").sum()),
                incoming_count    = ("direction",   lambda x: (x == "incoming").sum()),
                voice_count       = ("comm_type",   lambda x: (x == "VOICE").sum()),
                sms_count         = ("comm_type",   lambda x: (x == "SMS").sum()),
                first_interaction = ("timestamp",   "min"),
                last_interaction  = ("timestamp",   "max"),
            )
            .reset_index()
            .sort_values("total_count", ascending=False)
        )

        if top_n is not None:
            agg = agg.head(top_n)

        # Build result items
        items: list[ContactFrequencyItem] = []
        mutual: list[str] = []

        for _, row in agg.iterrows():
            phone = str(row["contact_number"])
            carrier = detect_carrier(phone)
            is_mutual = (
                self._to_py_int(row["outgoing_count"]) > 0 and
                self._to_py_int(row["incoming_count"]) > 0
            )
            if is_mutual:
                mutual.append(phone)

            items.append(ContactFrequencyItem(
                contact_number=phone,
                carrier=carrier,
                total_count=self._to_py_int(row["total_count"]),
                outgoing_count=self._to_py_int(row["outgoing_count"]),
                incoming_count=self._to_py_int(row["incoming_count"]),
                voice_count=self._to_py_int(row["voice_count"]),
                sms_count=self._to_py_int(row["sms_count"]),
                first_interaction=(
                    row["first_interaction"].to_pydatetime()
                    if pd.notna(row["first_interaction"]) else None
                ),
                last_interaction=(
                    row["last_interaction"].to_pydatetime()
                    if pd.notna(row["last_interaction"]) else None
                ),
            ))

        return ContactFrequencyResult(
            owner_phone=owner_phone,
            total_contacts=len(items),
            total_interactions=int(contact_df.shape[0]),
            contacts=items,
            mutual_contacts=mutual,
        )

    # -------------------------------------------------------------------
    # Convenience overload matching the service-layer signature
    # -------------------------------------------------------------------

    def analyze(
        self,
        df: pd.DataFrame,
        owner_phone: str,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        time_from: Optional[str] = None,
        time_to: Optional[str] = None,
        search: Optional[str] = None,
        top_n: Optional[int] = None,
    ) -> ContactFrequencyResult:
        return self._analyze_dataframe(
            df, owner_phone,
            date_from=date_from, date_to=date_to,
            time_from=time_from, time_to=time_to,
            search=search, top_n=top_n,
        )

    def get_top_contacts(
        self, df: pd.DataFrame, owner_phone: str, n: int = 10
    ) -> list[ContactFrequencyItem]:
        result = self._analyze_dataframe(df, owner_phone, top_n=n)
        return result.contacts

    def get_mutual_contacts(
        self, df: pd.DataFrame, owner_phone: str
    ) -> list[str]:
        result = self._analyze_dataframe(df, owner_phone)
        return result.mutual_contacts
