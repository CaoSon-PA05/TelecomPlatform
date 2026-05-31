"""
Pydantic response schemas for the upload API.
These define the exact JSON shape returned by POST /imports/upload.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ValidationSummaryOut(BaseModel):
    valid:    bool
    errors:   list[str]
    warnings: list[str]


class SheetInfoOut(BaseModel):
    name:      str
    row_count: int
    col_count: int
    headers:   list[str]
    is_cdr:    bool


class UploadResponseData(BaseModel):
    """Payload for a single successful upload."""
    upload_id:          str
    original_filename:  str
    stored_as:          str
    file_size_bytes:    int
    file_size_kb:       float
    extension:          str
    uploaded_at:        str
    detected_phone:     Optional[str]
    detected_carrier:   Optional[str]
    sheet_names:        list[str]
    sheets:             list[SheetInfoOut]
    primary_sheet:      Optional[str]
    estimated_records:  int
    template_override:  Optional[str]
    status:             str = "pending"   # pending | processed | failed
    validation:         ValidationSummaryOut


class UploadResponse(BaseModel):
    """Full API envelope for a single upload."""
    success: bool = True
    data: UploadResponseData


class UploadErrorItem(BaseModel):
    """One failed file entry inside a batch response."""
    original_filename: str
    errors:   list[str]
    warnings: list[str]


class BatchUploadResponse(BaseModel):
    """API envelope for a batch upload."""
    success:   bool = True
    total:     int
    succeeded: int
    failed:    int
    files:     list[UploadResponseData]
    errors:    list[UploadErrorItem]
