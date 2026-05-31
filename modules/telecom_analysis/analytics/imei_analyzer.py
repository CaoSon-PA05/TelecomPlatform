"""
IMEI / device analytics.

Answers:
- How many unique devices did the subscriber use?
- Which IMEI was used most frequently?
- Did the subscriber swap devices (multiple IMEI → device swap events)?
- When was each device first and last used?
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd

from ..utils.constants import IMEI_LENGTH
from .base_analyzer import BaseAnalyzer
from .results import DeviceSwap, IMEIAnalyticsResult, IMEIFrequencyItem


class IMEIAnalyzer(BaseAnalyzer):

    def _analyze_dataframe(
        self,
        df: pd.DataFrame,
        owner_phone: str,
    ) -> IMEIAnalyticsResult:
        """
        Aggregate IMEI data from the CDR DataFrame.
        Detects device swaps by tracking first/last seen per IMEI.
        """
        # Only rows with a valid IMEI
        imei_df = df[df["imei"].notna() & (df["imei"] != "")].copy()

        if imei_df.empty:
            return IMEIAnalyticsResult(
                owner_phone=owner_phone,
                devices=[], swaps=[],
                unique_count=0, valid_count=0, has_swaps=False,
            )

        # Aggregate per IMEI
        agg = (
            imei_df
            .groupby("imei", sort=False)
            .agg(
                frequency  = ("imei", "count"),
                first_seen = ("timestamp", "min"),
                last_seen  = ("timestamp", "max"),
            )
            .reset_index()
            .sort_values("first_seen")  # chronological order for swap detection
        )

        devices: list[IMEIFrequencyItem] = []
        for _, row in agg.iterrows():
            imei = str(row["imei"])
            is_valid = len(imei) == IMEI_LENGTH and imei.isdigit()

            devices.append(IMEIFrequencyItem(
                imei=imei,
                is_valid=is_valid,
                frequency=self._to_py_int(row["frequency"]),
                first_seen=(
                    row["first_seen"].to_pydatetime()
                    if pd.notna(row["first_seen"]) else None
                ),
                last_seen=(
                    row["last_seen"].to_pydatetime()
                    if pd.notna(row["last_seen"]) else None
                ),
            ))

        # Build device swap timeline
        swaps: list[DeviceSwap] = [
            DeviceSwap(
                sequence=i + 1,
                imei=d.imei,
                first_seen=d.first_seen,
                last_seen=d.last_seen,
                record_count=d.frequency,
            )
            for i, d in enumerate(devices)
            if d.first_seen is not None
        ]

        valid_count = sum(1 for d in devices if d.is_valid)

        return IMEIAnalyticsResult(
            owner_phone=owner_phone,
            devices=devices,
            swaps=swaps,
            unique_count=len(devices),
            valid_count=valid_count,
            has_swaps=len(devices) > 1,
        )

    def analyze(
        self, df: pd.DataFrame, owner_phone: str
    ) -> IMEIAnalyticsResult:
        return self._analyze_dataframe(df, owner_phone)

    def get_device_swaps(
        self, df: pd.DataFrame, owner_phone: str
    ) -> list[DeviceSwap]:
        return self._analyze_dataframe(df, owner_phone).swaps

    def get_unique_count(self, df: pd.DataFrame) -> int:
        imei_df = df[df["imei"].notna() & (df["imei"] != "")]
        return imei_df["imei"].nunique()

    def get_valid_count(self, df: pd.DataFrame) -> int:
        imei_df = df[df["imei"].notna() & (df["imei"] != "")]
        return int(
            imei_df["imei"]
            .apply(lambda x: len(str(x)) == IMEI_LENGTH and str(x).isdigit())
            .sum()
        )
