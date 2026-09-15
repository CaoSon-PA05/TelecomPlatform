"""
Import router — CDR Excel file upload and batch management.

Implemented:
  POST /imports/upload           single file upload → UploadResponse
  POST /imports/upload/batch     multi-file upload  → BatchUploadResponse
  POST /imports/{upload_id}/process  trigger CDR import → ImportResult

Stubs (501):
  GET    /imports/batches
  GET    /imports/batches/{id}
  DELETE /imports/batches/{id}
  POST   /imports/batches/{id}/retry
"""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Path as FPath, Query, UploadFile, status
from fastapi.responses import JSONResponse

from backend.app.core.exceptions import FileTooLargeError, InvalidFileError
from backend.app.services.dependencies import get_import_service
from backend.app.services.upload import (
    BatchUploadResponse,
    UploadError,
    UploadHandler,
    UploadResponse,
    UploadResponseData,
    ValidationSummaryOut,
)
from backend.app.services.upload.storage import upload_storage
from backend.app.utils.pagination import PaginationParams

log = logging.getLogger("telecom.routers.imports")

router = APIRouter(prefix="/imports", tags=["Imports"])

_NOT_IMPLEMENTED = JSONResponse(
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    content={"success": False, "error": {"detail": "Not yet implemented."}},
)


# ---------------------------------------------------------------------------
# Dependency: one UploadHandler per request
# ---------------------------------------------------------------------------

def get_upload_handler() -> UploadHandler:
    return UploadHandler()


# ---------------------------------------------------------------------------
# POST /imports/upload — single file
# ---------------------------------------------------------------------------

@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a single CDR Excel file",
    description=(
        "Upload one `.xlsx` or `.xls` CDR file.\n\n"
        "The server will:\n"
        "1. Validate the file (extension, magic bytes, size)\n"
        "2. Save it securely to the pending directory\n"
        "3. Extract structural metadata (sheet names, row counts, detected carrier)\n"
        "4. Return an `upload_id` you can use to trigger import processing.\n\n"
        "**Does not run CDR analysis yet** — use the import trigger endpoint for that."
    ),
)
async def upload_file(
    file: Annotated[UploadFile, File(description="CDR Excel file (.xlsx or .xls)")],
    template_override: Optional[str] = Query(
        default=None,
        description="Force carrier template: viettel | vina | mobi. Omit for auto-detect.",
        pattern="^(viettel|vina|mobi)$",
    ),
    handler: UploadHandler = Depends(get_upload_handler),
) -> UploadResponse:
    result = await handler.handle_single(file, template_override=template_override)

    return UploadResponse(
        success=True,
        data=UploadResponseData(
            upload_id=result.upload_id,
            original_filename=result.metadata.original_filename,
            stored_as=result.metadata.stored_filename,
            file_size_bytes=result.metadata.file_size_bytes,
            file_size_kb=result.metadata.file_size_kb,
            extension=result.metadata.extension,
            uploaded_at=result.metadata.uploaded_at,
            detected_phone=result.metadata.detected_phone,
            detected_carrier=result.metadata.detected_carrier,
            sheet_names=result.metadata.sheet_names,
            sheets=[dict(s) for s in result.metadata.sheets],  # type: ignore[arg-type]
            primary_sheet=result.metadata.primary_sheet,
            estimated_records=result.metadata.estimated_records,
            template_override=result.template_override,
            status="pending",
            validation=ValidationSummaryOut(
                valid=result.metadata.validation.valid,
                errors=result.metadata.validation.errors,
                warnings=result.metadata.validation.warnings,
            ),
        ),
    )


# ---------------------------------------------------------------------------
# POST /imports/upload/batch — multiple files
# ---------------------------------------------------------------------------

@router.post(
    "/upload/batch",
    response_model=BatchUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload multiple CDR Excel files",
    description=(
        "Upload up to 20 `.xlsx`/`.xls` CDR files in one request.\n\n"
        "Files are processed concurrently (up to 4 at a time).\n"
        "Partial success is allowed — failed files are reported in `errors[]` "
        "without blocking the successful ones."
    ),
)
async def upload_multiple_files(
    files: Annotated[
        list[UploadFile],
        File(description="CDR Excel files (.xlsx or .xls). Maximum 20 files."),
    ],
    handler: UploadHandler = Depends(get_upload_handler),
) -> BatchUploadResponse:
    if len(files) > 20:
        raise InvalidFileError("Maximum 20 files per batch upload.")

    batch = await handler.handle_batch(files)

    files_out = [
        UploadResponseData(
            upload_id=f.upload_id,
            original_filename=f.metadata.original_filename,
            stored_as=f.metadata.stored_filename,
            file_size_bytes=f.metadata.file_size_bytes,
            file_size_kb=f.metadata.file_size_kb,
            extension=f.metadata.extension,
            uploaded_at=f.metadata.uploaded_at,
            detected_phone=f.metadata.detected_phone,
            detected_carrier=f.metadata.detected_carrier,
            sheet_names=f.metadata.sheet_names,
            sheets=[dict(s) for s in f.metadata.sheets],  # type: ignore[arg-type]
            primary_sheet=f.metadata.primary_sheet,
            estimated_records=f.metadata.estimated_records,
            template_override=f.template_override,
            status="pending",
            validation=ValidationSummaryOut(
                valid=f.metadata.validation.valid,
                errors=f.metadata.validation.errors,
                warnings=f.metadata.validation.warnings,
            ),
        )
        for f in batch.files
    ]

    errors_out = [
        {"original_filename": e.original_filename, "errors": e.errors, "warnings": e.warnings}
        for e in batch.errors
    ]

    return BatchUploadResponse(
        success=True,
        total=batch.total,
        succeeded=batch.succeeded,
        failed=batch.failed,
        files=files_out,
        errors=errors_out,
    )


