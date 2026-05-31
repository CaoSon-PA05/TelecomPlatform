"""
Upload service package — public API.

Typical usage from a router:
    from backend.app.services.upload import UploadHandler, UploadResponse

    handler = UploadHandler()
    result  = await handler.handle_single(file, template_override)
"""

from .handler import BatchUploadResult, UploadedFile, UploadError, UploadHandler
from .metadata import UploadMetadata, extract_metadata
from .schemas import (
    BatchUploadResponse,
    SheetInfoOut,
    UploadErrorItem,
    UploadResponse,
    UploadResponseData,
    ValidationSummaryOut,
)
from .storage import StoredFile, UploadStorage, upload_storage
from .validator import ValidationResult, validate_upload_file, validate_excel_structure

__all__ = [
    # Handler
    "UploadHandler",
    "UploadedFile",
    "UploadError",
    "BatchUploadResult",
    # Storage
    "UploadStorage",
    "upload_storage",
    "StoredFile",
    # Metadata
    "UploadMetadata",
    "extract_metadata",
    # Validator
    "ValidationResult",
    "validate_upload_file",
    "validate_excel_structure",
    # Response schemas
    "UploadResponse",
    "UploadResponseData",
    "BatchUploadResponse",
    "UploadErrorItem",
    "SheetInfoOut",
    "ValidationSummaryOut",
]
