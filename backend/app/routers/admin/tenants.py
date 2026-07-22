"""Admin tenant list + detail endpoints."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.business import OcrSession
from app.models.catalog import Module, TenantModule
from app.models.identity import Tenant
from app.models.observability import LLMUsageLog
from app.services.quota_service import get_quota_summary
from app.services.usage_analytics_service import get_tenant_engagement_map

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()

# Defaults for a tenant that has never run an extraction. Spread under the real
# aggregates so every row carries the same keys and the frontend never branches on
# undefined — "logged in, never extracted" reads as 0, not as missing data.
_NO_ENGAGEMENT: dict = {
    "tried": 0,
    "ok": 0,
    "failed": 0,
    "posted_to_carmen": 0,
    "users": 0,
    "active_days": 0,
    "active_weeks": 0,
    "first_use": None,
    "last_use": None,
    "days_idle": None,
    "credit_card": 0,
    "ap_invoice": 0,
}


@router.get("/tenants")
async def list_tenants(
    active_only: bool = Query(True),
    include_engagement: bool = Query(False),
    limit: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """
    List all tenants visible to this admin.
    Scoped admins see only their assigned tenant.
    Global admins see all tenants with last-usage timestamp from llm_usage_logs
    and a count of enabled modules.

    include_engagement adds per-tenant task aggregates (tried/ok/failed/
    posted_to_carmen/active_weeks/days_idle/...). It is OFF by default because
    TenantSelector calls this endpoint on five other admin pages purely to fill a
    <select> that reads id/name/host/bu_code — they must not pay for three extra
    aggregate queries. With it off the response is byte-identical to before.
    """

    def _apply_filters(stmt):
        stmt = stmt.where(Tenant.deleted_at.is_(None))
        if active_only:
            stmt = stmt.where(Tenant.is_active == True)  # noqa: E712
        if not admin.is_global:
            stmt = stmt.where(Tenant.id == admin.tenant_scope)
        return stmt

    # Real count, independent of `limit` — otherwise "total" is just len(rows) from
    # the already-limited query, so a caller has no way to tell the list was truncated
    # (same bug class already found and fixed on GET /admin/alerts).
    total = (
        await db.execute(_apply_filters(select(func.count()).select_from(Tenant)))
    ).scalar_one()

    q = _apply_filters(select(Tenant)).order_by(Tenant.created_at.desc()).limit(limit)
    result = await db.execute(q)
    tenants = result.scalars().all()

    last_used_map: dict[str, str] = {}
    modules_count_map: dict[str, int] = {}
    engagement_map: dict[str, dict] = {}
    if tenants:
        tenant_ids = [str(t.id) for t in tenants]
        tenant_uuids = [t.id for t in tenants]

        # Cheap last-activity lookup from llm_usage_logs (no FK, so a quick GROUP BY)
        last_used_q = (
            select(
                LLMUsageLog.tenant_id.label("tid"),
                func.max(LLMUsageLog.created_at).label("last_used"),
            )
            .where(LLMUsageLog.tenant_id.in_(tenant_ids))
            .group_by(LLMUsageLog.tenant_id)
        )
        lu_result = await db.execute(last_used_q)
        last_used_map = {
            str(r.tid): r.last_used.isoformat() for r in lu_result.mappings().all() if r.last_used
        }

        # Enabled-module count per tenant. tenant_modules is OPT-OUT: a row exists only
        # when an admin explicitly toggled a module, so "no row" means enabled, not
        # disabled (same rule as quota_service.is_module_enabled and the Quotas page).
        # Counting enabled rows read 0 for every tenant nobody had ever touched.
        catalog_count = (
            await db.execute(
                select(func.count()).select_from(Module).where(Module.is_active.is_(True))
            )
        ).scalar_one()
        off_q = (
            select(TenantModule.tenant_id.label("tid"), func.count().label("n"))
            .join(Module, Module.id == TenantModule.module_id)
            .where(
                TenantModule.tenant_id.in_(tenant_uuids),
                TenantModule.enabled.is_(False),
                Module.is_active.is_(True),
            )
            .group_by(TenantModule.tenant_id)
        )
        off_result = await db.execute(off_q)
        disabled_count_map = {str(r.tid): r.n for r in off_result.mappings().all()}
        modules_count_map = {
            str(t.id): catalog_count - disabled_count_map.get(str(t.id), 0) for t in tenants
        }

        if include_engagement:
            engagement_map = await get_tenant_engagement_map(db, tenant_uuids)

    return {
        "total": total,
        "data": [
            {
                "id": str(t.id),
                "host": t.host,
                "bu_code": t.bu_code,
                "name": t.name,
                "plan": t.plan,
                "is_active": t.is_active,
                "contact_email": t.contact_email,
                "modules_count": modules_count_map.get(str(t.id), 0),
                "last_used_at": last_used_map.get(str(t.id)),
                "created_at": t.created_at.isoformat() if t.created_at else None,
                # A tenant with no tasks is absent from engagement_map — the zeros
                # below are the "logged in, never extracted" row.
                **(
                    {**_NO_ENGAGEMENT, **engagement_map.get(str(t.id), {})}
                    if include_engagement
                    else {}
                ),
            }
            for t in tenants
        ],
    }


@router.get("/tenants/{tenant_id}")
async def get_tenant_detail(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """Tenant detail: core fields + enabled modules + quotas + last 10 sessions."""
    if not admin.is_global and str(admin.tenant_scope) != tenant_id:
        raise HTTPException(status_code=404, detail="Tenant not found")

    try:
        tid = uuid.UUID(tenant_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == tid, Tenant.deleted_at.is_(None)))
    ).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Catalog ⟕ tenant_modules. Opt-out semantics: a module is enabled unless there is an
    # explicit enabled=False row, so we start from the catalog and subtract. An inner join
    # on enabled=True showed "0 modules" for every tenant, because the only writer of this
    # table is the admin toggle (quota_admin_service.set_module) — nothing seeds it.
    mod_rows = (
        await db.execute(
            select(Module.id, Module.display_name, TenantModule.enabled, TenantModule.enabled_at)
            .outerjoin(
                TenantModule,
                (TenantModule.module_id == Module.id) & (TenantModule.tenant_id == tid),
            )
            .where(Module.is_active.is_(True))
            .order_by(Module.sort_order)
        )
    ).all()
    modules = [
        {
            "id": r.id,
            "display_name": r.display_name,
            "enabled_at": r.enabled_at.isoformat() if r.enabled_at else None,
        }
        for r in mod_rows
        if r.enabled is not False
    ]
    modules_disabled = [r.id for r in mod_rows if r.enabled is False]

    # Quotas — reuse the shared summary (opens its own session)
    quotas = (await get_quota_summary(tenant_id)).get("quotas", [])

    # Last 10 sessions (same query shape as the sessions endpoint)
    sess_rows = (
        (
            await db.execute(
                select(OcrSession)
                .where(OcrSession.tenant_id == tid, OcrSession.deleted_at.is_(None))
                .order_by(OcrSession.last_used_at.desc())
                .limit(10)
            )
        )
        .scalars()
        .all()
    )
    recent_sessions = [
        {
            "id": r.id,
            "username": r.username,
            "carmen_user_id": r.carmen_user_id,
            "is_active": r.is_active,
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in sess_rows
    ]

    return {
        "id": str(tenant.id),
        "host": tenant.host,
        "bu_code": tenant.bu_code,
        "name": tenant.name,
        "plan": tenant.plan,
        "is_active": tenant.is_active,
        "contact_email": tenant.contact_email,
        "notes": tenant.notes,
        "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        "modules": modules,
        "modules_disabled": modules_disabled,
        "quotas": quotas,
        "recent_sessions": recent_sessions,
    }
