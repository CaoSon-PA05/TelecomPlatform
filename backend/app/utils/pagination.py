"""
Pagination helpers — query parameter parsing and SQLAlchemy slice helpers.
"""

from __future__ import annotations

from fastapi import Query
from sqlalchemy.orm import Query as SAQuery

from backend.app.core.config import settings


class PaginationParams:
    """
    Reusable FastAPI dependency for pagination query parameters.

    Usage:
        @router.get("/items")
        async def list_items(p: PaginationParams = Depends()):
            ...
            return paginated(data, total, p.page, p.page_size)
    """

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(
            default=settings.DEFAULT_PAGE_SIZE,
            ge=1,
            le=settings.MAX_PAGE_SIZE,
            description="Items per page",
        ),
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def apply_pagination(query: SAQuery, params: PaginationParams) -> SAQuery:
    """Apply OFFSET + LIMIT to a SQLAlchemy query object."""
    return query.offset(params.offset).limit(params.limit)
