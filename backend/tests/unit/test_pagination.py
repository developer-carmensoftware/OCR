"""`paginate()` builds two statements from one. These check the shapes it emits.

Compiling the SQL is enough here — the interesting part is *what* it asks Postgres for
(COUNT over the unlimited, unordered query vs. the windowed rows), not the round trip.
"""

import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.models.billing import UserNotification
from app.utils.pagination import paginate


def _sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect())).lower()


class _CapturingDb:
    """Records the statements handed to execute(); answers COUNT then rows."""

    def __init__(self, rows, total):
        self.rows = rows
        self.total = total
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        result = MagicMock()
        if len(self.statements) == 1:
            result.scalar_one.return_value = self.total
        else:
            result.scalars.return_value.all.return_value = self.rows
        return result


def _stmt():
    return (
        select(UserNotification)
        .where(UserNotification.tenant_id == uuid.uuid4())
        .order_by(UserNotification.created_at.desc())
    )


@pytest.mark.asyncio
async def test_total_counts_all_rows_not_the_window():
    db = _CapturingDb(rows=["a", "b"], total=57)

    rows, total = await paginate(db, _stmt(), limit=2, offset=0)

    assert rows == ["a", "b"]
    # The whole point: returning len(rows) here is the bug this helper exists to stop.
    assert total == 57


@pytest.mark.asyncio
async def test_count_query_carries_no_limit_or_order_by():
    db = _CapturingDb(rows=[], total=0)

    await paginate(db, _stmt(), limit=5, offset=10)

    count_sql = _sql(db.statements[0])
    assert "count(*)" in count_sql
    # LIMIT inside the COUNT would cap the total at the page size; ORDER BY would make
    # Postgres sort rows it is only going to tally.
    assert "limit" not in count_sql
    assert "order by" not in count_sql


@pytest.mark.asyncio
async def test_row_query_keeps_the_window_and_the_ordering():
    db = _CapturingDb(rows=[], total=0)

    await paginate(db, _stmt(), limit=5, offset=10)

    row_sql = _sql(db.statements[1])
    assert "order by" in row_sql
    assert "limit" in row_sql
    assert "offset" in row_sql
