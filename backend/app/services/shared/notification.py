"""In-app notification service — credit-order status events."""

from __future__ import annotations

import uuid as _uuid
from collections.abc import Callable
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


async def notify_collapsed(
    db: AsyncSession,
    *,
    tenant_id: _uuid.UUID,
    type_: str,
    key: str,
    build_payload: Callable[[dict[str, Any] | None], dict[str, Any]],
) -> None:
    """Like `notify`, but folds into the tenant's existing *unread* row of this
    `(type_, key)` instead of adding a new one: replaces its payload and bumps
    `created_at` back to the top of the bell. Once the customer reads that row, the
    next call starts a fresh one — so the bell rings again on new activity but never
    piles up rows for a queue nobody has looked at yet.

    `key` lives inside `payload`, not as a column — email-ingest folds the review
    queue's count under `key="queue"` and each blocked/failed reason under
    `key=reason_code`, without a schema change.

    `build_payload(existing_payload_or_None)` computes the new payload from what was
    there before — a running "N since you last looked" count for an event, or just the
    latest live figure for a gauge like queue size, which ignores it. Caller owns the
    commit, same as `notify`.
    """
    existing = await db.scalar(
        select(UserNotification)
        .where(
            UserNotification.tenant_id == tenant_id,
            UserNotification.type == type_,
            UserNotification.read_at.is_(None),
        )
        .order_by(UserNotification.created_at.desc())
    )
    if existing is not None and existing.payload.get("key") != key:
        existing = None
    payload = build_payload(existing.payload if existing else None)  # type: ignore[arg-type]
    payload["key"] = key
    if existing is not None:
        existing.payload = payload  # type: ignore[assignment]
        existing.created_at = datetime.now(UTC)  # type: ignore[assignment]
    else:
        notify(db, tenant_id=tenant_id, order_id=None, type_=type_, payload=payload)


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
