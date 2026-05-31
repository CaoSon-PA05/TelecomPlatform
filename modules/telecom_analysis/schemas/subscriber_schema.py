"""Pydantic schemas for subscriber data — raw (from parser) and API response."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class RawSubscriberInfo(BaseModel):
    """Unvalidated output from a parser — all fields optional."""
    phone_raw:          Optional[str] = None
    phone_normalized:   Optional[str] = None
    full_name:          Optional[str] = None
    date_of_birth:      Optional[str] = None   # raw string before date parsing
    address:            Optional[str] = None
    id_doc_type:        Optional[str] = None
    id_doc_number:      Optional[str] = None
    id_issue_date:      Optional[str] = None
    id_issue_authority: Optional[str] = None
    activation_date:    Optional[str] = None
    subscription_type:  Optional[str] = None   # 'Tra truoc' / 'Tra sau'
    account_status:     Optional[str] = None
    document_ref:       Optional[str] = None
    report_from:        Optional[str] = None
    report_to:          Optional[str] = None


class SubscriberCreate(BaseModel):
    """Validated input for creating a subscriber record in the database."""
    phone_normalized:   str
    phone_raw:          Optional[str] = None
    carrier:            str = "unknown"
    full_name:          Optional[str] = None
    date_of_birth:      Optional[date] = None
    address:            Optional[str] = None
    id_doc_type:        Optional[str] = None
    id_doc_number:      Optional[str] = None
    id_issue_date:      Optional[date] = None
    id_issue_authority: Optional[str] = None
    activation_date:    Optional[date] = None
    subscription_type:  Optional[str] = None
    account_status:     Optional[str] = None
    notes:              Optional[str] = None


class SubscriberResponse(SubscriberCreate):
    """API response schema — includes DB-assigned id and timestamps."""
    id:         int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubscriberUpdate(BaseModel):
    """Partial update — all fields optional."""
    full_name:          Optional[str] = None
    address:            Optional[str] = None
    notes:              Optional[str] = None
    account_status:     Optional[str] = None
