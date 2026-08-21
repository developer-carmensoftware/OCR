"""In-app notification service — credit-order status events."""

from __future__ import annotations

import uuid as _uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import UserNotification
from app.utils.pagination import paginate


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
    limit: int = 8,
    offset: int = 0,
) -> tuple[list[UserNotification], int, int]:
    """Return (newest-first window, total, unread_count) for the tenant.

    `unread_count` deliberately ignores the window: the bell's badge must report every
    unread notification, not just the unread ones that happen to be on this page.
    """
    stmt = (
        select(UserNotification)
        .where(UserNotification.tenant_id == tenant_id)
        .order_by(UserNotification.created_at.desc())
    )
    items, total = await paginate(db, stmt, limit, offset)
    unread_q = select(func.count()).where(
        UserNotification.tenant_id == tenant_id,
        UserNotification.read_at.is_(None),
    )
    unread = (await db.execute(unread_q)).scalar_one()
    return items, total, unread


async def has_notification(
    db: AsyncSession,
    tenant_id: _uuid.UUID,
    since: datetime | None = None,
) -> bool:
    """Is there anything worth putting a badge on? EXISTS, not a count.

    `since` given → anything created after it. That is the form that keeps working
    for a BU nobody ever opens our app for: the caller owns the cursor, so the badge
    clears when *they* decide it was seen.

    `since` omitted → anything unread, which only ever clears through `mark_read`
    (our own bell). Fine for a caller that shares that bell, permanently true for one
    that does not.
    """
    q = select(UserNotification.id).where(UserNotification.tenant_id == tenant_id)
    q = q.where(
        UserNotification.created_at > since if since else UserNotification.read_at.is_(None)
    )
    return bool((await db.execute(select(q.exists()))).scalar())


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
