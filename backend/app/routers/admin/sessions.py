"""Admin session management endpoints."""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin_session import AdminPrincipal
from app.database import get_db
from app.models.business import OcrSession
from app.services.tenant_lookup import tenant_name_map
from app.utils.pagination import paginate

from ._query import ListQuery, apply_list_query, list_query
from .deps import require_permission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sessions")
async def list_sessions(
    # Sessions are scrubbed to is_active=false after an hour and retained 90 days
    # (fn_purge_inactive_sessions), so this list is login history, not just live state.
    # Defaulting to active_only would show at most the last hour of it.
    active_only: bool = Query(False),
    tenant_id: str | None = Query(None),
    from_date: datetime | None = Query(None, alias="from"),
    to_date: datetime | None = Query(None, alias="to"),
    lq: ListQuery = Depends(list_query),
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "read")),
):
    tid = tenant_id if admin.is_global else admin.tenant_scope
    q = select(OcrSession).where(OcrSession.deleted_at.is_(None))
    if tid:
        q = q.where(OcrSession.tenant_id == tid)
    if active_only:
        q = q.where(OcrSession.is_active == True)  # noqa: E712
    # On created_at, not last_used_at: the reader picking a range means "who logged in
    # that week", and last_used_at moves every time a session is touched.
    if from_date:
        q = q.where(OcrSession.created_at >= from_date)
    if to_date:
        q = q.where(OcrSession.created_at <= to_date)

    q = apply_list_query(
        q,
        lq,
        sortable={
            "last_used_at": OcrSession.last_used_at,
            "created_at": OcrSession.created_at,
            "username": OcrSession.username,
            "is_active": OcrSession.is_active,
        },
        tiebreak=OcrSession.id,
        default_sort="last_used_at",
        searchable=(OcrSession.username, OcrSession.carmen_user_id),
    )
    # Counted off the unlimited statement — `len(rows)` here meant the login history
    # page could never say how much of it there was.
    rows, total = await paginate(db, q, lq.limit, lq.offset)
    names = await tenant_name_map(db, [r.tenant_id for r in rows])
    return {
        "total": total,
        "limit": lq.limit,
        "offset": lq.offset,
        "data": [
            {
                "id": r.id,
                "tenant_id": r.tenant_id,
                "tenant_name": names.get(str(r.tenant_id)),
                "carmen_user_id": r.carmen_user_id,
                "username": r.username,
                "is_active": r.is_active,
                "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    admin: AdminPrincipal = Depends(require_permission("tenants", "write")),
):
    q = select(OcrSession).where(
        OcrSession.id == session_id,
        OcrSession.deleted_at.is_(None),
    )
    if not admin.is_global:
        q = q.where(OcrSession.tenant_id == admin.tenant_scope)

    result = await db.execute(q)
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.execute(
        text("UPDATE ocr_sessions SET is_active=false WHERE id=:id"),
        {"id": session_id},
    )
    await db.commit()

    from app.auth.dependencies import invalidate_session_cache

    invalidate_session_cache(session_id)

    return {"session_id": session_id, "revoked": True}
