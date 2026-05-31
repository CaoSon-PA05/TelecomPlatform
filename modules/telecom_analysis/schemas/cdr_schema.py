"""Pydantic schemas for CDR records."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RawCDRRecord(BaseModel):
    """Direct output from a parser row — no normalization applied yet."""
    source_file_row:      int
    source_number_raw:    str
    target_number_raw:    str
    timestamp_raw:        Optional[str] = None
    duration_raw:         Optional[str] = None
    imei_raw:             Optional[str] = None
    province_code_raw:    Optional[str] = None
    comm_type_raw:        Optional[str] = None
    service_direction_raw: Optional[str] = None
    bts_address_raw:      Optional[str] = None
    lac_raw:              Optional[str] = None
    cell_id_raw:          Optional[str] = None


class CDRRecordCreate(BaseModel):
    """Normalized, validated record ready for database insertion."""
    subscriber_id:        int
    batch_id:             int
    source_file_row:      int
    source_number_raw:    str
    target_number_raw:    str
    owner_phone:          str
    contact_number:       Optional[str] = None
    direction:            str                       # outgoing / incoming / service
    recorded_at:          datetime
    duration_seconds:     Optional[int] = None
    comm_type:            str                       # VOICE / SMS
    service_direction_raw: Optional[str] = None
    service_category:     Optional[str] = None
    device_id:            Optional[int] = None
    province_code_raw:    Optional[str] = None
    tower_id:             Optional[int] = None


class CDRRecordResponse(CDRRecordCreate):
    """API response — adds id and created_at."""
    id:         int
    created_at: datetime

    model_config = {"from_attributes": True}


class CDRFilterParams(BaseModel):
    """Query parameters for CDR history filtering (maps to Tab 2 UI)."""
    date_from:      Optional[datetime] = None
    date_to:        Optional[datetime] = None
    time_from:      Optional[str] = None            # 'HH:MM'
    time_to:        Optional[str] = None
    comm_type:      Optional[str] = None            # VOICE / SMS / None (all)
    direction:      Optional[str] = None
    contact_number: Optional[str] = None
    search_text:    Optional[str] = None
    page:           int = Field(default=1, ge=1)
    page_size:      int = Field(default=50, ge=1, le=500)
