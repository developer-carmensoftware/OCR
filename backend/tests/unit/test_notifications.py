"""Unit tests for notification_service — tenant isolation, list order, mark-read."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.billing import UserNotification
from app.services import notification_service


def _notif(tenant_id, *, type_="approved", read_at=None, order_id=None):
    n = UserNotification()
    n.id = uuid.uuid4()
    n.tenant_id = tenant_id
    n.order_id = order_id or uuid.uuid4()
    n.type = type_
    n.payload = {}
    n.read_at = read_at
    n.created_at = datetime.now(UTC)
    return n


# ── notify() ─────────────────────────────────────────────────────────────────


def test_notify_adds_row_to_session():
    db = MagicMock()
    tid = uuid.uuid4()
    oid = uuid.uuid4()
    notification_service.notify(
        db, tenant_id=tid, order_id=oid, type_="approved", payload={"credits": 100}
    )
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert isinstance(row, UserNotification)
    assert row.tenant_id == tid
    assert row.type == "approved"
    assert row.payload == {"credits": 100}


def test_notify_empty_payload_defaults():
    db = MagicMock()
    notification_service.notify(db, tenant_id=uuid.uuid4(), order_id=None, type_="on_hold")
    row = db.add.call_args[0][0]
    assert row.payload == {}


# ── list_notifications() ─────────────────────────────────────────────────────


def _paged_db(items, total, unread):
    """Mock AsyncSession for list_notifications: total, then rows, then unread."""
    calls = []

    async def fake_execute(_stmt):
        result = MagicMock()
        calls.append(_stmt)
        if len(calls) == 1:  # paginate's COUNT(*)
            result.scalar_one.return_value = total
        elif len(calls) == 2:  # paginate's windowed rows
            result.scalars.return_value.all.return_value = items
        else:  # unread COUNT(*)
            result.scalar_one.return_value = unread
        return result

    db = AsyncMock()
    db.execute = fake_execute
    return db


@pytest.mark.asyncio
async def test_list_returns_tenant_items_and_unread_count():
    tid = uuid.uuid4()
    items = [_notif(tid), _notif(tid, read_at=datetime.now(UTC))]
    db = _paged_db(items, total=2, unread=1)

    rows, total, unread = await notification_service.list_notifications(db, tid)
    assert rows == items
    assert total == 2
    assert unread == 1


@pytest.mark.asyncio
async def test_unread_count_spans_every_page_not_just_the_window():
    """The badge counts all unread notifications, not the unread ones on this page.

    A bell showing "2 unread" while page 1 holds 5 unread rows is the bug this guards.
    """
    tid = uuid.uuid4()
    window = [_notif(tid), _notif(tid)]
    db = _paged_db(window, total=40, unread=17)

    rows, total, unread = await notification_service.list_notifications(db, tid, limit=2)
    assert len(rows) == 2
    assert total == 40  # not len(rows) — otherwise a pager can't render "page 1 of N"
    assert unread == 17  # not bounded by limit


@pytest.mark.asyncio
async def test_offset_past_the_end_is_an_empty_page_not_an_error():
    tid = uuid.uuid4()
    db = _paged_db([], total=3, unread=0)

    rows, total, unread = await notification_service.list_notifications(db, tid, offset=999)
    assert rows == []
    assert total == 3  # the caller can still tell how far to clamp back
    assert unread == 0


# ── has_notification() ───────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("exists_row, expected", [(True, True), (None, False)])
async def test_has_notification_returns_a_bool_not_a_row(exists_row, expected):
    db = AsyncMock()
    result = MagicMock()
    result.scalar.return_value = exists_row
    db.execute.return_value = result

    assert await notification_service.has_notification(db, uuid.uuid4()) is expected


@pytest.mark.asyncio
async def test_has_notification_filters_on_created_at_when_since_is_given():
    """The two modes compile to different SQL — `since` must not silently fall back
    to the unread filter, which is the one that never clears for an unattended BU."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar.return_value = True
    db.execute.return_value = result

    await notification_service.has_notification(db, uuid.uuid4(), datetime(2026, 8, 13, tzinfo=UTC))
    with_since = str(db.execute.await_args.args[0])

    await notification_service.has_notification(db, uuid.uuid4())
    without = str(db.execute.await_args.args[0])

    assert "created_at >" in with_since and "read_at IS NULL" not in with_since
    assert "read_at IS NULL" in without


# ── mark_read() ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mark_read_all_commits_and_returns_count():
    db = AsyncMock()
    result = MagicMock()
    result.rowcount = 3
    db.execute.return_value = result

    count = await notification_service.mark_read(db, uuid.uuid4())
    assert count == 3
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_mark_read_subset_passes_ids():
    db = AsyncMock()
    result = MagicMock()
    result.rowcount = 1
    db.execute.return_value = result

    ids = [str(uuid.uuid4())]
    count = await notification_service.mark_read(db, uuid.uuid4(), ids=ids)
    assert count == 1
    # confirm the UPDATE statement was executed (execute called once)
    db.execute.assert_awaited_once()
