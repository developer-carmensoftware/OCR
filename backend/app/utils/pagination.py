"""Offset pagination for list endpoints.

One helper and one envelope (`app.models.schemas.common.Page`) so every list endpoint
answers the same shape. Converges the three that grew organically: `{total, data}`
(admin/tenants), `{count, has_more, data}` (admin/usage), `{total, tasks}` (ocr).

ponytail: offset paging, not keyset. A row inserted while the user sits on page 2
shifts the window, which is harmless for settled orders and append-only logs at our
volumes. Upgrade path if it ever bites: keyset on `(created_at, id)`.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def count_rows(db: AsyncSession, stmt: Select[Any]) -> int:
    """Total rows the statement matches, ignoring any LIMIT/OFFSET on it.

    Returning `len(rows)` instead is a real bug this repo has already shipped twice
    (see the comment on `GET /admin/tenants`): the caller then has no way to know the
    list was truncated, and a pager built on it can never render "page 1 of N".
    """
    # order_by(None): ORDER BY is meaningless inside a COUNT and Postgres would have to
    # sort rows it is only going to tally.
    return (
        await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))
    ).scalar_one()


async def paginate(
    db: AsyncSession,
    stmt: Select[Any],
    limit: int,
    offset: int,
) -> tuple[list[Any], int]:
    """Return (rows for this window, total matching rows).

    For a statement selecting one entity. A multi-entity select (`select(A, B)`) returns
    tuples, which `.scalars()` would flatten to just `A` — those callers pair
    `count_rows()` with their own `.all()` instead.
    """
    total = await count_rows(db, stmt)
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return list(rows), total
