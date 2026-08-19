"""correction_service: hint thresholds, the tenant fail-closed guard, and cache scoping.

The guard that matters most here is the empty-tenant path: without it the 90-day
aggregate pools every tenant's correction stats into one ratio, which is a
cross-tenant leak, not just a wrong number.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.context import current_tenant_id
from app.services import correction_service as cs


@pytest.fixture(autouse=True)
def _clean_cache():
    cs._HINTS_CACHE.clear()
    yield
    cs._HINTS_CACHE.clear()
    current_tenant_id.set("")


def _db(total_cards: int, per_field: list[tuple[str, int]]):
    """Mock DB: first execute() is the COUNT, second is the per-field GROUP BY."""
    count_res = MagicMock()
    count_res.scalar.return_value = total_cards
    group_res = MagicMock()
    group_res.all.return_value = per_field

    db = AsyncMock()
    db.execute.side_effect = [count_res, group_res]
    return db


# ── The tenant guard ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_tenant_context_returns_no_hints_and_never_queries():
    """Fail closed: no tenant means no aggregate, not a cross-tenant one."""
    current_tenant_id.set("")
    db = AsyncMock()

    assert await cs.get_correction_hints("BBL", db) == {}
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_hints_are_cached_per_tenant_and_bank():
    current_tenant_id.set("t-001")
    await cs.get_correction_hints("BBL", _db(20, [("doc_no", 5)]))

    # Same tenant+bank → cache hit, no DB touch.
    db2 = AsyncMock()
    assert await cs.get_correction_hints("BBL", db2) == {"doc_no": "5/20 (25%)"}
    db2.execute.assert_not_awaited()

    # Different bank is a different key → must query again.
    db3 = _db(20, [])
    await cs.get_correction_hints("KBANK", db3)
    assert db3.execute.await_count == 2


@pytest.mark.asyncio
async def test_another_tenant_does_not_read_the_first_tenants_cache():
    current_tenant_id.set("t-001")
    await cs.get_correction_hints("BBL", _db(20, [("doc_no", 5)]))

    current_tenant_id.set("t-002")
    db = _db(20, [("amount", 9)])
    assert await cs.get_correction_hints("BBL", db) == {"amount": "9/20 (45%)"}


# ── Thresholds ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_too_few_documents_yields_no_hints():
    """Below MIN_CARDS the ratio is noise — one correction out of three docs is
    not a 33% error rate worth rewriting a prompt over."""
    current_tenant_id.set("t-001")
    db = _db(cs.MIN_CARDS - 1, [("doc_no", 3)])

    assert await cs.get_correction_hints("BBL", db) == {}
    # Short-circuits before the GROUP BY query.
    assert db.execute.await_count == 1


@pytest.mark.asyncio
async def test_only_fields_at_or_above_the_threshold_are_hinted():
    current_tenant_id.set("t-001")
    # 100 docs: 10% is exactly at threshold (kept), 9% is below (dropped).
    db = _db(100, [("doc_no", 10), ("amount", 9), ("date", 50)])

    hints = await cs.get_correction_hints("BBL", db)

    assert set(hints) == {"doc_no", "date"}
    assert hints["date"] == "50/100 (50%)"


@pytest.mark.asyncio
async def test_zero_corrections_yields_no_hints():
    current_tenant_id.set("t-001")
    assert await cs.get_correction_hints("BBL", _db(50, [])) == {}


@pytest.mark.asyncio
async def test_empty_result_is_cached_too():
    """The negative result must be cached, or a quiet bank re-queries on every
    /extract — the whole reason this cache exists."""
    current_tenant_id.set("t-001")
    await cs.get_correction_hints("BBL", _db(50, []))

    db2 = AsyncMock()
    assert await cs.get_correction_hints("BBL", db2) == {}
    db2.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_expired_cache_entry_is_refetched(monkeypatch):
    current_tenant_id.set("t-001")
    clock = {"t": 1000.0}
    monkeypatch.setattr(cs.time, "monotonic", lambda: clock["t"])

    await cs.get_correction_hints("BBL", _db(20, [("doc_no", 5)]))

    clock["t"] += cs._HINTS_CACHE_TTL + 1
    db = _db(20, [("amount", 8)])
    assert await cs.get_correction_hints("BBL", db) == {"amount": "8/20 (40%)"}


# ── Cache invalidation ────────────────────────────────────────────────────────


def test_invalidate_without_a_tenant_clears_everything():
    cs._HINTS_CACHE[("t-001", "BBL")] = ({}, 0.0)
    cs._HINTS_CACHE[("t-002", "BBL")] = ({}, 0.0)

    cs.invalidate_hints_cache()

    assert cs._HINTS_CACHE == {}


def test_invalidate_with_a_tenant_leaves_other_tenants_alone():
    cs._HINTS_CACHE[("t-001", "BBL")] = ({}, 0.0)
    cs._HINTS_CACHE[("t-001", "KBANK")] = ({}, 0.0)
    cs._HINTS_CACHE[("t-002", "BBL")] = ({}, 0.0)

    cs.invalidate_hints_cache("t-001")

    assert set(cs._HINTS_CACHE) == {("t-002", "BBL")}


# ── Upsert statement ──────────────────────────────────────────────────────────


def test_upsert_targets_the_partial_unique_index():
    """The conflict target must stay index-inference on the four scope columns —
    a partial unique index cannot be matched via ON CONSTRAINT."""
    feedback = SimpleNamespace(
        doc_no="DOC-1",
        bank_code="BBL",
        field_name="amount",
        original_value="100",
        corrected_value="110",
    )
    session = SimpleNamespace(tenant_id="t-001", carmen_user_id="u-1")

    sql = str(cs.build_correction_upsert(feedback, session))

    assert "ON CONFLICT" in sql
    assert "deleted_at IS NULL" in sql
    assert "RETURNING" in sql
