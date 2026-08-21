"""In-app notification endpoints — credit-order status events."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import SessionInfo, get_current_session
from app.database import get_db
from app.models.schemas.notifications import (
    MarkReadRequest,
    NotificationListResponse,
    NotificationResponse,
)
from app.services import notification_service

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(8, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    items, total, unread_count = await notification_service.list_notifications(
        db, uuid.UUID(str(session.tenant_id)), limit=limit, offset=offset
    )
    return NotificationListResponse(
        total=total,
        limit=limit,
        offset=offset,
        data=[NotificationResponse.model_validate(n) for n in items],
        unread_count=unread_count,
    )


@router.post("/mark-read")
async def mark_notifications_read(
    body: MarkReadRequest,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    updated = await notification_service.mark_read(db, uuid.UUID(str(session.tenant_id)), body.ids)
    return {"updated": updated}
