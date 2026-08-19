"""pricing_cache_service: cost arithmetic and the lookup cache.

Every LLM call's logged cost comes through here, so the rounding and the negative
caching both matter: the first feeds billing reports, the second is what stops an
unknown model re-querying the DB on every single request.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import pricing_cache_service as pcs


@pytest.fixture(autouse=True)
def _clean_cache():
    pcs._PRICING_CACHE.clear()
    yield
    pcs._PRICING_CACHE.clear()


def _session_returning(row):
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = row
    db.execute.return_value = result

    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=db)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx, db


# ── Cost arithmetic ───────────────────────────────────────────────────────────


def test_cost_is_per_million_tokens():
    # 1M prompt tokens at $2/1M + 1M completion tokens at $6/1M = $8
    assert pcs._estimate_cost(1_000_000, 1_000_000, (Decimal("2"), Decimal("6"))) == Decimal("8")


def test_prompt_and_completion_use_their_own_rates():
    """Swapping the two rates must change the answer — guards against reading the
    tuple in the wrong order, which would be invisible on a symmetric model."""
    cheap_in = pcs._estimate_cost(1_000_000, 0, (Decimal("1"), Decimal("10")))
    cheap_out = pcs._estimate_cost(0, 1_000_000, (Decimal("1"), Decimal("10")))

    assert cheap_in == Decimal("1")
    assert cheap_out == Decimal("10")


def test_cost_keeps_six_decimal_places():
    """A single cheap call costs fractions of a cent; rounding to fewer places
    would floor most real calls to zero."""
    cost = pcs._estimate_cost(1000, 500, (Decimal("0.15"), Decimal("0.60")))

    assert cost == Decimal("0.000450")
    assert isinstance(cost, Decimal)


def test_zero_tokens_costs_nothing():
    assert pcs._estimate_cost(0, 0, (Decimal("2"), Decimal("6"))) == Decimal("0")


# ── Lookup + cache ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_known_model_is_read_once_then_served_from_cache():
    row = MagicMock(input_price_per_1m=Decimal("2"), output_price_per_1m=Decimal("6"))
    ctx, db = _session_returning(row)

    with patch.object(pcs, "async_session", return_value=ctx):
        first = await pcs._get_pricing("google/gemini-2.5-flash-lite")
        second = await pcs._get_pricing("google/gemini-2.5-flash-lite")

    assert first == (Decimal("2"), Decimal("6"))
    assert second == first
    db.execute.assert_awaited_once()  # second call never reached the DB


@pytest.mark.asyncio
async def test_unknown_model_caches_the_negative_result():
    """Without this, an unpriced model re-queries the DB on every LLM call."""
    ctx, db = _session_returning(None)

    with patch.object(pcs, "async_session", return_value=ctx):
        assert await pcs._get_pricing("who/knows") is None
        assert await pcs._get_pricing("who/knows") is None

    assert "who/knows" in pcs._PRICING_CACHE
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_db_failure_returns_none_without_raising():
    """Pricing is telemetry — it must never take down the LLM call it describes."""
    with patch.object(pcs, "async_session", side_effect=RuntimeError("db down")):
        assert await pcs._get_pricing("google/gemini-2.5-flash-lite") is None

    # A transient failure must NOT be cached as "known missing".
    assert "google/gemini-2.5-flash-lite" not in pcs._PRICING_CACHE


@pytest.mark.asyncio
async def test_the_sync_clears_the_cache_so_new_prices_take_effect():
    pcs._PRICING_CACHE["stale/model"] = (Decimal("1"), Decimal("1"))

    resp = MagicMock()
    resp.json.return_value = {"data": []}
    resp.raise_for_status = MagicMock()

    client = AsyncMock()
    client.get.return_value = resp
    client_ctx = MagicMock()
    client_ctx.__aenter__ = AsyncMock(return_value=client)
    client_ctx.__aexit__ = AsyncMock(return_value=False)

    db_ctx, _ = _session_returning(None)

    with patch.object(pcs.httpx, "AsyncClient", return_value=client_ctx):
        with patch.object(pcs, "async_session", return_value=db_ctx):
            await pcs.fetch_openrouter_pricing()

    assert pcs._PRICING_CACHE == {}


@pytest.mark.asyncio
async def test_a_failed_sync_leaves_the_cache_intact():
    """An OpenRouter outage must not clear pricing and make every subsequent call
    log a null cost."""
    pcs._PRICING_CACHE["known/model"] = (Decimal("2"), Decimal("6"))

    with patch.object(pcs.httpx, "AsyncClient", side_effect=RuntimeError("network")):
        await pcs.fetch_openrouter_pricing()  # must not raise

    assert pcs._PRICING_CACHE["known/model"] == (Decimal("2"), Decimal("6"))
