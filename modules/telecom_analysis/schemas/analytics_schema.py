"""Pydantic schemas for analytics results — charts, stats, IMEI, location."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HourlyActivityPoint(BaseModel):
    hour_of_day:    int   # 0–23
    total_count:    int
    voice_count:    int
    sms_count:      int
    outgoing_count: int
    incoming_count: int


class WeeklyActivityPoint(BaseModel):
    day_of_week:  int     # 0=Monday … 6=Sunday
    day_label:    str     # 'Mon', 'Tue', etc.
    total_count:  int
    voice_count:  int
    sms_count:    int


class ActivityReport(BaseModel):
    subscriber_id: int
    hourly:        list[HourlyActivityPoint]
    weekly:        list[WeeklyActivityPoint]
    peak_hour:     Optional[int] = None
    peak_day:      Optional[int] = None


class TowerFrequencyItem(BaseModel):
    id:            int
    lac:           int
    cell_id:       int
    province_name: Optional[str] = None
    bts_address:   Optional[str] = None
    latitude:      Optional[float] = None
    longitude:     Optional[float] = None
    google_maps_url: Optional[str] = None
    total_count:   int
    first_seen_at: Optional[datetime] = None
    last_seen_at:  Optional[datetime] = None


class IMEIItem(BaseModel):
    imei:              str
    is_valid:          bool
    device_model:      Optional[str] = None
    manufacturer:      Optional[str] = None
    interaction_count: int
    first_seen_at:     Optional[datetime] = None
    last_seen_at:      Optional[datetime] = None
    notes:             Optional[str] = None


class DeviceSwapEvent(BaseModel):
    """Represents one IMEI in the device swap timeline."""
    sequence:     int
    imei:         str
    device_model: Optional[str] = None
    first_seen_at: datetime
    last_seen_at:  datetime


class MovementPoint(BaseModel):
    """One step in the subscriber movement timeline."""
    recorded_at:   datetime
    comm_type:     str
    direction:     str
    contact_number: Optional[str] = None
    lac:           int
    cell_id:       int
    province_name: Optional[str] = None
    bts_address:   Optional[str] = None
    latitude:      Optional[float] = None
    longitude:     Optional[float] = None
    is_transition: bool = False   # location changed from previous record
