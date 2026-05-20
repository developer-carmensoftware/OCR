"""Admin session management endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.database import get_db
from app.models.business import OcrSession

from .deps import require_admin

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/sessions")
async def list_sessions(
    active_only: bool = Query(True),
    business_unit_id: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    q = select(OcrSession).where(
        OcrSession.tenant_id == session.tenant_id,
        OcrSession.deleted_at.is_(None),
    )
    if active_only:
        q = q.where(OcrSession.is_active == True)  # noqa: E712
    if business_unit_id:
        q = q.where(OcrSession.business_unit_id == business_unit_id)
    q = q.order_by(OcrSession.last_used_at.desc()).limit(limit)

    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "total": len(rows),
        "data": [
            {
                "id": r.id,
                "business_unit_id": r.business_unit_id,
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
    session: SessionInfo = Depends(get_current_session),
    _admin: None = Depends(require_admin),
):
    result = await db.execute(
        select(OcrSession).where(
            OcrSession.id == session_id,
            OcrSession.tenant_id == session.tenant_id,
            OcrSession.deleted_at.is_(None),
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.execute(
        text("UPDATE ocr_sessions SET is_active=0 WHERE id=:id"),
        {"id": session_id},
    )
    await db.commit()
    return {"session_id": session_id, "revoked": True}
