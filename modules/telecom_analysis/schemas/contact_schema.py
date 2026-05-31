"""Pydantic schemas for contact profiles and cross-subscriber comparison."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ContactProfileResponse(BaseModel):
    """API response for one contact in the Contacts tab."""
    id:                   int
    subscriber_id:        int
    contact_phone:        str
    carrier:              Optional[str] = None
    total_count:          int
    outgoing_count:       int
    incoming_count:       int
    voice_count:          int
    sms_count:            int
    first_interaction_at: Optional[datetime] = None
    last_interaction_at:  Optional[datetime] = None
    zalo_id:              Optional[str] = None
    facebook_url:         Optional[str] = None
    telegram_id:          Optional[str] = None
    notes:                Optional[str] = None

    model_config = {"from_attributes": True}


class ContactAnnotationUpdate(BaseModel):
    """Investigator-supplied annotation fields — preserved across recomputes."""
    zalo_id:      Optional[str] = None
    facebook_url: Optional[str] = None
    telegram_id:  Optional[str] = None
    notes:        Optional[str] = None


class SharedContactResult(BaseModel):
    """One row in the cross-subscriber shared-contacts analysis."""
    contact_phone:      str
    carrier:            Optional[str] = None
    shared_by:          int                     # number of subscribers sharing this contact
    owner_phones:       list[str]
    total_interactions: int


class SharedIMEIResult(BaseModel):
    """One row in the cross-subscriber shared-IMEI analysis."""
    imei:         str
    device_model: Optional[str] = None
    shared_by:    int
    owner_phones: list[str]


class SharedTowerResult(BaseModel):
    """One row in the cross-subscriber shared-location analysis."""
    lac:           int
    cell_id:       int
    province_name: Optional[str] = None
    bts_address:   Optional[str] = None
    shared_by:     int
    owner_phones:  list[str]
