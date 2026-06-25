"""
Unit tests for services/credit_service.py — free-quota-first then top-up credits.
Mocks DB session, transaction, and context vars.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import InsufficientCredits, ValidationError
from app.models.enums import CreditLedgerReason, QuotaPeriod, SubscriptionStatus
from app.models.orm import CreditLedger, TenantSubscription
from app.services import credit_service
from app.services.quota_service import _CachedQuota
from tests.conftest import set_context


def _monthly_quota(limit=30):
    return _CachedQuota(
        id="quota-1",
        period=QuotaPeriod.LIFETIME,
        limit_value=float(limit),
        soft_warn_pct=0.8,
        is_hard=True,
    )


def _result(first=None, scalar=None):
    r = MagicMock()
    r.first.return_value = first
    r.scalar.return_value = scalar
    r.scalar_one.return_value = scalar
    r.scalar_one_or_none.return_value = scalar
    return r


def _begin_ctx():
    b = AsyncMock()
    b.__aenter__.return_value = None
    b.__aexit__.return_value = None
    return b


def _session_ctx(mock_db):
    ctx = AsyncMock()
    ctx.__aenter__.return_value = mock_db
    ctx.__aexit__.return_value = None
    return ctx


# ── _try_consume_free ─────────────────────────────────────────────────────────


class TestTryConsumeFree:
    async def test_returns_true_when_row_updated(self):
        db = AsyncMock()
        db.execute.return_value = _result(first=(1,))  # RETURNING used
        assert await credit_service._try_consume_free(db, _monthly_quota(), 1) is True

    async def test_returns_false_when_limit_blocks_update(self):
        db = AsyncMock()
        db.execute.return_value = _result(first=None)  # WHERE excluded the row
        assert await credit_service._try_consume_free(db, _monthly_quota(), 1) is False


# ── _try_consume_subscription ─────────────────────────────────────────────────


class TestTryConsumeSubscription:
    async def test_true_when_active_window_has_allowance(self):
        db = AsyncMock()
        db.execute.return_value = _result(first=(5,))  # RETURNING docs_used
        assert await credit_service._try_consume_subscription(db, "t-001", 1) is True

    async def test_false_when_no_match(self):
        db = AsyncMock()
        db.execute.return_value = _result(first=None)  # lapsed / exhausted / none
        assert await credit_service._try_consume_subscription(db, "t-001", 1) is False


# ── _consume_credits ────────────────────────────────────────────────────────


class TestConsumeCredits:
    async def test_decrements_and_logs_when_balance_available(self):
        db = AsyncMock()
        db.add = MagicMock()
        db.execute.return_value = _result(first=(9,))  # new balance after -1
        await credit_service._consume_credits(db, "t-001", 1)

        db.add.assert_called_once()
        ledger = db.add.call_args[0][0]
        assert isinstance(ledger, CreditLedger)
        assert ledger.delta == -1
        assert ledger.balance_after == 9
        assert ledger.reason == "consumption"

    async def test_raises_when_no_balance(self):
        db = AsyncMock()
        db.add = MagicMock()
        db.execute.return_value = _result(first=None)  # guarded UPDATE matched nothing
        with pytest.raises(InsufficientCredits):
            await credit_service._consume_credits(db, "t-001", 1)
        db.add.assert_not_called()


# ── consume_document orchestration ────────────────────────────────────────────


class TestConsumeDocument:
    async def test_empty_tenant_returns_immediately(self):
        set_context("")
        with patch.object(credit_service, "async_session") as sess:
            await credit_service.consume_document()
            sess.assert_not_called()

    async def test_no_monthly_quota_is_fail_open(self):
        set_context("t-001")
        with (
            patch.object(credit_service, "_get_cached_quota_rules", AsyncMock(return_value=[])),
            patch.object(credit_service, "async_session") as sess,
        ):
            await credit_service.consume_document()  # must not raise
            sess.assert_not_called()  # never opens a txn

    async def test_subscription_consumed_first_skips_free_and_credits(self):
        """Priority: an active subscription is charged before free or credits."""
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(
                credit_service,
                "_get_cached_quota_rules",
                AsyncMock(return_value=[_monthly_quota()]),
            ),
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(credit_service, "_try_consume_subscription", AsyncMock(return_value=True)),
            patch.object(credit_service, "_try_consume_free", AsyncMock()) as tf,
            patch.object(credit_service, "_consume_credits", AsyncMock()) as cc,
        ):
            assert await credit_service.consume_document() == "subscription"
            tf.assert_not_called()
            cc.assert_not_called()

    async def test_free_path_does_not_touch_credits(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(
                credit_service,
                "_get_cached_quota_rules",
                AsyncMock(return_value=[_monthly_quota()]),
            ),
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(
                credit_service, "_try_consume_subscription", AsyncMock(return_value=False)
            ),
            patch.object(credit_service, "_try_consume_free", AsyncMock(return_value=True)),
            patch.object(credit_service, "_consume_credits", AsyncMock()) as cc,
        ):
            await credit_service.consume_document()
            cc.assert_not_called()

    async def test_falls_back_to_credits_when_free_exhausted(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(
                credit_service,
                "_get_cached_quota_rules",
                AsyncMock(return_value=[_monthly_quota()]),
            ),
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(
                credit_service, "_try_consume_subscription", AsyncMock(return_value=False)
            ),
            patch.object(credit_service, "_try_consume_free", AsyncMock(return_value=False)),
            patch.object(credit_service, "_consume_credits", AsyncMock()) as cc,
        ):
            await credit_service.consume_document()
            cc.assert_awaited_once()

    async def test_insufficient_credits_propagates(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(
                credit_service,
                "_get_cached_quota_rules",
                AsyncMock(return_value=[_monthly_quota()]),
            ),
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(
                credit_service, "_try_consume_subscription", AsyncMock(return_value=False)
            ),
            patch.object(credit_service, "_try_consume_free", AsyncMock(return_value=False)),
            patch.object(
                credit_service,
                "_consume_credits",
                AsyncMock(side_effect=InsufficientCredits("t-001")),
            ),
        ):
            with pytest.raises(InsufficientCredits):
                await credit_service.consume_document()

    async def test_returns_free_token_on_free_path(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(
                credit_service,
                "_get_cached_quota_rules",
                AsyncMock(return_value=[_monthly_quota()]),
            ),
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(
                credit_service, "_try_consume_subscription", AsyncMock(return_value=False)
            ),
            patch.object(credit_service, "_try_consume_free", AsyncMock(return_value=True)),
        ):
            assert await credit_service.consume_document() == "free"

    async def test_returns_credit_token_on_credit_path(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(
                credit_service,
                "_get_cached_quota_rules",
                AsyncMock(return_value=[_monthly_quota()]),
            ),
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(
                credit_service, "_try_consume_subscription", AsyncMock(return_value=False)
            ),
            patch.object(credit_service, "_try_consume_free", AsyncMock(return_value=False)),
            patch.object(credit_service, "_consume_credits", AsyncMock()),
        ):
            assert await credit_service.consume_document() == "credit"


# ── refund_document ───────────────────────────────────────────────────────────


class TestRefundDocument:
    async def test_none_is_noop(self):
        with patch.object(credit_service, "async_session") as sess:
            await credit_service.refund_document(None)
            sess.assert_not_called()

    async def test_credit_refund_grants_back(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(credit_service, "grant_credits", AsyncMock()) as gc,
            patch.object(credit_service, "_refund_free", AsyncMock()) as rf,
        ):
            await credit_service.refund_document("credit")
            gc.assert_awaited_once()
            assert gc.call_args[0][2] == 1  # increment
            assert gc.call_args[0][3] == CreditLedgerReason.REFUND
            rf.assert_not_called()

    async def test_free_refund_restores_slot(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(credit_service, "grant_credits", AsyncMock()) as gc,
            patch.object(credit_service, "_refund_free", AsyncMock()) as rf,
        ):
            await credit_service.refund_document("free")
            rf.assert_awaited_once()
            gc.assert_not_called()

    async def test_subscription_refund_decrements_docs_used(self):
        set_context("t-001")
        db = AsyncMock()
        db.begin = MagicMock(return_value=_begin_ctx())
        with (
            patch.object(credit_service, "async_session", return_value=_session_ctx(db)),
            patch.object(credit_service, "_refund_subscription", AsyncMock()) as rs,
            patch.object(credit_service, "grant_credits", AsyncMock()) as gc,
            patch.object(credit_service, "_refund_free", AsyncMock()) as rf,
        ):
            await credit_service.refund_document("subscription")
            rs.assert_awaited_once()
            gc.assert_not_called()
            rf.assert_not_called()

    async def test_refund_failure_is_swallowed(self):
        set_context("t-001")
        with patch.object(credit_service, "async_session", side_effect=RuntimeError("db down")):
            await credit_service.refund_document("credit")  # must not raise


# ── grant_credits ─────────────────────────────────────────────────────────────


class TestGrantCredits:
    async def test_grants_and_logs(self):
        db = AsyncMock()
        db.add = MagicMock()
        db.execute.return_value = _result(scalar=100)
        balance = await credit_service.grant_credits(
            db, "t-001", 100, CreditLedgerReason.TOPUP, pack_code="p100"
        )

        assert balance == 100
        ledger = db.add.call_args[0][0]
        assert ledger.delta == 100
        assert ledger.reason == CreditLedgerReason.TOPUP
        assert ledger.pack_code == "p100"

    async def test_negative_result_raises(self):
        db = AsyncMock()
        db.add = MagicMock()
        db.execute.return_value = _result(scalar=-5)  # adjustment overdrew the balance
        with pytest.raises(ValidationError):
            await credit_service.grant_credits(db, "t-001", -50, CreditLedgerReason.ADMIN_ADJUST)
        db.add.assert_not_called()


# ── get_active_subscription — display-reset on cycle roll ────────────────────


def _make_sub(*, period_start, period_end, cycle_start, docs_used=42, billing_period="annual"):
    sub = TenantSubscription()
    sub.id = "sub-1"  # type: ignore[assignment]
    sub.tenant_id = "t-001"  # type: ignore[assignment]
    sub.plan_code = "sub_pro"  # type: ignore[assignment]
    sub.doc_allowance = 1500  # type: ignore[assignment]
    sub.docs_used = docs_used  # type: ignore[assignment]
    sub.period_start = period_start
    sub.period_end = period_end
    sub.billing_period = billing_period  # type: ignore[assignment]
    sub.cycle_start = cycle_start
    sub.status = SubscriptionStatus.ACTIVE  # type: ignore[assignment]
    return sub


class TestGetActiveSubscriptionDisplayReset:
    """get_active_subscription should show docs_used=0 when the cycle has rolled."""

    async def test_cycle_rolled_resets_docs_used_to_zero(self):
        start = datetime(2026, 6, 24, 0, 0, tzinfo=UTC)
        end = datetime(2027, 6, 23, 23, 59, tzinfo=UTC)
        old_cycle = datetime(2026, 6, 24, 0, 0, tzinfo=UTC)
        new_cycle_target = datetime(2026, 7, 24, 0, 0, tzinfo=UTC)

        sub = _make_sub(
            period_start=start,
            period_end=end,
            cycle_start=old_cycle,
            docs_used=500,
        )

        mock_db = AsyncMock()
        # Only the fn_cycle_start query goes through db.execute here;
        # active_subscription is patched out.
        mock_db.execute = AsyncMock(return_value=_result(scalar=new_cycle_target))
        mock_db.expunge = MagicMock()

        with (
            patch.object(credit_service, "async_session", return_value=_session_ctx(mock_db)),
            patch.object(credit_service, "active_subscription", AsyncMock(return_value=sub)),
        ):
            result = await credit_service.get_active_subscription("t-001")

        assert result is not None
        assert result.docs_used == 0

    async def test_same_cycle_keeps_docs_used(self):
        start = datetime(2026, 6, 24, 0, 0, tzinfo=UTC)
        end = datetime(2027, 6, 23, 23, 59, tzinfo=UTC)
        same_cycle = datetime(2026, 6, 24, 0, 0, tzinfo=UTC)

        sub = _make_sub(
            period_start=start,
            period_end=end,
            cycle_start=same_cycle,
            docs_used=123,
        )

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=_result(scalar=same_cycle))
        mock_db.expunge = MagicMock()

        with (
            patch.object(credit_service, "async_session", return_value=_session_ctx(mock_db)),
            patch.object(credit_service, "active_subscription", AsyncMock(return_value=sub)),
        ):
            result = await credit_service.get_active_subscription("t-001")

        assert result is not None
        assert result.docs_used == 123

    async def test_monthly_sub_never_resets_within_window(self):
        start = datetime(2026, 6, 24, 0, 0, tzinfo=UTC)
        end = datetime(2026, 7, 23, 23, 59, tzinfo=UTC)

        sub = _make_sub(
            period_start=start,
            period_end=end,
            cycle_start=start,
            docs_used=80,
            billing_period="monthly",
        )

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=_result(scalar=start))
        mock_db.expunge = MagicMock()

        with (
            patch.object(credit_service, "async_session", return_value=_session_ctx(mock_db)),
            patch.object(credit_service, "active_subscription", AsyncMock(return_value=sub)),
        ):
            result = await credit_service.get_active_subscription("t-001")

        assert result is not None
        assert result.docs_used == 80

    async def test_no_subscription_returns_none(self):
        mock_db = AsyncMock()

        with (
            patch.object(credit_service, "async_session", return_value=_session_ctx(mock_db)),
            patch.object(credit_service, "active_subscription", AsyncMock(return_value=None)),
        ):
            result = await credit_service.get_active_subscription("t-001")

        assert result is None

    async def test_empty_tenant_returns_none(self):
        result = await credit_service.get_active_subscription("")
        assert result is None


# ── proration_credit ─────────────────────────────────────────────────────────


class TestProrationCredit:
    def test_full_period_remaining(self):
        from decimal import Decimal

        start = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
        end = datetime(2026, 6, 30, 23, 59, 59, tzinfo=UTC)
        now = start
        result = credit_service.proration_credit(Decimal("490.00"), start, end, now)
        assert result == Decimal("490.00")

    def test_expired_returns_zero(self):
        from decimal import Decimal

        start = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
        end = datetime(2026, 6, 30, 23, 59, 59, tzinfo=UTC)
        now = datetime(2026, 7, 5, 0, 0, tzinfo=UTC)
        result = credit_service.proration_credit(Decimal("490.00"), start, end, now)
        assert result == Decimal("0.00")

    def test_half_period(self):
        from decimal import Decimal

        start = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
        end = datetime(2026, 7, 1, 0, 0, tzinfo=UTC)
        mid = datetime(2026, 6, 16, 0, 0, tzinfo=UTC)
        result = credit_service.proration_credit(Decimal("300.00"), start, end, mid)
        assert result == Decimal("150.00")

    def test_annual_plan_midway(self):
        from decimal import Decimal

        start = datetime(2026, 1, 1, 0, 0, tzinfo=UTC)
        end = datetime(2026, 12, 31, 0, 0, tzinfo=UTC)
        now = datetime(2026, 7, 2, 12, 0, tzinfo=UTC)  # ~half year
        net = credit_service.annual_price(Decimal("490"))  # 5292.00
        result = credit_service.proration_credit(net, start, end, now)
        assert Decimal("2500") < result < Decimal("2700")

    def test_zero_length_period(self):
        from decimal import Decimal

        t = datetime(2026, 6, 1, 0, 0, tzinfo=UTC)
        result = credit_service.proration_credit(Decimal("100.00"), t, t, t)
        assert result == Decimal("0.00")
