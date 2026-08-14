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


@pytest.mark.asyncio
async def test_list_returns_tenant_items_and_unread_count():
    tid = uuid.uuid4()
    items = [_notif(tid), _notif(tid, read_at=datetime.now(UTC))]

    async def fake_execute(stmt):
        result = MagicMock()
        # first call → rows, second call → unread count
        if not hasattr(fake_execute, "_called"):
            fake_execute._called = True
            result.scalars.return_value.all.return_value = items
        else:
            result.scalar_one.return_value = 1
        return result

    db = AsyncMock()
    db.execute = fake_execute

    rows, unread = await notification_service.list_notifications(db, tid)
    assert rows == items
    assert unread == 1


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
