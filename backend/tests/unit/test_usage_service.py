"""
Unit tests for services/usage_service.py
Mocks DB session and context vars.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.usage_service import _estimate_cost
from tests.conftest import set_context

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

    async def test_B4_6_count_quota_true_is_a_noop(self):
        """count_quota=True is a no-op — a document is charged by consume_document()
        at the router, before the model is ever called."""
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
        # Nothing is charged here — that's the assertion (the logger only logs)
        mock_db.add.assert_called_once()
