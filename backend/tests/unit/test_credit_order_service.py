"""credit_order_service: the order state machine and tenant-scope guard.

These transitions move money — approve() grants credits or opens a subscription
window — so the guard that decides *whether* a transition is allowed is the part
worth pinning. Pure-logic functions run against a plain object; the two async
paths use the shared mock DB from conftest.
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import ConflictError, NotFoundError
from app.models.enums import CreditOrderStatus
from app.services import credit_order_service as cos
from tests.conftest import make_mock_db


def _order(status=CreditOrderStatus.IN_PROGRESS, tenant_id="t-001", **kw):
    """A CreditOrder stand-in — these functions only touch plain attributes."""
    fields = {
        "id": "ord-1",
        "tenant_id": tenant_id,
        "status": status,
        "pack_code": "GROWTH",
        "credits": 500,
        "billing_period": "monthly",
        "admin_note": None,
        "rejected_reason": None,
        "deleted_at": None,
        "paid_at": None,
        "approved_at": None,
        "slip_object_key": None,
    }
    fields.update(kw)
    return SimpleNamespace(**fields)


# ── The decidable guard ───────────────────────────────────────────────────────


@pytest.mark.parametrize("status", [CreditOrderStatus.IN_PROGRESS, CreditOrderStatus.ON_HOLD])
def test_open_orders_are_decidable(status):
    cos.ensure_decidable(_order(status))  # no raise


@pytest.mark.parametrize(
    "status", [CreditOrderStatus.PAID, CreditOrderStatus.VOID, CreditOrderStatus.COMPLETE]
)
def test_settled_orders_are_not_decidable(status):
    """The double-fulfilment guard: a paid order must never be approvable again."""
    with pytest.raises(ConflictError):
        cos.ensure_decidable(_order(status))


# ── Tenant scope ──────────────────────────────────────────────────────────────


def test_global_admin_is_in_scope_for_any_tenant():
    assert cos._in_scope(_order(tenant_id="t-999"), is_global=True, tenant_scope="t-001")


def test_scoped_admin_is_in_scope_only_for_their_own_tenant():
    order = _order(tenant_id="t-001")
    assert cos._in_scope(order, is_global=False, tenant_scope="t-001")
    assert not cos._in_scope(order, is_global=False, tenant_scope="t-002")


# ── reject / hold / cancel ────────────────────────────────────────────────────


def test_reject_voids_with_a_reason():
    order = _order()
    cos.reject(order, "slip unreadable")
    assert order.status == CreditOrderStatus.VOID
    assert order.rejected_reason == "slip unreadable"


def test_reject_refuses_a_settled_order():
    order = _order(CreditOrderStatus.PAID)
    with pytest.raises(ConflictError):
        cos.reject(order, "too late")
    assert order.status == CreditOrderStatus.PAID  # unchanged


def test_hold_trims_the_note_and_leaves_status_alone():
    order = _order()
    cos.hold(order, "  call the buyer  ")
    assert order.admin_note == "call the buyer"
    # hold() edits the note only — parking an order is hold_batch's job.
    assert order.status == CreditOrderStatus.IN_PROGRESS


@pytest.mark.parametrize("note", ["", "   ", None])
def test_hold_normalizes_an_empty_note_to_none(note):
    order = _order(admin_note="previous")
    cos.hold(order, note)
    assert order.admin_note is None


def test_cancel_voids_and_soft_deletes():
    order = _order()
    cos.cancel(order)
    assert order.status == CreditOrderStatus.VOID
    assert order.deleted_at is not None


def test_cancel_refuses_a_settled_order():
    with pytest.raises(ConflictError):
        cos.cancel(_order(CreditOrderStatus.PAID))


# ── Lookup ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("fetch", [cos.get_order, cos.get_order_for_update])
async def test_missing_order_raises_not_found(fetch):
    db = make_mock_db()
    db.execute.return_value.scalar_one_or_none.return_value = None
    with pytest.raises(NotFoundError):
        await fetch(db, "nope")


@pytest.mark.asyncio
async def test_get_slip_url_without_a_slip_raises_not_found():
    with pytest.raises(NotFoundError):
        await cos.get_slip_url(_order(slip_object_key=None))


# ── approve: the two fulfilment paths ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_approve_topup_grants_credits_and_marks_paid():
    db = make_mock_db()
    db.execute.return_value.scalar_one_or_none.return_value = SimpleNamespace(kind="topup")

    with patch.object(cos, "grant_credits", AsyncMock(return_value=1500)) as grant:
        with patch.object(cos, "activate_subscription", AsyncMock()) as activate:
            summary = await cos.approve(db, order := _order())

    grant.assert_awaited_once()
    activate.assert_not_awaited()
    assert "1500" in summary
    assert order.status == CreditOrderStatus.PAID
    assert order.paid_at is not None
    assert order.approved_at is not None


@pytest.mark.asyncio
async def test_approve_subscription_pack_opens_a_window_instead():
    db = make_mock_db()
    db.execute.return_value.scalar_one_or_none.return_value = SimpleNamespace(kind="subscription")

    with patch.object(cos, "activate_subscription", AsyncMock()) as activate:
        with patch.object(cos, "grant_credits", AsyncMock()) as grant:
            summary = await cos.approve(db, order := _order())

    activate.assert_awaited_once()
    grant.assert_not_awaited()
    assert summary == "subscription"
    assert order.status == CreditOrderStatus.PAID


@pytest.mark.asyncio
async def test_approve_refuses_an_already_paid_order_before_touching_credits():
    """The guard has to fire before any grant, or a double-click double-grants."""
    db = make_mock_db()
    with patch.object(cos, "grant_credits", AsyncMock()) as grant:
        with pytest.raises(ConflictError):
            await cos.approve(db, _order(CreditOrderStatus.PAID))
    grant.assert_not_awaited()


@pytest.mark.asyncio
async def test_approve_falls_back_to_credits_when_the_pack_is_unknown():
    """An order referencing a delisted pack still fulfils as a top-up rather than
    silently doing nothing."""
    db = make_mock_db()
    db.execute.return_value.scalar_one_or_none.return_value = None

    with patch.object(cos, "grant_credits", AsyncMock(return_value=42)) as grant:
        await cos.approve(db, order := _order())

    grant.assert_awaited_once()
    assert order.status == CreditOrderStatus.PAID


# ── hold_batch: per-order outcomes ────────────────────────────────────────────


def _db_returning(orders: dict):
    """Mock DB whose SELECT ... FOR UPDATE resolves ids from `orders`."""
    db = AsyncMock()
    seq = list(orders.values())
    results = []
    for row in seq:
        r = MagicMock()
        r.scalar_one_or_none.return_value = row
        results.append(r)
    db.execute.side_effect = results
    return db


@pytest.mark.asyncio
async def test_hold_batch_parks_in_progress_orders_and_notifies():
    order = _order()
    db = _db_returning({"ord-1": order})

    with patch.object(cos.notification_service, "notify") as notify:
        results = await cos.hold_batch(db, ["ord-1"], is_global=True, tenant_scope="t-001")

    assert results[0].success is True
    assert order.status == CreditOrderStatus.ON_HOLD
    notify.assert_called_once()
    assert notify.call_args.kwargs["type_"] == "on_hold"


@pytest.mark.asyncio
async def test_hold_batch_reports_a_missing_order_without_aborting():
    db = _db_returning({"gone": None})
    results = await cos.hold_batch(db, ["gone"], is_global=True, tenant_scope="t-001")
    assert results[0].success is False
    assert "Not found" in (results[0].error or "")


@pytest.mark.asyncio
async def test_hold_batch_refuses_an_order_outside_the_admin_scope():
    """A scoped admin must not park another tenant's order."""
    order = _order(tenant_id="t-999")
    db = _db_returning({"ord-1": order})

    results = await cos.hold_batch(db, ["ord-1"], is_global=False, tenant_scope="t-001")

    assert results[0].success is False
    assert "out of scope" in (results[0].error or "").lower()
    assert order.status == CreditOrderStatus.IN_PROGRESS  # untouched


