"""
Unit tests for services/usage_service.py
Mocks DB session and context vars.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.exceptions import RateLimitExceeded
from app.models.enums import QuotaPeriod
from app.services.usage_service import _estimate_cost, _period_key
from tests.conftest import set_context

# ── _period_key ───────────────────────────────────────────────────────────────


class TestPeriodKey:
    def test_B4_9_monthly_format(self):
        key = _period_key(QuotaPeriod.MONTHLY)
        assert len(key) == 7  # "YYYY-MM"
        assert key[4] == "-"

    def test_daily_format(self):
        key = _period_key(QuotaPeriod.DAILY)
        assert len(key) == 10  # "YYYY-MM-DD"
        parts = key.split("-")
        assert len(parts) == 3

    def test_yearly_format(self):
        key = _period_key(QuotaPeriod.YEARLY)
        assert len(key) == 4  # "YYYY"
        assert key.isdigit()


# ── _estimate_cost ────────────────────────────────────────────────────────────


class TestEstimateCost:
    def test_calculates_cost_per_million_tokens(self):
        # $1 per 1M prompt, $2 per 1M completion
        rates = (Decimal("1.0"), Decimal("2.0"))
        cost = _estimate_cost(1_000_000, 1_000_000, rates)
        assert float(cost) == pytest.approx(3.0, rel=1e-3)

    def test_zero_tokens_returns_zero(self):
        rates = (Decimal("1.0"), Decimal("2.0"))
        cost = _estimate_cost(0, 0, rates)
        assert float(cost) == 0.0


# ── check_quota ───────────────────────────────────────────────────────────────


def _make_quota(limit=100, soft_pct=0.8, is_hard=True, period=QuotaPeriod.MONTHLY):
    q = MagicMock()
    q.id = "quota-1"
    q.period = period
    q.limit_value = Decimal(str(limit))
    q.soft_warn_pct = Decimal(str(soft_pct))
    q.is_hard = is_hard
    return q


def _make_usage(used: float):
    u = MagicMock()
    u.used = Decimal(str(used))
    return u


@pytest.fixture(autouse=True)
def _clear_quota_cache():
    """Ensure the module-level quota-rules cache is empty between tests."""
    from app.services import quota_service

    quota_service._QUOTA_RULES_CACHE.clear()
    yield
    quota_service._QUOTA_RULES_CACHE.clear()


class TestCheckQuota:
    def _mock_db_session(self, quota, usage):
        """Return an async context manager mock for async_session().

        First execute() returns the quota-rules query result (used by
        _get_cached_quota_rules); second execute() returns the batched
        QuotaUsage rows as a list of (quota_id, used) tuples.
        """
        mock_db = AsyncMock()

        quota_result = MagicMock()
        quota_result.scalars.return_value.all.return_value = [quota] if quota else []

        usage_result = MagicMock()
        if quota and usage:
            usage_result.all.return_value = [(quota.id, usage.used)]
        else:
            usage_result.all.return_value = []

        mock_db.execute.side_effect = [quota_result, usage_result]

        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None
        return ctx

    async def test_B4_1_under_limit_does_not_raise(self):
        from app.services import quota_service

        set_context("t-001")
        quota = _make_quota(limit=100, soft_pct=0.8, is_hard=True)
        usage = _make_usage(50)

        with patch.object(
            quota_service, "async_session", return_value=self._mock_db_session(quota, usage)
        ):
            await quota_service.check_quota()  # should not raise

    async def test_B4_2_hard_limit_raises_rate_limit_exceeded(self):
        from app.services import quota_service

        set_context("t-001")
        quota = _make_quota(limit=100, is_hard=True)
        usage = _make_usage(100)  # exactly at limit

        with patch.object(
            quota_service, "async_session", return_value=self._mock_db_session(quota, usage)
        ):
            with pytest.raises(RateLimitExceeded):
                await quota_service.check_quota()

    async def test_B4_3_soft_warn_logs_but_does_not_raise(self, caplog):
        import logging

        from app.services import quota_service

        set_context("t-001")
        quota = _make_quota(limit=100, soft_pct=0.8, is_hard=True)
        usage = _make_usage(85)  # 85% — above soft_pct

        with patch.object(
            quota_service, "async_session", return_value=self._mock_db_session(quota, usage)
        ):
            with caplog.at_level(logging.WARNING, logger="app.services.quota_service"):
                await quota_service.check_quota()  # must not raise

        assert any("Soft quota warning" in r.message for r in caplog.records)

    async def test_B4_4_no_quota_for_tenant_does_not_raise(self):
        from app.services import quota_service

        set_context("t-001")

        with patch.object(
            quota_service, "async_session", return_value=self._mock_db_session(None, None)
        ):
            await quota_service.check_quota()  # no quota rows → passes through

    async def test_empty_tenant_returns_immediately(self):
        from app.services import quota_service

        set_context("")  # empty tenant_id

        # async_session should NOT be called at all
        with patch.object(quota_service, "async_session") as mock_sess:
            await quota_service.check_quota()
            mock_sess.assert_not_called()


# ── log_llm_usage ─────────────────────────────────────────────────────────────


class TestLogLlmUsage:
    async def test_B4_5_inserts_usage_log_row(self):
        from app.services import llm_usage_logger

        set_context("t-001", "bu-001")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None

        with (
            patch.object(llm_usage_logger, "async_session", return_value=ctx),
            patch("app.services.llm_usage_logger._get_pricing", AsyncMock(return_value=None)),
        ):
            await llm_usage_logger.log_llm_usage(
                model="test-model",
                prompt_tokens=100,
                completion_tokens=50,
                total_tokens=150,
                count_quota=False,
            )

        mock_db.add.assert_called_once()
        from app.models.orm import LLMUsageLog

        added = mock_db.add.call_args[0][0]
        assert isinstance(added, LLMUsageLog)
        assert added.model == "test-model"

    async def test_B4_6_count_quota_true_is_noop_after_consume_quota_refactor(self):
        """count_quota=True is a no-op — quota is consumed atomically via consume_quota()."""
        from app.services import llm_usage_logger

        set_context("t-001", "bu-001")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None

        with (
            patch.object(llm_usage_logger, "async_session", return_value=ctx),
            patch("app.services.llm_usage_logger._get_pricing", AsyncMock(return_value=None)),
        ):
            await llm_usage_logger.log_llm_usage(
                model="m",
                prompt_tokens=10,
                completion_tokens=5,
                total_tokens=15,
                count_quota=True,
            )
        # No increment_quota call — that's the assertion (function simply doesn't call it)
        mock_db.add.assert_called_once()


# ── increment_quota ───────────────────────────────────────────────────────────


class TestIncrementQuota:
    async def test_B4_7_increments_usage_for_all_quotas(self):
        from app.services import quota_service

        set_context("t-001")
        quota = _make_quota(limit=100)

        mock_db = AsyncMock()
        quota_result = MagicMock()
        quota_result.scalars.return_value.all.return_value = [quota]
        mock_db.execute = AsyncMock(return_value=quota_result)
        mock_db.commit = AsyncMock()

        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None

        with patch.object(quota_service, "async_session", return_value=ctx):
            await quota_service.increment_quota()

        mock_db.commit.assert_called_once()

    async def test_B4_8_db_error_silent_no_raise(self):
        from app.services import quota_service

        set_context("t-001")

        ctx = AsyncMock()
        ctx.__aenter__.side_effect = RuntimeError("DB down")
        ctx.__aexit__.return_value = None

        with patch.object(quota_service, "async_session", return_value=ctx):
            await quota_service.increment_quota()  # must not raise
