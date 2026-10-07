"""Shared bulk id -> display-name lookups for admin list/aggregate endpoints."""

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import OcrSession
from app.models.identity import Tenant


async def tenant_name_map(db: AsyncSession, tenant_ids: list) -> dict[str, str]:
    """Bulk-resolve tenant_id -> "name (bu_code)". Missing/soft-deleted tenants are
    simply absent from the map; callers fall back to the raw id for those."""
    ids = [str(t) for t in tenant_ids if t]
    if not ids:
        return {}
    # Compared as text, not bound as UUIDs. Observability tables keep tenant_id as a plain
    # string, and cluster-wide rows carry "system" (llm/client.py, the email poll's
    # unrouted/beyond-window alerts). Bound as a UUID, one such id failed the whole query —
    # a 500 on /admin/alerts, and so on Overview and Anomalies, for as long as a system
    # alert stayed open. As text it simply matches no tenant, which is the answer.
    result = await db.execute(
        select(Tenant.id, Tenant.name, Tenant.bu_code).where(
            cast(Tenant.id, String).in_(ids), Tenant.deleted_at.is_(None)
        )
    )
    return {str(r.id): f"{r.name} ({r.bu_code})" for r in result.mappings().all()}


async def tenant_info_map(db: AsyncSession, tenant_ids: list) -> dict[str, dict[str, str]]:
    """Bulk-resolve tenant_id -> {name, bu_code, host}, for a cell that shows the BU code and
    the host on separate lines. Same text comparison as `tenant_name_map`, same omissions."""
    ids = [str(t) for t in tenant_ids if t]
    if not ids:
        return {}
    result = await db.execute(
        select(Tenant.id, Tenant.name, Tenant.bu_code, Tenant.host).where(
            cast(Tenant.id, String).in_(ids), Tenant.deleted_at.is_(None)
        )
    )
    return {
        str(r.id): {"name": r.name, "bu_code": r.bu_code, "host": r.host}
        for r in result.mappings().all()
    }


async def username_map(db: AsyncSession, carmen_user_ids: list) -> dict[str, str]:
    """Bulk-resolve carmen_user_id -> username.

    ocr_sessions is the only table that stores the human-readable username; every
    downstream table (ocr_tasks, llm_usage_logs) carries the opaque carmen_user_id
    alone. Sessions are retained 90 days after being scrubbed, so this resolves for
    anyone who has logged in within that window; older ids fall back to the raw id.
    """
    ids = [str(u) for u in carmen_user_ids if u]
    if not ids:
        return {}
    result = await db.execute(
        select(OcrSession.carmen_user_id, func.max(OcrSession.username).label("username"))
        .where(OcrSession.carmen_user_id.in_(ids), OcrSession.username.isnot(None))
        .group_by(OcrSession.carmen_user_id)
    )
    return {str(r.carmen_user_id): r.username for r in result.mappings().all()}
