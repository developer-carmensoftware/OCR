"""Admin allowance + module management — cross-tenant overview, toggle module."""

import logging
from datetime import UTC, date, datetime
from datetime import time as time_type

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.exceptions import ValidationError
from app.models.schemas import ModuleToggleRequest
from app.services import quota_admin_service as svc

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()

# llm_usage_logs is retained 12 months anyway (pg_partman), so nothing wider than
# a quarter was ever fully meaningful for "this tenant's recent module usage" — and
# an unbounded/very wide range here was a genuine unbounded-query risk (no LIMIT on
# the per-tenant-per-module aggregate).
_MAX_DATE_RANGE_DAYS = 92


def _assert_scope(admin: AdminPrincipal, tenant_id: str) -> None:
    """Scoped admins may only act on their own tenant."""
    if not admin.is_global and admin.tenant_scope != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant out of scope")


def _assert_date_range(from_date: date, to_date: date) -> None:
    if to_date < from_date:
        raise ValidationError("'to' must not be before 'from'")
    if (to_date - from_date).days > _MAX_DATE_RANGE_DAYS:
        raise ValidationError(f"Date range too wide — max {_MAX_DATE_RANGE_DAYS} days")


@router.get("/quotas/overview")
async def get_quota_overview(
    active_only: bool = Query(True),
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    limit: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("quotas", "read")),
):
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()
    _assert_date_range(from_date, to_date)
    from_dt = datetime.combine(from_date, time_type.min, tzinfo=UTC)
    to_dt = datetime.combine(to_date, time_type.max, tzinfo=UTC)

    result = await svc.get_tenants_quota_overview(db, active_only, from_dt, to_dt, limit)
    if not admin.is_global:
        result["data"] = [t for t in result["data"] if t["id"] == admin.tenant_scope]
    return {"from": str(from_date), "to": str(to_date), **result}


@router.put("/tenants/{tenant_id}/modules/{module_id}")
async def toggle_module(
    tenant_id: str,
    module_id: str,
    body: ModuleToggleRequest,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("modules", "write")),
):
    _assert_scope(admin, tenant_id)
    return await svc.toggle_module(db, tenant_id, module_id, body.enabled, admin)
