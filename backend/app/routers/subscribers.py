"""
Subscriber router — CRUD for investigated phone subscribers.

Endpoints:
  GET    /subscribers           list all
  POST   /subscribers           create
  GET    /subscribers/{id}      get by id
  GET    /subscribers/phone/{phone}  get by phone number
  PATCH  /subscribers/{id}      partial update (name, address, notes)
  DELETE /subscribers/{id}      delete + cascade

Telecom logic: NOT YET IMPLEMENTED — stubs return 501.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Path, status
from fastapi.responses import JSONResponse

from backend.app.services.dependencies import get_subscriber_service
from backend.app.utils.responses import message, paginated, success
from backend.app.utils.pagination import PaginationParams

log = logging.getLogger("telecom.routers.subscribers")

router = APIRouter(prefix="/subscribers", tags=["Subscribers"])

_NOT_IMPLEMENTED = JSONResponse(
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    content={"success": False, "error": {"detail": "Not yet implemented."}},
)


@router.get(
    "",
    summary="List all subscribers",
    description="Returns all subscriber records ordered by phone number.",
)
async def list_subscribers(
    pagination: PaginationParams = Depends(),
    svc=Depends(get_subscriber_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create subscriber",
    description="Manually create a subscriber record (alternative to import).",
)
async def create_subscriber(
    svc=Depends(get_subscriber_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED


@router.get(
    "/{subscriber_id}",
    summary="Get subscriber by ID",
)
async def get_subscriber(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_subscriber_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED


@router.get(
    "/phone/{phone}",
    summary="Get subscriber by phone number",
    description="Look up a subscriber by normalized phone (e.g. 0969619929).",
)
async def get_subscriber_by_phone(
    phone: str,
    svc=Depends(get_subscriber_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED


@router.patch(
    "/{subscriber_id}",
    summary="Update subscriber",
    description="Update mutable fields: full_name, address, notes, account_status.",
)
async def update_subscriber(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_subscriber_service),
) -> JSONResponse:
    return _NOT_IMPLEMENTED


@router.delete(
    "/{subscriber_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Delete subscriber",
    description="Delete subscriber and all related CDR data. Irreversible.",
)
async def delete_subscriber(
    subscriber_id: int = Path(..., ge=1),
    svc=Depends(get_subscriber_service),
) -> None:
    return None  # 204 No Content
