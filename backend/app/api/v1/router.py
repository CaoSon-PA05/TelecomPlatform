"""
API v1 aggregate router — mounts all feature routers under /api/v1.

Route map
---------
/api/v1/health/*         health checks
/api/v1/subscribers/*    subscriber CRUD
/api/v1/imports/*        CDR file upload and batch management
/api/v1/analytics/*      per-subscriber analysis + cross-subscriber comparison
/api/v1/exports/*        Excel and ZIP downloads
"""

from fastapi import APIRouter

from backend.app.routers import (
    analytics_router,
    exports_router,
    health_router,
    imports_router,
    subscribers_router,
)

api_v1_router = APIRouter()

api_v1_router.include_router(health_router)
api_v1_router.include_router(subscribers_router)
api_v1_router.include_router(imports_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(exports_router)
