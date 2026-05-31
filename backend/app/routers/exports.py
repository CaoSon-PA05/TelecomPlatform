"""
Export router — generates Excel and ZIP downloads.

Endpoints:
  GET  /exports/{subscriber_id}/all        full multi-sheet workbook
  GET  /exports/{subscriber_id}/calls      Tab LIST — call history
  GET  /exports/{subscriber_id}/contacts   Tab Contact — contacts
  GET  /exports/{subscriber_id}/imei       Tab IMEI — device list
  GET  /exports/{subscriber_id}/location   Tab Location — tower frequency
  POST /exports/compare                    comparison results
  POST /exports/batch                      ZIP of all-data workbooks for N subscribers
  POST /exports/gtp                        filtered GTP telemetry → XLSX (3 sheets)
  POST /exports/fla                        filtered FLA transactions → XLSX (3 sheets)

All file endpoints stream directly — no intermediate storage.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from fastapi import APIRouter, Body, Depends, Path, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from backend.app.services.dependencies import get_export_service

log = logging.getLogger("telecom.routers.exports")

router = APIRouter(prefix="/exports", tags=["Exports"])

_XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_ZIP_MEDIA_TYPE  = "application/zip"


def _xlsx_headers(filename: str) -> dict:
    return {"Content-Disposition": f'attachment; filename="{filename}"'}


def _zip_headers(filename: str) -> dict:
    return {"Content-Disposition": f'attachment; filename="{filename}"'}


# ---------------------------------------------------------------------------
# Dashboard export request schemas
# ---------------------------------------------------------------------------

class GtpExportRequest(BaseModel):
    records: list[dict[str, Any]] = Field(..., description="Filtered GTP telemetry records")
    filename: str | None = Field(None, description="Optional override for the download filename")


class FlaExportRequest(BaseModel):
    records: list[dict[str, Any]] = Field(..., description="Filtered FLA transaction records")
    filename: str | None = Field(None, description="Optional override for the download filename")


class BatchExportRequest(BaseModel):
    subscriber_ids: list[int] = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Dashboard exports — accept JSON payload, return XLSX stream
# ---------------------------------------------------------------------------

@router.post(
    "/gtp",
    summary="Export filtered GTP telemetry data",
    description=(
        "Accepts the current filtered GTP records from the dashboard and returns "
        "a 3-sheet XLSX: movement log, LAC zone report, and signal strength stats."
    ),
    response_class=StreamingResponse,
)
async def export_gtp(
    body: GtpExportRequest,
    svc=Depends(get_export_service),
) -> StreamingResponse:
    today = date.today().isoformat()
    fname = body.filename or f"GTP_Report_{today}.xlsx"
    log.info("GTP export requested — %d records → %s", len(body.records), fname)
    buf = svc.export_gtp(body.records)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


@router.post(
    "/fla",
    summary="Export filtered FLA financial data",
    description=(
        "Accepts the current filtered FLA transactions from the dashboard and returns "
        "a 3-sheet XLSX: transaction list, statistics summary, and hourly distribution."
    ),
    response_class=StreamingResponse,
)
async def export_fla(
    body: FlaExportRequest,
    svc=Depends(get_export_service),
) -> StreamingResponse:
    today = date.today().isoformat()
    fname = body.filename or f"FLA_Report_{today}.xlsx"
    log.info("FLA export requested — %d records → %s", len(body.records), fname)
    buf = svc.export_fla(body.records)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


# ---------------------------------------------------------------------------
# Subscriber-based exports (DB-backed)
# ---------------------------------------------------------------------------

@router.get(
    "/{subscriber_id}/all",
    summary="Export all data for a subscriber",
    description="Multi-sheet workbook: TTTB, LIST, Contact, IMEI, Location.",
    response_class=StreamingResponse,
)
async def export_all(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_export_service),
) -> StreamingResponse:
    fname = f"{subscriber_id}_export_all.xlsx"
    buf = svc.export_all(subscriber_id)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


@router.get(
    "/{subscriber_id}/calls",
    summary="Export call history",
    description="Exports the current (filtered) call history as XLSX.",
    response_class=StreamingResponse,
)
async def export_calls(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_export_service),
) -> StreamingResponse:
    fname = f"{subscriber_id}_calls.xlsx"
    buf = svc.export_call_history(subscriber_id)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


@router.get(
    "/{subscriber_id}/contacts",
    summary="Export contacts list",
    response_class=StreamingResponse,
)
async def export_contacts(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_export_service),
) -> StreamingResponse:
    fname = f"{subscriber_id}_contacts.xlsx"
    buf = svc.export_contacts(subscriber_id)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


@router.get(
    "/{subscriber_id}/imei",
    summary="Export IMEI list",
    response_class=StreamingResponse,
)
async def export_imei(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_export_service),
) -> StreamingResponse:
    fname = f"{subscriber_id}_imei.xlsx"
    buf = svc.export_imei(subscriber_id)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


@router.get(
    "/{subscriber_id}/location",
    summary="Export location frequency",
    response_class=StreamingResponse,
)
async def export_location(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_export_service),
) -> StreamingResponse:
    fname = f"{subscriber_id}_location.xlsx"
    buf = svc.export_location(subscriber_id)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


@router.post(
    "/compare",
    summary="Export comparison results",
    description="Export the current cross-subscriber comparison result as XLSX.",
    response_class=StreamingResponse,
)
async def export_compare(
    result_type: str = Body("shared_contacts"),
    results: list[dict[str, Any]] = Body(...),
    svc=Depends(get_export_service),
) -> StreamingResponse:
    fname = f"compare_{result_type}_{date.today().isoformat()}.xlsx"
    buf = svc.export_compare_results(results, result_type)
    return StreamingResponse(buf, media_type=_XLSX_MEDIA_TYPE, headers=_xlsx_headers(fname))


@router.post(
    "/batch",
    summary="Batch export all subscribers as ZIP",
    description=(
        "Generate one export_all workbook per subscriber ID in the request body, "
        "bundle all into a single ZIP file, and stream it to the client."
    ),
    response_class=StreamingResponse,
)
async def export_batch(
    body: BatchExportRequest,
    svc=Depends(get_export_service),
) -> StreamingResponse:
    fname = f"batch_export_{date.today().isoformat()}.zip"
    buf = svc.export_all_subscribers_zip(body.subscriber_ids)
    return StreamingResponse(buf, media_type=_ZIP_MEDIA_TYPE, headers=_zip_headers(fname))
