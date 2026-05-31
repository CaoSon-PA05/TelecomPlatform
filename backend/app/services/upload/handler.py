"""
UploadHandler — orchestrates the complete upload pipeline for one or many files.

Pipeline per file:
  1. validate_upload_file  — magic bytes, extension, size (async, streaming)
  2. storage.save_upload   — stream write via aiofiles → pending/
  3. validate_excel_structure — openpyxl structure check (in thread pool)
  4. extract_metadata      — openpyxl + pandas metadata (in thread pool)
  5. Return UploadedFile

The handler does NOT touch the database or run CDR parsing.
Those steps belong to ImportService (modules/telecom_analysis/services/).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

from backend.app.core.exceptions import InvalidFileError
from .metadata import UploadMetadata, extract_metadata
from .storage import StoredFile, UploadStorage, upload_storage
from .validator import ValidationResult, validate_excel_structure, validate_upload_file

log = logging.getLogger("telecom.upload.handler")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class UploadedFile:
    """Successful result for a single file upload."""
    upload_id:         str
    metadata:          UploadMetadata
    stored_path:       Path
    stored_name:       str
    template_override: Optional[str] = None


@dataclass
class UploadError:
    """Failed upload for one file in a batch."""
    original_filename: str
    errors:            list[str] = field(default_factory=list)
    warnings:          list[str] = field(default_factory=list)


@dataclass
class BatchUploadResult:
    """Aggregated result for a batch of file uploads."""
    total:     int
    succeeded: int
    failed:    int
    files:     list[UploadedFile] = field(default_factory=list)
    errors:    list[UploadError]  = field(default_factory=list)


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

class UploadHandler:
    """
    Stateless upload orchestrator.
    Can be instantiated per-request or shared (all methods are re-entrant).
    """

    def __init__(self, storage: UploadStorage | None = None) -> None:
        self.storage = storage or upload_storage

    # ------------------------------------------------------------------
    # Single file
    # ------------------------------------------------------------------

    async def handle_single(
        self,
        file: UploadFile,
        template_override: Optional[str] = None,
    ) -> UploadedFile:
        """
        Run the full upload pipeline for one UploadFile.
        Raises InvalidFileError on validation failure.
        Raises on unexpected I/O errors (caller should catch and return 500).
        """
        original_name = file.filename or "upload.xlsx"
        log.info("Handling upload: '%s'", original_name)

        # 1. Validate (async streaming — never loads full file into memory) --------
        validation: ValidationResult = await validate_upload_file(file)

        if not validation.valid:
            log.warning(
                "Upload rejected '%s': %s", original_name, validation.errors
            )
            raise InvalidFileError(
                f"File '{original_name}' failed validation: "
                + "; ".join(validation.errors)
            )

        # 2. Save to pending/ (async, aiofiles) ------------------------------------
        stored: StoredFile = await self.storage.save_upload(file, original_name)

        # 3. Excel structure validation (blocking → thread pool) -------------------
        struct_result = await asyncio.to_thread(
            validate_excel_structure, stored.stored_path
        )
        if not struct_result.valid:
            # File is corrupt — delete it and fail fast
            await self.storage.delete(stored.stored_path)
            raise InvalidFileError(
                f"File '{original_name}' failed structural validation: "
                + "; ".join(struct_result.errors)
            )

        # Merge any structural warnings into the validation result
        for w in struct_result.warnings:
            validation.add_warning(w)

        # 4. Extract metadata (blocking openpyxl + pandas → thread pool) ----------
        upload_id = stored.stored_name.split(".")[0]  # UUID part of stored filename
        metadata = await extract_metadata(
            stored_path=stored.stored_path,
            original_filename=original_name,
            upload_id=upload_id,
            validation=validation,
        )

        log.info(
            "Upload complete: '%s' → '%s' | phone=%s carrier=%s records≈%d",
            original_name,
            stored.stored_name,
            metadata.detected_phone or "?",
            metadata.detected_carrier or "?",
            metadata.estimated_records,
        )

        return UploadedFile(
            upload_id=upload_id,
            metadata=metadata,
            stored_path=stored.stored_path,
            stored_name=stored.stored_name,
            template_override=template_override,
        )

    # ------------------------------------------------------------------
    # Batch upload
    # ------------------------------------------------------------------

    async def handle_batch(
        self,
        files: list[UploadFile],
        max_concurrent: int = 4,
    ) -> BatchUploadResult:
        """
        Process multiple files with bounded concurrency (semaphore).
        Never raises — all errors are captured in BatchUploadResult.errors.
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _process_one(f: UploadFile) -> UploadedFile | UploadError:
            async with semaphore:
                try:
                    return await self.handle_single(f)
                except InvalidFileError as exc:
                    return UploadError(
                        original_filename=f.filename or "unknown",
                        errors=[str(exc)],
                    )
                except Exception as exc:
                    log.exception("Unexpected error uploading '%s'", f.filename)
                    return UploadError(
                        original_filename=f.filename or "unknown",
                        errors=[f"Unexpected error: {exc}"],
                    )

        results = await asyncio.gather(*[_process_one(f) for f in files])

        succeeded = [r for r in results if isinstance(r, UploadedFile)]
        failed    = [r for r in results if isinstance(r, UploadError)]

        log.info(
            "Batch upload complete — %d/%d succeeded", len(succeeded), len(results)
        )

        return BatchUploadResult(
            total=len(results),
            succeeded=len(succeeded),
            failed=len(failed),
            files=succeeded,
            errors=failed,
        )
