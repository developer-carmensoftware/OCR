"""Admin router package — aggregates all sub-routers under /api/v1/admin."""

from fastapi import APIRouter

from .auth import router as auth_router
from .maintenance import router as maintenance_router
from .monitoring import router as monitoring_router
from .sessions import router as sessions_router
from .tenants import router as tenants_router
from .usage import router as usage_router

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

router.include_router(auth_router)
router.include_router(usage_router)
router.include_router(monitoring_router)
router.include_router(sessions_router)
router.include_router(maintenance_router)
router.include_router(tenants_router)
