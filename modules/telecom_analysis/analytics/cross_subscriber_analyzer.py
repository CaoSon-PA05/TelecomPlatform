"""
Cross-subscriber forensic analysis — shared contacts, devices, and locations.

Input: a dict of {owner_phone: pd.DataFrame} — one per subscriber file.
All comparisons use last-9-digit normalization to handle 0xxx/84xxx variants.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Optional

import pandas as pd

from ..utils.phone_utils import detect_carrier, get_last_9_digits
from .base_analyzer import BaseAnalyzer
from .results import CrossSubscriberResult, SharedContact, SharedDevice, SharedTower


class CrossSubscriberAnalyzer(BaseAnalyzer):

    def _analyze_dataframe(self, df: pd.DataFrame, owner_phone: str):
        raise NotImplementedError("Use compare() with multiple DataFrames.")

    def compare(
        self,
        subscriber_dfs: dict[str, pd.DataFrame],
        compare_type: str = "contacts",
        subscriber_ids: Optional[list[str]] = None,
    ) -> CrossSubscriberResult:
        """
        Args:
            subscriber_dfs:  {owner_phone → CDR DataFrame}
            compare_type:    'contacts' | 'imei' | 'location' | 'all'
            subscriber_ids:  if provided, restrict to these owner phones
        """
        phones = list(subscriber_dfs.keys())
        if subscriber_ids:
            phones = [p for p in phones if p in subscriber_ids]
        if len(phones) < 2:
            return CrossSubscriberResult(compare_type=compare_type, subscriber_phones=phones)

        selected = {p: subscriber_dfs[p] for p in phones}
        result   = CrossSubscriberResult(compare_type=compare_type, subscriber_phones=phones)
        if compare_type in ("contacts", "all"):
            result.shared_contacts = self._find_shared_contacts(selected)
        if compare_type in ("imei", "all"):
            result.shared_devices  = self._find_shared_devices(selected)
        if compare_type in ("location", "all"):
            result.shared_towers   = self._find_shared_towers(selected)
        result.total_shared = (
            len(result.shared_contacts) + len(result.shared_devices) + len(result.shared_towers)
        )
        return result

    def _find_shared_contacts(self, dfs: dict[str, pd.DataFrame]) -> list[SharedContact]:
        last9_owners: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for owner, df in dfs.items():
            contact_df = df[df["contact_number"].notna() & (df["direction"] != "service")]
            for phone in contact_df["contact_number"].dropna():
                last9 = get_last_9_digits(str(phone))
                if last9 and len(last9) == 9:
                    last9_owners[last9][owner] += 1
        shared = []
        for last9, owners in last9_owners.items():
            if len(owners) < 2:
                continue
            canonical = "0" + last9
            shared.append(SharedContact(
                contact_number=canonical, carrier=detect_carrier(canonical),
                shared_by=len(owners), owner_phones=sorted(owners.keys()),
                frequencies=dict(owners),
            ))
        return sorted(shared, key=lambda x: (-x.shared_by, -sum(x.frequencies.values())))

    def _find_shared_devices(self, dfs: dict[str, pd.DataFrame]) -> list[SharedDevice]:
        imei_owners: dict[str, set[str]] = defaultdict(set)
        for owner, df in dfs.items():
            for imei in df[df["imei"].notna() & (df["imei"] != "")]["imei"].unique():
                imei_owners[str(imei)].add(owner)
        return sorted(
            [SharedDevice(imei=i, shared_by=len(o), owner_phones=sorted(o))
             for i, o in imei_owners.items() if len(o) >= 2],
            key=lambda x: -x.shared_by,
        )

    def _find_shared_towers(self, dfs: dict[str, pd.DataFrame]) -> list[SharedTower]:
        tower_meta: dict[str, dict] = {}
        for owner, df in dfs.items():
            for _, row in df[df["tower_key"].notna()].iterrows():
                key = str(row["tower_key"])
                if key not in tower_meta:
                    tower_meta[key] = {
                        "owners": defaultdict(int), "lac": row.get("lac"),
                        "cell_id": row.get("cell_id"), "province_name": row.get("province_name"),
                        "bts_address": row.get("bts_address"),
                    }
                tower_meta[key]["owners"][owner] += 1
        shared = []
        for key, meta in tower_meta.items():
            owners = meta["owners"]
            if len(owners) >= 2:
                shared.append(SharedTower(
                    lac=int(meta["lac"]) if meta["lac"] is not None else 0,
                    cell_id=int(meta["cell_id"]) if meta["cell_id"] is not None else 0,
                    tower_key=key, province_name=meta["province_name"],
                    bts_address=meta["bts_address"], shared_by=len(owners),
                    owner_phones=sorted(owners.keys()), frequencies=dict(owners),
                ))
        return sorted(shared, key=lambda x: (-x.shared_by, -sum(x.frequencies.values())))

    def find_shared_contacts(self, dfs: dict[str, pd.DataFrame], subscriber_ids=None):
        return self.compare(dfs, "contacts", subscriber_ids).shared_contacts

    def find_shared_devices(self, dfs: dict[str, pd.DataFrame], subscriber_ids=None):
        return self.compare(dfs, "imei", subscriber_ids).shared_devices

    def find_shared_towers(self, dfs: dict[str, pd.DataFrame], subscriber_ids=None):
        return self.compare(dfs, "location", subscriber_ids).shared_towers
