"""In-app notification service — credit-order status events."""

from __future__ import annotations

import uuid as _uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import UserNotification


def notify(
    db: AsyncSession,
    *,
    tenant_id: _uuid.UUID,
    order_id: _uuid.UUID | None,
    type_: str,
    payload: dict[str, Any] | None = None,
) -> None:
    """Append a notification row. Caller owns the commit."""
    db.add(
        UserNotification(
            tenant_id=tenant_id,
            order_id=order_id,
            type=type_,
            payload=payload or {},
            created_at=datetime.now(UTC),
        )
    )


async def list_notifications(
    db: AsyncSession,
    tenant_id: _uuid.UUID,
    limit: int = 50,
) -> tuple[list[UserNotification], int]:
    """Return (newest-first items, unread_count) for the tenant."""
    rows_q = (
        select(UserNotification)
        .where(UserNotification.tenant_id == tenant_id)
        .order_by(UserNotification.created_at.desc())
        .limit(limit)
    )
    unread_q = select(func.count()).where(
        UserNotification.tenant_id == tenant_id,
        UserNotification.read_at.is_(None),
    )
    items = list((await db.execute(rows_q)).scalars().all())
    unread = (await db.execute(unread_q)).scalar_one()
    return items, unread


async def mark_read(
    db: AsyncSession,
    tenant_id: _uuid.UUID,
    ids: list[str] | None = None,
) -> int:
    """Flip read_at on unread notifications. ids=None marks all. Returns count updated."""
    stmt = (
        update(UserNotification)
        .where(
            UserNotification.tenant_id == tenant_id,
            UserNotification.read_at.is_(None),
        )
        .values(read_at=func.now())
    )
    if ids:
        parsed = [_uuid.UUID(i) for i in ids]
        stmt = stmt.where(UserNotification.id.in_(parsed))
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount
