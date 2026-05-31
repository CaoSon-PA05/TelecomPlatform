"""
Standardised API response envelopes.

Every API endpoint returns one of:
  - APIResponse[T]           — single item
  - PaginatedResponse[T]     — list with pagination metadata
  - error JSON               — from exception handlers in core/exceptions.py

Usage:
    return success(data=subscriber)
    return paginated(data=records, total=216, page=1, page_size=50)
"""

from __future__ import annotations

from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Shared metadata models
# ---------------------------------------------------------------------------

class PaginationMeta(BaseModel):
    page:        int
    page_size:   int
    total:       int
    total_pages: int
    has_next:    bool
    has_prev:    bool

    @classmethod
    def build(cls, total: int, page: int, page_size: int) -> "PaginationMeta":
        total_pages = max(1, -(-total // page_size))  # ceiling division
        return cls(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
        )


# ---------------------------------------------------------------------------
# Response wrappers
# ---------------------------------------------------------------------------

class APIResponse(BaseModel, Generic[T]):
    """Single-item response envelope."""
    success: bool = True
    data: T
    message: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response envelope."""
    success: bool = True
    data: list[T]
    meta: PaginationMeta


class MessageResponse(BaseModel):
    """Simple acknowledgement response (no payload)."""
    success: bool = True
    message: str


# ---------------------------------------------------------------------------
# Constructor helpers
# ---------------------------------------------------------------------------

def success(data: Any, message: str | None = None) -> dict:
    """Build a success envelope dict. Pass as `return success(data=x)` in routes."""
    result: dict = {"success": True, "data": data}
    if message:
        result["message"] = message
    return result


def paginated(
    data: list,
    total: int,
    page: int,
    page_size: int,
) -> dict:
    """Build a paginated envelope dict."""
    return {
        "success": True,
        "data": data,
        "meta": PaginationMeta.build(total, page, page_size).model_dump(),
    }


def message(text: str) -> dict:
    """Build a simple message response dict."""
    return {"success": True, "message": text}
