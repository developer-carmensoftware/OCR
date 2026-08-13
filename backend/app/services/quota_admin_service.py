"""Admin allowance + module management — cross-tenant overview, toggle module.

Business logic for routers/admin/quotas.py. The overview is one bulk pass across all
tenants (not N+1 per-tenant queries); the mutation is a narrow, single-tenant op.

The per-tenant limit editor that used to live here went away with the free-trial
quota (migration 20260813000100): the lever on a tenant's document allowance is now
`POST /admin/tenants/{id}/credits/adjust`.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import case, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.exceptions import NotFoundError
from app.models.billing import TenantCredit
from app.models.catalog import Module, TenantModule
from app.models.identity import Tenant
from app.models.observability import LLMUsageLog
from app.services.audit_service import AuditAction, log_admin_action
from app.services.credit_service import active_subscription_map


async def get_tenants_quota_overview(
    db: AsyncSession,
    active_only: bool,
    from_dt: datetime,
    to_dt: datetime,
    limit: int = 200,
) -> dict:
    """All tenants with their document pools, enabled modules, and per-module usage
    in one bulk pass."""
    all_modules = (
        (
            await db.execute(
                select(Module).where(Module.is_active.is_(True)).order_by(Module.sort_order)
            )
        )
        .scalars()
        .all()
    )
    module_display = {m.id: m.display_name for m in all_modules}
    modules_catalog = [{"id": m.id, "display_name": m.display_name} for m in all_modules]

    tq = select(Tenant).where(Tenant.deleted_at.is_(None))
    if active_only:
        tq = tq.where(Tenant.is_active.is_(True))
    tq = tq.order_by(Tenant.created_at.desc()).limit(limit)
    tenants = (await db.execute(tq)).scalars().all()
    if not tenants:
        return {"data": [], "modules": modules_catalog}

    tenant_ids = [t.id for t in tenants]
    tenant_ids_str = [str(t.id) for t in tenants]

    # Module rows per tenant, bulk — BOTH enabled states. Enforcement is opt-out: a
    # module is available unless there is an explicit enabled=False row, so the UI needs
    # the disabled set to render the switch truthfully (no row = ON, not OFF).
    mod_rows = await db.execute(
        select(TenantModule.tenant_id, TenantModule.module_id, TenantModule.enabled).where(
            TenantModule.tenant_id.in_(tenant_ids)
        )
    )
    modules_by_tenant: dict[str, list[dict]] = {}
    modules_disabled_by_tenant: dict[str, list[str]] = {}
    for tid, mid, enabled in mod_rows.all():
        if enabled:
            modules_by_tenant.setdefault(str(tid), []).append(
                {"id": mid, "display_name": module_display.get(mid, mid)}
            )
        else:
            modules_disabled_by_tenant.setdefault(str(tid), []).append(mid)

    # Per-tenant, per-module usage over the selected window, bulk
    usage_q = (
        select(
            LLMUsageLog.tenant_id.label("tid"),
            LLMUsageLog.module_id.label("mid"),
            func.count(LLMUsageLog.id).label("calls"),
            # scans (extract) is the number comparable to quota — one per document
            # attempted. suggestions ride along and never touch quota. Splitting them
            # here is what lets the page stop showing a blended count next to "6/30".
            func.sum(case((LLMUsageLog.call_type == "extract", 1), else_=0)).label("scans"),
            func.sum(case((LLMUsageLog.call_type == "suggest", 1), else_=0)).label("suggestions"),
            func.sum(LLMUsageLog.total_tokens).label("tokens"),
            func.sum(LLMUsageLog.cost_usd).label("cost"),
        )
        .where(
            LLMUsageLog.tenant_id.in_(tenant_ids_str),
            LLMUsageLog.created_at >= from_dt,
            LLMUsageLog.created_at <= to_dt,
        )
        .group_by(LLMUsageLog.tenant_id, LLMUsageLog.module_id)
    )
    usage_by_module_rows = (await db.execute(usage_q)).mappings().all()
    usage_by_tenant: dict[str, list[dict]] = {}
    for r in usage_by_module_rows:
        usage_by_tenant.setdefault(r["tid"], []).append(
            {
                "module_id": r["mid"],
                "display_name": module_display.get(r["mid"], r["mid"]),
                "calls": int(r["calls"] or 0),
                "scans": int(r["scans"] or 0),
                "suggestions": int(r["suggestions"] or 0),
                "tokens": int(r["tokens"] or 0),
                "cost_usd": float(r["cost"] or 0),
            }
        )

    # Scans are charged subscription → credits, so a subscribed tenant's credit balance
    # sits still while real usage lands on the allowance. Surface both so the page can
    # show which one is moving. Bulk, keyed by str(tenant_id).
    subs_by_tenant = await active_subscription_map(db, tenant_ids)
    credit_rows = (
        await db.execute(
            select(TenantCredit.tenant_id, TenantCredit.balance).where(
                TenantCredit.tenant_id.in_(tenant_ids)
            )
        )
    ).all()
    credit_by_tenant = {str(tid): int(bal or 0) for tid, bal in credit_rows}

    data = [
        {
            "id": str(t.id),
            "host": t.host,
            "bu_code": t.bu_code,
            "name": t.name,
            "plan": t.plan,
            "is_active": t.is_active,
            "modules_enabled": modules_by_tenant.get(str(t.id), []),
            "modules_disabled": modules_disabled_by_tenant.get(str(t.id), []),
            "usage_by_module": usage_by_tenant.get(str(t.id), []),
            "subscription": subs_by_tenant.get(str(t.id)),
            "credit_balance": credit_by_tenant.get(str(t.id), 0),
        }
        for t in tenants
    ]
    return {"data": data, "modules": modules_catalog}


async def toggle_module(
    db: AsyncSession, tenant_id: str, module_id: str, enabled: bool, admin: AdminPrincipal
) -> dict:
    try:
        uuid.UUID(tenant_id)
    except ValueError:
        raise NotFoundError("Tenant not found") from None

    module = (await db.execute(select(Module).where(Module.id == module_id))).scalar_one_or_none()
    if not module:
        raise NotFoundError("Module not found")

    now = datetime.now(UTC)
    values: dict = {"tenant_id": tenant_id, "module_id": module_id, "enabled": enabled}
    set_: dict = {"enabled": enabled}
    if enabled:
        values["enabled_at"] = now
        set_["enabled_at"] = now
    else:
        values["disabled_at"] = now
        set_["disabled_at"] = now

    stmt = (
        pg_insert(TenantModule)
        .values(**values)
        .on_conflict_do_update(index_elements=["tenant_id", "module_id"], set_=set_)
    )
    await db.execute(stmt)
    await db.commit()

    await log_admin_action(
        admin_user_id=admin.admin_id,
        action=AuditAction.MODULE_TOGGLE,
        resource="modules",
        target_id=f"{tenant_id}:{module_id}",
        after_value={"enabled": enabled},
    )
    return {"tenant_id": tenant_id, "module_id": module_id, "enabled": enabled}
