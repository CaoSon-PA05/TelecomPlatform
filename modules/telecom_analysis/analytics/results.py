"""
Typed result dataclasses for all in-memory analytics engines.
These are plain Python dataclasses — no DB dependency, no Pydantic.
They are produced by the analytics engines and consumed by the service layer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


# ---------------------------------------------------------------------------
# Contact frequency
# ---------------------------------------------------------------------------

@dataclass
class ContactFrequencyItem:
    contact_number:    str
    carrier:           str            # viettel / vina / mobi / unknown
    total_count:       int
    outgoing_count:    int
    incoming_count:    int
    voice_count:       int
    sms_count:         int
    first_interaction: Optional[datetime]
    last_interaction:  Optional[datetime]


@dataclass
class ContactFrequencyResult:
    owner_phone:        str
    total_contacts:     int
    total_interactions: int
    contacts:           list[ContactFrequencyItem]   # sorted by total_count desc
    mutual_contacts:    list[str] = field(default_factory=list)   # both in + out


# ---------------------------------------------------------------------------
# Repeated communication (burst detection)
# ---------------------------------------------------------------------------

@dataclass
class BurstPattern:
    contact_number:    str
    burst_start:       datetime
    burst_end:         datetime
    interaction_count: int
    comm_types:        list[str]    # VOICE / SMS seen in burst


@dataclass
class RepeatedCommResult:
    owner_phone:                str
    bursts:                     list[BurstPattern]
    mutual_contacts:            list[str]     # contacts with both in + out
    high_frequency_contacts:    list[str]     # top-N contacts by count
    total_contacts_analyzed:    int


# ---------------------------------------------------------------------------
# IMEI / device
# ---------------------------------------------------------------------------

@dataclass
class IMEIFrequencyItem:
    imei:             str
    is_valid:         bool
    frequency:        int
    first_seen:       Optional[datetime]
    last_seen:        Optional[datetime]


@dataclass
class DeviceSwap:
    sequence:     int
    imei:         str
    first_seen:   datetime
    last_seen:    datetime
    record_count: int


@dataclass
class IMEIAnalyticsResult:
    owner_phone:   str
    devices:       list[IMEIFrequencyItem]   # sorted by first_seen
    swaps:         list[DeviceSwap]           # chronological swap events
    unique_count:  int
    valid_count:   int
    has_swaps:     bool


# ---------------------------------------------------------------------------
# Location / Cell-LAC
# ---------------------------------------------------------------------------

@dataclass
class TowerVisit:
    lac:               int
    cell_id:           int
    tower_key:         str
    province_code_raw: Optional[str]
    province_name:     Optional[str]
    bts_address:       Optional[str]
    total_count:       int
    first_seen:        Optional[datetime]
    last_seen:         Optional[datetime]
    contacts_here:     list[str] = field(default_factory=list)


@dataclass
class MovementStep:
    timestamp:     datetime
    comm_type:     str
    direction:     str
    contact_number: Optional[str]
    lac:           int
    cell_id:       int
    tower_key:     str
    province_name: Optional[str]
    bts_address:   Optional[str]
    is_transition: bool    # True when tower changed from previous step


@dataclass
class LocationAnalyticsResult:
    owner_phone:    str
    towers:         list[TowerVisit]       # sorted by total_count desc
    timeline:       list[MovementStep]     # chronological movement
    unique_towers:  int
    total_events:   int


# ---------------------------------------------------------------------------
# Time patterns
# ---------------------------------------------------------------------------

@dataclass
class HourlyBucket:
    hour:           int     # 0–23
    total_count:    int
    voice_count:    int
    sms_count:      int
    outgoing_count: int
    incoming_count: int


@dataclass
class DailyBucket:
    day_of_week:    int     # 0=Monday … 6=Sunday
    day_label:      str     # Mon, Tue, …
    total_count:    int
    voice_count:    int
    sms_count:      int


@dataclass
class TimePatternResult:
    owner_phone:    str
    hourly:         list[HourlyBucket]   # 24 items, hours 0–23
    weekly:         list[DailyBucket]    # 7 items, days 0–6
    peak_hour:      Optional[int]
    peak_day:       Optional[int]
    total_records:  int


# ---------------------------------------------------------------------------
# Communication frequency (overall stats)
# ---------------------------------------------------------------------------

@dataclass
class MessageClassification:
    onnet:         int   # Nội mạng
    offnet:        int   # Ngoại mạng
    vas:           int   # Value-added service
    international: int   # Quốc tế
    unknown:       int


@dataclass
class CommFrequencyResult:
    owner_phone:            str
    total_records:          int
    voice_count:            int
    sms_count:              int
    outgoing_count:         int
    incoming_count:         int
    service_count:          int
    avg_voice_duration_sec: float
    max_voice_duration_sec: int
    message_classification: MessageClassification
    daily_activity:         dict[str, int]   # date string → count
    voice_ratio:            float            # 0.0–1.0


# ---------------------------------------------------------------------------
# Cross-subscriber comparison
# ---------------------------------------------------------------------------

@dataclass
class SharedContact:
    contact_number:  str
    carrier:         str
    shared_by:       int              # number of subscribers sharing this contact
    owner_phones:    list[str]
    frequencies:     dict[str, int]   # owner_phone → interaction count


@dataclass
class SharedDevice:
    imei:         str
    shared_by:    int
    owner_phones: list[str]


@dataclass
class SharedTower:
    lac:           int
    cell_id:       int
    tower_key:     str
    province_name: Optional[str]
    bts_address:   Optional[str]
    shared_by:     int
    owner_phones:  list[str]
    frequencies:   dict[str, int]   # owner_phone → visit count


@dataclass
class CrossSubscriberResult:
    compare_type:        str        # contacts / imei / location
    subscriber_phones:   list[str]
    shared_contacts:     list[SharedContact] = field(default_factory=list)
    shared_devices:      list[SharedDevice]  = field(default_factory=list)
    shared_towers:       list[SharedTower]   = field(default_factory=list)
    total_shared:        int = 0


# ---------------------------------------------------------------------------
# Subscriber summary (aggregator output)
# ---------------------------------------------------------------------------

@dataclass
class SubscriberSummary:
    owner_phone:        str
    carrier:            str
    full_name:          Optional[str]
    date_range_from:    Optional[datetime]
    date_range_to:      Optional[datetime]
    total_records:      int
    unique_contacts:    int
    unique_towers:      int
    unique_imei:        int
    voice_count:        int
    sms_count:          int
    outgoing_count:     int
    incoming_count:     int
    service_count:      int
    avg_daily_activity: float
    peak_hour:          Optional[int]
    peak_day:           Optional[int]
    has_device_swaps:   bool
