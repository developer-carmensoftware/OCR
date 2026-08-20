"""Admin router package — aggregates all sub-routers under /api/v1/admin."""

from fastapi import APIRouter

from .admin_users import router as admin_users_router
from .auth import router as auth_router
from .credits import router as credits_router
from .maintenance import router as maintenance_router
from .monitoring import router as monitoring_router
from .quotas import router as quotas_router
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
router.include_router(credits_router)
router.include_router(quotas_router)
router.include_router(admin_users_router)
