"""Admin quota + module management — cross-tenant overview, edit limit, reset usage, toggle module.

Business logic for routers/admin/quotas.py. The overview is one bulk pass across all
tenants (not N+1 per-tenant queries); the three mutations are narrow, single-tenant ops.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import cast

from sqlalchemy import case, func, select, text, tuple_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.exceptions import NotFoundError, ValidationError
from app.models.billing import Quota, QuotaUsage, TenantCredit
from app.models.catalog import Module, TenantModule
from app.models.enums import QuotaPeriod
from app.models.identity import Tenant
from app.models.observability import LLMUsageLog
from app.services.audit_service import AuditAction, log_admin_action
from app.services.credit_service import active_subscription_map
from app.services.quota_service import period_key


async def get_tenants_quota_overview(
    db: AsyncSession,
    active_only: bool,
    from_dt: datetime,
    to_dt: datetime,
    limit: int = 200,
) -> dict:
    """All tenants with quota usage, enabled modules, and per-module usage in one bulk pass."""
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

    # Quotas + current-period usage, bulk (mirrors quota_service.get_quota_summary, batched)
    quotas = (
        (
            await db.execute(
                select(Quota).where(Quota.tenant_id.in_(tenant_ids), Quota.deleted_at.is_(None))
            )
        )
        .scalars()
        .all()
    )
    quota_keys = {q.id: period_key(cast(QuotaPeriod, q.period)) for q in quotas}
    usage_pairs = [(q.id, quota_keys[q.id]) for q in quotas]
    usage_map: dict[str, float] = {}
    if usage_pairs:
        usage_rows = await db.execute(
            select(QuotaUsage.quota_id, QuotaUsage.used).where(
                tuple_(QuotaUsage.quota_id, QuotaUsage.period_key).in_(usage_pairs)
            )
        )
        usage_map = {str(qid): float(cast(Decimal, used)) for qid, used in usage_rows.all()}

    quotas_by_tenant: dict[str, list[dict]] = {}
    for q in quotas:
        used = usage_map.get(str(q.id), 0.0)
        limit_value = float(cast(Decimal, q.limit_value))
        quotas_by_tenant.setdefault(str(q.tenant_id), []).append(
            {
                "id": str(q.id),
                "period": q.period,
                "metric": q.metric,
                "used": used,
                "limit": limit_value,
                "pct": round(used / limit_value * 100, 1) if limit_value else 0,
                "is_hard": q.is_hard,
                "period_key": quota_keys[q.id],
            }
        )

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

    # The page charges subscription → free → top-up, so a subscribed tenant's free quota
    # bar is frozen while real usage lands on the subscription. Surface both extra buckets
    # so the moving one is visible. Bulk, keyed by str(tenant_id).
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
            "quotas": quotas_by_tenant.get(str(t.id), []),
            "modules_enabled": modules_by_tenant.get(str(t.id), []),
            "modules_disabled": modules_disabled_by_tenant.get(str(t.id), []),
            "usage_by_module": usage_by_tenant.get(str(t.id), []),
            "subscription": subs_by_tenant.get(str(t.id)),
            "credit_balance": credit_by_tenant.get(str(t.id), 0),
        }
        for t in tenants
    ]
    return {"data": data, "modules": modules_catalog}


async def _get_tenant_quota(db: AsyncSession, tenant_id: str, quota_id: str) -> Quota:
    try:
        uuid.UUID(tenant_id)
        uuid.UUID(quota_id)
    except ValueError:
        raise NotFoundError("Quota not found") from None

    quota = (
        await db.execute(
            select(Quota).where(
                Quota.id == quota_id, Quota.tenant_id == tenant_id, Quota.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if not quota:
        raise NotFoundError("Quota not found")
    return quota


async def update_quota_limit(
    db: AsyncSession, tenant_id: str, quota_id: str, limit_value: float, admin: AdminPrincipal
) -> dict:
    if limit_value <= 0:
        raise ValidationError("limit_value must be greater than 0")

    quota = await _get_tenant_quota(db, tenant_id, quota_id)
    before = float(cast(Decimal, quota.limit_value))
    quota.limit_value = limit_value
    await db.commit()

    await log_admin_action(
        admin_user_id=admin.admin_id,
        action=AuditAction.QUOTA_UPDATE,
        resource="quotas",
        target_id=str(quota.id),
        before_value={"limit_value": before},
        after_value={"limit_value": limit_value},
    )
    return {"id": str(quota.id), "limit_value": limit_value}


async def reset_quota_usage(
    db: AsyncSession, tenant_id: str, quota_id: str, admin: AdminPrincipal
) -> dict:
    quota = await _get_tenant_quota(db, tenant_id, quota_id)
    key = period_key(cast(QuotaPeriod, quota.period))
    await db.execute(
        text(
            "UPDATE quota_usage SET used=0, last_updated_at=NOW() "
            "WHERE quota_id=:qid AND period_key=:key"
        ),
        {"qid": str(quota.id), "key": key},
    )
    await db.commit()

    await log_admin_action(
        admin_user_id=admin.admin_id,
        action=AuditAction.QUOTA_RESET,
        resource="quotas",
        target_id=str(quota.id),
        after_value={"period_key": key, "used": 0},
    )
    return {"id": str(quota.id), "period_key": key, "used": 0.0}


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