# ---------------------------------------------------------------------------
# POST /imports/{upload_id}/process — trigger CDR import
# ---------------------------------------------------------------------------

@router.post(
    "/{upload_id}/process",
    summary="Process an uploaded CDR file",
    description=(
        "Trigger the full CDR import pipeline for a previously uploaded file.\n\n"
        "The `upload_id` is the UUID string returned by `POST /imports/upload`.\n\n"
        "**Pipeline steps:**\n"
        "1. Locate file in `pending/` storage\n"
        "2. Parse Excel → auto-detect carrier (or use `template_override`)\n"
        "3. Upsert Subscriber (create or update PII)\n"
        "4. Create ImportBatch (status=pending)\n"
        "5. Normalize & bulk-insert CDR records\n"
        "6. Rebuild analytics stats (contacts, hourly, weekly, towers, devices)\n"
        "7. Update ImportBatch (status=success)\n"
        "8. Move file from `pending/` → `processed/`\n\n"
        "Returns `ImportResult` on success. "
        "On parse/DB failure the batch row is marked FAILED and the file moves to `failed/`."
    ),
    status_code=status.HTTP_202_ACCEPTED,
)
async def process_import(
    upload_id: str = FPath(
        ...,
        description="UUID string returned by the upload endpoint (no extension).",
    ),
    template_override: Optional[str] = Query(
        default=None,
        description="Force carrier template: viettel | vina | mobi. Omit for auto-detect.",
        pattern="^(viettel|vina|mobi)$",
    ),
    svc=Depends(get_import_service),
) -> JSONResponse:
    # ── Locate pending file ──────────────────────────────────────────────
    path = None
    for ext in (".xlsx", ".xls"):
        candidate = upload_storage.get_pending(upload_id + ext)
        if candidate is not None:
            path = candidate
            break

    if path is None:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "success": False,
                "error": {
                    "detail": (
                        f"No pending file found for upload_id='{upload_id}'. "
                        "The file may have already been processed, failed, or does not exist."
                    )
                },
            },
        )

    # ── Run import pipeline in thread pool (CPU/IO heavy) ────────────────
    try:
        result = await asyncio.to_thread(svc.import_file, path, template_override)

        # Move to processed/ after successful DB commit
        try:
            upload_storage.move_to_processed(path)
        except Exception as move_err:
            # Non-fatal — data is already in DB; log and continue
            log.warning("Could not move file to processed/: %s", move_err)

        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content={"success": True, "data": result.model_dump()},
        )

    except Exception as exc:
        log.exception("Import failed for upload_id=%s: %s", upload_id, exc)

        # Move to failed/ for audit
        try:
            upload_storage.move_to_failed(path)
        except Exception:
            pass

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "error": {"detail": str(exc)},
            },
        )


# ---------------------------------------------------------------------------
# Batch management — stubs (501)
# ---------------------------------------------------------------------------

@router.get(
    "/batches",
    summary="List all import batches",
    description="Returns all import batch records ordered by import time (newest first).",
)
async def list_batches(
    pagination: PaginationParams = Depends(),
    subscriber_id: Optional[int] = Query(default=None, ge=1),
    svc=Depends(get_import_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED


@router.get(
    "/batches/{batch_id}",
    summary="Get an import batch by ID",
)
async def get_batch(
    batch_id: int = FPath(..., ge=1),
    svc=Depends(get_import_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED


@router.delete(
    "/batches/{batch_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete an import batch",
    description="Deletes the batch record and all CDR rows linked to it. Rebuilds stats.",
)
async def delete_batch(
    batch_id: int = FPath(..., ge=1),
    svc=Depends(get_import_service),
) -> None:
    return None


@router.post(
    "/batches/{batch_id}/retry",
    summary="Retry a failed import batch",
    description="Re-process a batch that previously failed, using the same stored file.",
)
async def retry_batch(
    batch_id: int = FPath(..., ge=1),
    svc=Depends(get_import_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED
