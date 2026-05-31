"""Pydantic schemas for the file import pipeline."""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ImportRequest(BaseModel):
    """Initiates a file import job."""
    filename:          str
    template_override: Optional[str] = None   # force 'viettel'|'vina'|'mobi'; None = auto


class ImportBatchResponse(BaseModel):
    id:               int
    subscriber_id:    int
    source_file_name: str
    document_ref:     Optional[str] = None
    report_period_from: Optional[date] = None
    report_period_to:   Optional[date] = None
    template_detected:  Optional[str] = None
    total_records:      Optional[int] = None
    import_status:      str
    error_message:      Optional[str] = None
    imported_at:        datetime

    model_config = {"from_attributes": True}


class ImportResult(BaseModel):
    """Returned to the caller after a completed import."""
    batch_id:          int
    subscriber_id:     int
    phone_normalized:  str
    template_used:     str
    records_imported:  int
    missing_columns:   list[str] = []
    warnings:          list[str] = []
    success:           bool


class ColumnMapDiagnostic(BaseModel):
    """Returned when column detection finds problems — shown in import errors UI."""
    filename:        str
    missing_required: list[str]
    warnings:        list[str]
    mapped_columns:  dict[str, int]   # field_name → column_index
