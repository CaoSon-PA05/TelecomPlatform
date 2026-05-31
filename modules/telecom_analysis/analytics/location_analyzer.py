"""
Cell-tower / location analytics + movement timeline.

Answers:
- Which cell towers did the subscriber use most frequently?
- What was the subscriber's movement pattern (location timeline)?
- Which contacts were reached from each tower?
- Filter by date/time window or by specific contact number.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import pandas as pd

from .base_analyzer import BaseAnalyzer
from .results import LocationAnalyticsResult, MovementStep, TowerVisit


class LocationAnalyzer(BaseAnalyzer):

    def _analyze_dataframe(
        self,
        df: pd.DataFrame,
        owner_phone: str,
        *,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        time_from: Optional[str] = None,
        time_to: Optional[str] = None,
        contact_filter: Optional[str] = None,
        search: Optional[str] = None,
    ) -> LocationAnalyticsResult:
        from .record_normalizer import apply_contact_filter, apply_time_filter

        # Apply optional filters
        work_df = apply_time_filter(df, date_from, date_to, time_from, time_to)
        if contact_filter:
            work_df = apply_contact_filter(work_df, contact_filter)

        # Restrict to rows with location data
        loc_df = work_df[work_df["tower_key"].notna()].copy()

        if loc_df.empty:
            return LocationAnalyticsResult(
                owner_phone=owner_phone,
                towers=[], timeline=[],
                unique_towers=0, total_events=0,
            )

        # ---- Tower frequency aggregation ----
        tower_agg = (
            loc_df
            .groupby(
                ["tower_key", "lac", "cell_id", "province_code_raw",
                 "province_name", "bts_address"],
                dropna=False,
            )
            .agg(
                total_count = ("tower_key", "count"),
                first_seen  = ("timestamp", "min"),
                last_seen   = ("timestamp", "max"),
            )
            .reset_index()
            .sort_values("total_count", ascending=False)
        )

        # Build contacts-per-tower lookup
        contacts_by_tower: dict[str, list[str]] = {}
        if "contact_number" in loc_df.columns:
            ctower = (
                loc_df[loc_df["contact_number"].notna()]
                .groupby("tower_key")["contact_number"]
                .apply(lambda s: sorted(s.unique().tolist()))
                .to_dict()
            )
            contacts_by_tower = ctower

        towers: list[TowerVisit] = []
        for _, row in tower_agg.iterrows():
            tkey = str(row["tower_key"])

            # Apply text search filter
            if search:
                searchable = " ".join(
                    str(row.get(c, "") or "") for c in
                    ("bts_address", "province_name", "tower_key")
                ).lower()
                if search.lower() not in searchable:
                    continue

            towers.append(TowerVisit(
                lac=self._to_py_int(row["lac"]),
                cell_id=self._to_py_int(row["cell_id"]),
                tower_key=tkey,
                province_code_raw=row.get("province_code_raw") or None,
                province_name=row.get("province_name") or None,
                bts_address=row.get("bts_address") or None,
                total_count=self._to_py_int(row["total_count"]),
                first_seen=(
                    row["first_seen"].to_pydatetime()
                    if pd.notna(row["first_seen"]) else None
                ),
                last_seen=(
                    row["last_seen"].to_pydatetime()
                    if pd.notna(row["last_seen"]) else None
                ),
                contacts_here=contacts_by_tower.get(tkey, []),
            ))

        # ---- Movement timeline ----
        timeline = self._build_timeline(loc_df)

        return LocationAnalyticsResult(
            owner_phone=owner_phone,
            towers=towers,
            timeline=timeline,
            unique_towers=int(loc_df["tower_key"].nunique()),
            total_events=len(loc_df),
        )

    # -------------------------------------------------------------------
    # Movement timeline
    # -------------------------------------------------------------------

    def _build_timeline(self, loc_df: pd.DataFrame) -> list[MovementStep]:
        """
        Build a chronological sequence of location events.
        is_transition=True marks the first record at a new tower.
        """
        if loc_df.empty:
            return []

        sorted_df = loc_df.sort_values("timestamp", na_position="last")
        steps: list[MovementStep] = []
        prev_tower: Optional[str] = None

        for _, row in sorted_df.iterrows():
            if pd.isna(row.get("timestamp")):
                continue

            tower = str(row["tower_key"])
            is_transition = tower != prev_tower
            prev_tower = tower

            steps.append(MovementStep(
                timestamp=row["timestamp"].to_pydatetime(),
                comm_type=str(row.get("comm_type", "SMS")),
                direction=str(row.get("direction", "unknown")),
                contact_number=(
                    str(row["contact_number"])
                    if pd.notna(row.get("contact_number")) else None
                ),
                lac=self._to_py_int(row["lac"]),
                cell_id=self._to_py_int(row["cell_id"]),
                tower_key=tower,
                province_name=row.get("province_name") or None,
                bts_address=row.get("bts_address") or None,
                is_transition=is_transition,
            ))

        return steps

    # -------------------------------------------------------------------
    # Convenience
    # -------------------------------------------------------------------

    def analyze(
        self,
        df: pd.DataFrame,
        owner_phone: str,
        **kwargs,
    ) -> LocationAnalyticsResult:
        return self._analyze_dataframe(df, owner_phone, **kwargs)

    def get_top_towers(
        self, df: pd.DataFrame, owner_phone: str, n: int = 10
    ) -> list[TowerVisit]:
        result = self._analyze_dataframe(df, owner_phone)
        return result.towers[:n]

    def get_movement_timeline(
        self,
        df: pd.DataFrame,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> list[MovementStep]:
        from .record_normalizer import apply_time_filter
        loc_df = apply_time_filter(df, date_from, date_to)
        loc_df = loc_df[loc_df["tower_key"].notna()]
        return self._build_timeline(loc_df)

    def count_location_transitions(self, df: pd.DataFrame) -> int:
        """Count distinct tower-to-tower transitions (location changes)."""
        timeline = self.get_movement_timeline(df)
        return sum(1 for step in timeline if step.is_transition)
