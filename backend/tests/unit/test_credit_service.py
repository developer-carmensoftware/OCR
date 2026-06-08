"""
Unit tests for services/credit_service.py — free-quota-first then top-up credits.
Mocks DB session, transaction, and context vars.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import InsufficientCredits, ValidationError
from app.models.enums import CreditLedgerReason, QuotaPeriod
from app.models.orm import CreditLedger
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
    r.scalar_one.return_value = scalar
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
            patch.object(credit_service, "_try_consume_free", AsyncMock(return_value=False)),
            patch.object(
                credit_service,
                "_consume_credits",
                AsyncMock(side_effect=InsufficientCredits("t-001")),
            ),
        ):
            with pytest.raises(InsufficientCredits):
                await credit_service.consume_document()


# ── grant_credits ─────────────────────────────────────────────────────────────


class TestGrantCredits:
    async def test_grants_and_logs(self):
        db = AsyncMock()
        db.add = MagicMock()
        db.execute.return_value = _result(scalar=100)
        balance = await credit_service.grant_credits(db, "t-001", 100, CreditLedgerReason.TOPUP, pack_code="p100")

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
