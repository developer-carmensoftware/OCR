"""Admin tenant list endpoint."""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.identity import Tenant
from app.models.observability import LLMUsageLog

from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/tenants")
async def list_tenants(
    active_only: bool = Query(True),
    limit: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    """
    List all tenants visible to this admin.
    Scoped admins see only their assigned tenant.
    Global admins see all tenants with last-usage timestamp from llm_usage_logs.
    """
    q = select(Tenant).where(Tenant.deleted_at.is_(None))
    if active_only:
        q = q.where(Tenant.is_active == True)  # noqa: E712
    if not admin.is_global:
        q = q.where(Tenant.id == admin.tenant_scope)
    q = q.order_by(Tenant.created_at.desc()).limit(limit)

    result = await db.execute(q)
    tenants = result.scalars().all()

    # Cheap last-activity lookup from llm_usage_logs (no FK, so a quick GROUP BY)
    if tenants:
        tenant_ids = [str(t.id) for t in tenants]
        last_used_q = (
            select(
                LLMUsageLog.tenant_id.label("tid"),
                func.max(LLMUsageLog.created_at).label("last_used"),
            )
            .where(LLMUsageLog.tenant_id.in_(tenant_ids))
            .group_by(LLMUsageLog.tenant_id)
        )
        lu_result = await db.execute(last_used_q)
        last_used_map: dict[str, str] = {
            str(r.tid): r.last_used.isoformat() for r in lu_result.mappings().all() if r.last_used
        }
    else:
        last_used_map = {}

    return {
        "total": len(tenants),
        "data": [
            {
                "id": str(t.id),
                "host": t.host,
                "bu_code": t.bu_code,
                "name": t.name,
                "plan": t.plan,
                "is_active": t.is_active,
                "contact_email": t.contact_email,
                "last_used_at": last_used_map.get(str(t.id)),
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tenants
        ],
    }
