"""Shared bulk tenant_id -> display-name lookup for admin list/aggregate endpoints."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import Tenant


async def tenant_name_map(db: AsyncSession, tenant_ids: list) -> dict[str, str]:
    """Bulk-resolve tenant_id -> "name (bu_code)". Missing/soft-deleted tenants are
    simply absent from the map; callers fall back to the raw id for those."""
    ids = [str(t) for t in tenant_ids if t]
    if not ids:
        return {}
    result = await db.execute(
        select(Tenant.id, Tenant.name, Tenant.bu_code).where(
            Tenant.id.in_(ids), Tenant.deleted_at.is_(None)
        )
    )
    return {str(r.id): f"{r.name} ({r.bu_code})" for r in result.mappings().all()}
