"""API keys we issue to external systems — today only Carmen's PMS webhook (CA-93).

The plaintext leaves this API exactly once, in the POST response. Revoke is a stamp, not
a delete: `api_keys` rows are kept so "which key was live on that date" stays answerable.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.admin import APIKey
from app.models.schemas.pms import ApiKeyCreateIn
from app.services.shared import api_keys
from app.services.shared.audit import AuditAction, log_admin_action
from app.services.shared.tenant_lookup import tenant_info_map
from app.utils.client_ip import get_client_ip
from app.utils.pagination import paginate

from ._query import ListQuery, apply_list_query, list_query
from .deps import require_permission

router = APIRouter()


def _row(k: APIKey, tenants: dict[str, dict[str, str]]) -> dict:
    tenant = tenants.get(str(k.tenant_id), {})
    return {
        "id": str(k.id),
        "tenant_id": str(k.tenant_id) if k.tenant_id else None,
        "tenant_name": f"{tenant['name']} ({tenant['bu_code']})" if tenant else None,
        "bu_code": tenant.get("bu_code"),
        "tenant_host": tenant.get("host"),
        "name": k.name,
        "key_prefix": k.key_prefix,
        "scopes": k.scopes or [],
        "created_at": k.created_at.isoformat() if k.created_at else None,
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        "last_used_ip": k.last_used_ip,
        "revoked_at": k.revoked_at.isoformat() if k.revoked_at else None,
        "revoke_reason": k.revoke_reason,
    }


@router.get("/api-keys")
async def list_api_keys(
    tenant_id: str | None = Query(None),
    active_only: bool = Query(False),
    lq: ListQuery = Depends(list_query),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("api_keys", "read")),
):
    tid = tenant_id if admin.is_global else admin.tenant_scope
    q = select(APIKey)
    if tid:
        q = q.where(APIKey.tenant_id == tid)
    if active_only:
        q = q.where(APIKey.revoked_at.is_(None))
    q = apply_list_query(
        q,
        lq,
        sortable={
            "created_at": APIKey.created_at,
            "last_used_at": APIKey.last_used_at,
            "name": APIKey.name,
            "revoked_at": APIKey.revoked_at,
        },
        tiebreak=APIKey.id,
        default_sort="created_at",
        searchable=(APIKey.name, APIKey.key_prefix),
    )
    rows, total = await paginate(db, q, lq.limit, lq.offset)
    tenants = await tenant_info_map(db, [r.tenant_id for r in rows])
    return {
        "total": total,
        "limit": lq.limit,
        "offset": lq.offset,
        "data": [_row(r, tenants) for r in rows],
    }


@router.post("/api-keys", status_code=201)
async def create_api_key(
    body: ApiKeyCreateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("api_keys", "write")),
):
    if not admin.is_global and str(body.tenant_id) != admin.tenant_scope:
        raise HTTPException(status_code=403, detail="Outside your tenant scope")
    key, plaintext = await api_keys.issue(
        db, body.tenant_id, body.name, actor=f"admin:{admin.admin_id}"
    )
    await db.commit()
    await log_admin_action(
        admin_user_id=admin.admin_id,
        action=AuditAction.API_KEY_CREATE,
        resource="api_keys",
        target_type="api_key",
        target_id=str(key.id),
        after_value={"tenant_id": str(body.tenant_id), "name": key.name, "prefix": key.key_prefix},
        ip_address=get_client_ip(request),
    )
    tenants = await tenant_info_map(db, [key.tenant_id])
    # `key` is the only copy of the plaintext anywhere — the row holds its hash.
    return {**_row(key, tenants), "key": plaintext}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: UUID,
    request: Request,
    reason: str | None = Query(None, max_length=500),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("api_keys", "revoke")),
):
    q = update(APIKey).where(APIKey.id == key_id, APIKey.revoked_at.is_(None))
    if not admin.is_global:
        q = q.where(APIKey.tenant_id == admin.tenant_scope)
    result = await db.execute(
        q.values(revoked_at=datetime.now(UTC), revoked_by=admin.admin_id, revoke_reason=reason)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Active key not found")
    await db.commit()
    await log_admin_action(
        admin_user_id=admin.admin_id,
        action=AuditAction.API_KEY_REVOKE,
        resource="api_keys",
        target_type="api_key",
        target_id=str(key_id),
        after_value={"reason": reason},
        ip_address=get_client_ip(request),
    )
    return {"id": str(key_id), "revoked": True}
