"""
Unit tests for services/shared/pricing_cache.py & shared/llm_usage_logger.py
Mocks DB session and context vars.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.shared.pricing_cache import estimate_cost
from tests.conftest import set_context

# ── estimate_cost ────────────────────────────────────────────────────────────


class TestEstimateCost:
    def test_calculates_cost_per_million_tokens(self):
        # $1 per 1M prompt, $2 per 1M completion
        rates = (Decimal("1.0"), Decimal("2.0"))
        cost = estimate_cost(1_000_000, 1_000_000, rates)
        assert float(cost) == pytest.approx(3.0, rel=1e-3)

    def test_zero_tokens_returns_zero(self):
        rates = (Decimal("1.0"), Decimal("2.0"))
        cost = estimate_cost(0, 0, rates)
        assert float(cost) == 0.0


# ── log_llm_usage ─────────────────────────────────────────────────────────────


class TestLogLlmUsage:
    async def test_B4_5_inserts_usage_log_row(self):
        from app.services.shared import llm_usage_logger

        set_context("t-001", "bu-001")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None

        with (
            patch.object(llm_usage_logger, "async_session", return_value=ctx),
            patch("app.services.shared.llm_usage_logger.get_pricing", AsyncMock(return_value=None)),
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

    async def test_log_llm_usage_direct_cost_usd(self):
        """When cost_usd is supplied directly, it bypasses get_pricing and saves verbatim."""
        from app.services.shared import llm_usage_logger

        set_context("t-001", "bu-001")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()

        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None

        mock_get_pricing = AsyncMock()

        with (
            patch.object(llm_usage_logger, "async_session", return_value=ctx),
            patch("app.services.shared.llm_usage_logger.get_pricing", mock_get_pricing),
        ):
            await llm_usage_logger.log_llm_usage(
                model="test-model",
                prompt_tokens=100,
                completion_tokens=50,
                total_tokens=150,
                cost_usd=0.000425,
            )

        mock_db.add.assert_called_once()
        mock_get_pricing.assert_not_called()
        added = mock_db.add.call_args[0][0]
        assert added.cost_usd == Decimal("0.000425")

    @pytest.mark.parametrize("bad", ["abc", float("nan"), -1.0, 0])
    async def test_unusable_cost_falls_back_to_catalog_and_keeps_row(self, bad):
        """A malformed/negative/zero-with-tokens cost must not drop the usage row."""
        from app.services.shared import llm_usage_logger

        set_context("t-001", "bu-001")
        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None
        rates = (Decimal("1"), Decimal("1"))

        with (
            patch.object(llm_usage_logger, "async_session", return_value=ctx),
            patch.object(llm_usage_logger, "get_pricing", AsyncMock(return_value=rates)),
        ):
            await llm_usage_logger.log_llm_usage(
                model="m", prompt_tokens=100, completion_tokens=50, total_tokens=150, cost_usd=bad
            )

        mock_db.add.assert_called_once()
        assert mock_db.add.call_args[0][0].cost_usd == estimate_cost(100, 50, rates)

    def test_usage_cost_helper(self):
        from types import SimpleNamespace as NS

        from app.llm.client import _usage_cost

        assert _usage_cost(NS(cost=0.5)) == 0.5
        assert _usage_cost(NS(cost=None, model_extra={"cost": 0.25})) == 0.25
        assert _usage_cost(NS(model_extra=None)) is None
        assert _usage_cost(NS(cost="x")) is None
        assert _usage_cost(NS(cost=float("inf"))) is None
        assert _usage_cost(NS(cost=-1)) is None
        assert _usage_cost(NS(cost=True)) is None

    async def test_B4_6_count_quota_true_is_a_noop(self):
        """count_quota=True is a no-op — a document is charged by consume_document()
        at the router, before the model is ever called."""
        from app.services.shared import llm_usage_logger

        set_context("t-001", "bu-001")

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        ctx = AsyncMock()
        ctx.__aenter__.return_value = mock_db
        ctx.__aexit__.return_value = None

        with (
            patch.object(llm_usage_logger, "async_session", return_value=ctx),
            patch("app.services.shared.llm_usage_logger.get_pricing", AsyncMock(return_value=None)),
        ):
            await llm_usage_logger.log_llm_usage(
                model="m",
                prompt_tokens=10,
                completion_tokens=5,
                total_tokens=15,
                count_quota=True,
            )
        # Nothing is charged here — that's the assertion (the logger only logs)
        mock_db.add.assert_called_once()


# ── schedule_llm_usage ────────────────────────────────────────────────────────


class TestScheduleLlmUsage:
    async def test_returns_before_the_insert_and_drain_waits_for_it(self):
        import asyncio

        from app.services.shared import llm_usage_logger as lu

        set_context("t-001", "bu-001")
        gate = asyncio.Event()
        seen = {}

        async def slow_log(**kw):
            await gate.wait()
            from app.context import current_tenant_id

            seen["tenant"] = current_tenant_id.get()
            seen["model"] = kw["model"]

        with patch.object(lu, "log_llm_usage", slow_log):
            lu.schedule_llm_usage(model="m", prompt_tokens=1, completion_tokens=1, total_tokens=2)
            # the caller got control back while the row is still unwritten, and it is held
            assert seen == {} and len(lu._PENDING) == 1
            gate.set()
            await lu.drain_llm_usage()

        assert seen == {"tenant": "t-001", "model": "m"}  # context copied at schedule time
        assert not lu._PENDING

    async def test_a_failed_insert_never_escapes(self):
        from app.services.shared import llm_usage_logger as lu

        with patch.object(lu, "async_session", side_effect=RuntimeError("db down")):
            lu.schedule_llm_usage(
                model="m", prompt_tokens=1, completion_tokens=1, total_tokens=2, cost_usd=0.001
            )
            await lu.drain_llm_usage()  # log_llm_usage swallows and logs; nothing raised

        assert not lu._PENDING
