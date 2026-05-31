"""
Re-export all Pydantic schemas from modules/telecom_analysis/schemas/.
Import from here so routes stay decoupled from the module's internal layout.
"""

from modules.telecom_analysis.schemas import (
    # Subscriber
    RawSubscriberInfo,
    SubscriberCreate,
    SubscriberResponse,
    SubscriberUpdate,
    # CDR
    RawCDRRecord,
    CDRRecordCreate,
    CDRRecordResponse,
    CDRFilterParams,
    # Contact
    ContactProfileResponse,
    ContactAnnotationUpdate,
    SharedContactResult,
    SharedIMEIResult,
    SharedTowerResult,
    # Analytics
    ActivityReport,
    HourlyActivityPoint,
    WeeklyActivityPoint,
    TowerFrequencyItem,
    IMEIItem,
    DeviceSwapEvent,
    MovementPoint,
    # Import
    ImportRequest,
    ImportBatchResponse,
    ImportResult,
    ColumnMapDiagnostic,
)

__all__ = [
    "RawSubscriberInfo", "SubscriberCreate", "SubscriberResponse", "SubscriberUpdate",
    "RawCDRRecord", "CDRRecordCreate", "CDRRecordResponse", "CDRFilterParams",
    "ContactProfileResponse", "ContactAnnotationUpdate",
    "SharedContactResult", "SharedIMEIResult", "SharedTowerResult",
    "ActivityReport", "HourlyActivityPoint", "WeeklyActivityPoint",
    "TowerFrequencyItem", "IMEIItem", "DeviceSwapEvent", "MovementPoint",
    "ImportRequest", "ImportBatchResponse", "ImportResult", "ColumnMapDiagnostic",
]
