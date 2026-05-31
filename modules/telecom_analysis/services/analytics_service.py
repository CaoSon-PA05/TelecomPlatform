"""
Analytics Service — façade over all analyzer classes.
FastAPI route handlers call this instead of instantiating analyzers directly.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from ..analytics import (
    ContactAnalyzer,
    CrossSubscriberAnalyzer,
    IMEIAnalyzer,
    LocationAnalyzer,
    TimePatternAnalyzer,
)
from ..schemas.analytics_schema import (
    ActivityReport,
    DeviceSwapEvent,
    IMEIItem,
    MovementPoint,
    TowerFrequencyItem,
)
from ..schemas.contact_schema import (
    ContactAnnotationUpdate,
    ContactProfileResponse,
    SharedContactResult,
    SharedIMEIResult,
    SharedTowerResult,
)
from ..schemas.cdr_schema import CDRFilterParams, CDRRecordResponse


class AnalyticsService:

    def __init__(self, db: Session) -> None:
        self.db = db
        self._contact  = ContactAnalyzer(db)
        self._imei     = IMEIAnalyzer(db)
        self._time     = TimePatternAnalyzer(db)
        self._location = LocationAnalyzer(db)
        self._cross    = CrossSubscriberAnalyzer(db)

    # ------------------------------------------------------------------
    # Tab 2: Call history
    # ------------------------------------------------------------------

    def get_call_history(
        self, subscriber_id: int, filters: CDRFilterParams
    ) -> tuple[list[CDRRecordResponse], int]:
        """Return filtered, paginated CDR records for Tab 2."""
        ...

    # ------------------------------------------------------------------
    # Tab 3: Contacts
    # ------------------------------------------------------------------

    def get_contacts(
        self,
        subscriber_id: int,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[ContactProfileResponse], int]:
        ...

    def update_contact_annotation(
        self, subscriber_id: int, contact_phone: str, data: ContactAnnotationUpdate
    ) -> ContactProfileResponse:
        """Update investigator notes for one contact (preserved across recomputes)."""
        ...

    # ------------------------------------------------------------------
    # Tab 4: IMEI
    # ------------------------------------------------------------------

    def get_imei_list(
        self, subscriber_id: int, search: str = "", valid_only: bool = False
    ) -> list[IMEIItem]:
        ...

    def get_device_swap_timeline(
        self, subscriber_id: int
    ) -> list[DeviceSwapEvent]:
        ...

    # ------------------------------------------------------------------
    # Tab 5: Location
    # ------------------------------------------------------------------

    def get_location_frequency(
        self,
        subscriber_id: int,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        contact_number: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[TowerFrequencyItem], int]:
        ...

    def get_movement_timeline(
        self, subscriber_id: int,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> list[MovementPoint]:
        ...

    # ------------------------------------------------------------------
    # Tab 6: Reports
    # ------------------------------------------------------------------

    def get_activity_report(self, subscriber_id: int) -> ActivityReport:
        ...

    # ------------------------------------------------------------------
    # Tab 8: Cross-subscriber comparison
    # ------------------------------------------------------------------

    def find_shared_contacts(
        self, subscriber_ids: Optional[list[int]] = None
    ) -> list[SharedContactResult]:
        return self._cross.find_shared_contacts(subscriber_ids)

    def find_shared_devices(
        self, subscriber_ids: Optional[list[int]] = None
    ) -> list[SharedIMEIResult]:
        return self._cross.find_shared_devices(subscriber_ids)

    def find_shared_locations(
        self, subscriber_ids: Optional[list[int]] = None
    ) -> list[SharedTowerResult]:
        return self._cross.find_shared_locations(subscriber_ids)

    def compare_selected(
        self, subscriber_ids: list[int], compare_type: str
    ) -> list:
        return self._cross.compare_selected_subscribers(subscriber_ids, compare_type)