@pytest.mark.asyncio
async def test_hold_batch_skips_orders_that_are_not_in_progress():
    """on_hold is decidable for hold()/reject(), but hold_batch only parks
    in_progress — re-parking an already-parked order is a no-op, not an error."""
    order = _order(CreditOrderStatus.ON_HOLD)
    db = _db_returning({"ord-1": order})

    results = await cos.hold_batch(db, ["ord-1"], is_global=True, tenant_scope="t-001")

    assert results[0].success is False
    assert "expected in_progress" in (results[0].error or "")


@pytest.mark.asyncio
async def test_hold_batch_keeps_going_after_a_failure():
    ok, bad = _order(), _order(CreditOrderStatus.PAID)
    db = _db_returning({"a": bad, "b": ok})

    with patch.object(cos.notification_service, "notify"):
        results = await cos.hold_batch(db, ["a", "b"], is_global=True, tenant_scope="t-001")

    assert [r.success for r in results] == [False, True]
    assert ok.status == CreditOrderStatus.ON_HOLD


def test_datetime_stamps_are_timezone_aware():
    """paid_at/approved_at feed billing periods; a naive stamp shifts them by
    the server's offset."""
    order = _order()
    cos.cancel(order)
    assert order.deleted_at.tzinfo is not None
    assert order.deleted_at.astimezone(UTC) <= datetime.now(UTC)
