"""The monthly-rollup path behind "show me a year".

`/usage-summary` at daily granularity aggregates llm_usage_logs live and returns one row
per day×tenant×module with no row limit, which is why it is capped at 92 days. Asking for
longer switches it to `monthly_usage_summary` — a nightly rollup kept indefinitely that no
admin page had ever read. These cover the switch, the two ceilings either side of it, and
the arithmetic in the rollup readers.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.exceptions import ValidationError


def _make_admin(is_global: bool = True, tenant_scope: str | None = None):
    admin = MagicMock()
    admin.is_global = is_global
    admin.tenant_scope = tenant_scope
    return admin


class _DictMapping(dict):
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name) from None


def _rows_db(*batches):
    def _res(batch):
        r = MagicMock()
        r.mappings.return_value.all.return_value = [_DictMapping(x) for x in batch]
        r.mappings.return_value.fetchone.return_value = _DictMapping(batch[0]) if batch else None
        return r

    db = AsyncMock()
    db.execute.side_effect = [_res(b) for b in batches]
    return db


def _month(**kw):
    base = {
        "summary_date": date(2026, 3, 1),
        "module_id": "credit_card_ocr",
        "tenant_id": "t-1",
        "total_documents": 40,
        "total_submissions": 33,
        "total_llm_calls": 80,
        "total_tokens": 12_000,
        "total_cost_usd": Decimal("1.25"),
        "total_errors": 2,
        "avg_llm_latency_ms": 5100.0,
    }
    base.update(kw)
    return base


# ── the ceiling either side of the switch ────────────────────────────────────


class TestUsageRangeCeilings:
    async def _call(self, db, **kw):
        from app.routers.admin.usage import get_usage_summary

        return await get_usage_summary(
            from_date=kw.get("from_date"),
            to_date=kw.get("to_date"),
            module_id=None,
            tenant_id=None,
            granularity=kw.get("granularity", "day"),
            db=db,
            admin=_make_admin(),
        )

    async def test_daily_still_stops_at_92_days(self):
        # Not arbitrary caution: this query has no row limit at all, so the range is the
        # only thing bounding how many rows come back.
        db = AsyncMock()
        with pytest.raises(ValidationError, match="max 92 days"):
            await self._call(db, from_date=date(2026, 1, 1), to_date=date(2026, 6, 1))
        db.execute.assert_not_called()

    async def test_monthly_answers_the_same_range(self):
        # The whole point of the switch — this range used to be a red toast.
        db = _rows_db([_month()], [])
        result = await self._call(
            db, from_date=date(2026, 1, 1), to_date=date(2026, 6, 1), granularity="month"
        )
        assert result["granularity"] == "month"
        assert len(result["data"]) == 1

    async def test_monthly_still_refuses_an_absurd_range(self):
        # A typo (?from=1970-01-01) should not scan the whole rollup.
        db = AsyncMock()
        with pytest.raises(ValidationError, match="max 1830 days"):
            await self._call(
                db, from_date=date(2000, 1, 1), to_date=date(2026, 1, 1), granularity="month"
            )
        db.execute.assert_not_called()

    async def test_inverted_range_refused_at_either_granularity(self):
        for granularity in ("day", "month"):
            with pytest.raises(ValidationError, match="must not be before"):
                await self._call(
                    db=AsyncMock(),
                    from_date=date(2026, 7, 10),
                    to_date=date(2026, 7, 1),
                    granularity=granularity,
                )

    def test_period_hours_ceiling_covers_the_uis_12_month_preset(self):
        # PeriodPicker's widest preset sends "365 days ago 00:00 → today 23:59", which is
        # 366 days of hours. A bare 8760 here made that preset 422 — caught by
        # PeriodPicker.test.tsx, which asserts the same number from the other side.
        from app.routers.admin.usage import _MAX_PERIOD_HOURS

        assert _MAX_PERIOD_HOURS >= 366 * 24

    async def test_granularity_is_echoed_so_the_ui_can_caveat_the_numbers(self):
        # The daily path fans out into several queries (aggregate, task counts, the two
        # submission counts, tenant names); empty batches for all of them.
        db = _rows_db([], [], [], [], [])
        assert (await self._call(db))["granularity"] == "day"


# ── get_monthly_usage_summary ────────────────────────────────────────────────


class TestMonthlyUsageSummary:
    async def _call(self, db, **kw):
        from app.services.usage_analytics_service import get_monthly_usage_summary

        return await get_monthly_usage_summary(
            db,
            kw.get("from_date", date(2026, 1, 1)),
            kw.get("to_date", date(2026, 8, 24)),
            kw.get("tenant_id"),
            kw.get("module_id"),
        )

    async def test_row_shape_matches_the_daily_one_so_the_table_does_not_branch(self):
        db = _rows_db([_month()], [])
        row = (await self._call(db))["data"][0]
        for key in (
            "date",
            "module_id",
            "tenant_id",
            "tenant_name",
            "documents",
            "submissions",
            "llm_calls",
            "extract_calls",
            "suggest_calls",
            "tokens",
            "cost_usd",
            "errors",
            "avg_llm_latency_ms",
        ):
            assert key in row, f"missing {key}"
        assert row["documents"] == 40
        assert row["cost_usd"] == 1.25

    async def test_extract_suggest_split_is_null_not_zero(self):
        # The rollup never captured the split. A 0 would read as "nobody ran an
        # extraction that month", which is a different claim from "not recorded".
        row = (await self._call(_rows_db([_month()], [])))["data"][0]
        assert row["extract_calls"] is None
        assert row["suggest_calls"] is None

    async def test_empty_rollup_is_not_an_error(self):
        assert (await self._call(_rows_db([], [])))["data"] == []

    async def test_from_date_is_floored_to_the_month_it_lands_in(self):
        # summary_date is always the 1st, so ?from=2026-03-15 would otherwise skip
        # March entirely — the month the reader explicitly asked to start in.
        from app.services.usage_analytics_service import _month_floor

        assert _month_floor(date(2026, 3, 15)) == date(2026, 3, 1)
        assert _month_floor(date(2026, 3, 1)) == date(2026, 3, 1)


# ── get_monthly_usage_totals ─────────────────────────────────────────────────


class TestMonthlyUsageTotals:
    async def _call(self, db, **kw):
        from app.services.usage_analytics_service import get_monthly_usage_totals

        return await get_monthly_usage_totals(
            db,
            kw.get("from_date", date(2026, 1, 1)),
            kw.get("to_date", date(2026, 8, 24)),
            kw.get("tenant_id"),
        )

    @staticmethod
    def _totals_db(row):
        r = MagicMock()
        r.mappings.return_value.fetchone.return_value = _DictMapping(row) if row else None
        db = AsyncMock()
        db.execute.return_value = r
        return db

    async def test_sums_are_carried_through(self):
        db = self._totals_db(
            {
                "documents": 263,
                "submissions": 190,
                "llm_calls": 520,
                "tokens": 88_000,
                "cost_usd": Decimal("0.234128"),
                "errors": 7,
                "avg_llm_latency_ms": 5300.0,
            }
        )
        totals = await self._call(db)
        assert totals["documents"] == 263
        assert totals["cost_usd"] == 0.234128
        assert totals["errors"] == 7

    async def test_a_month_with_no_rows_reports_zeros_not_none(self):
        # KPI cards render this straight; None would print "null".
        totals = await self._call(self._totals_db(None))
        assert totals["documents"] == 0
        assert totals["cost_usd"] == 0
        assert totals["avg_llm_latency_ms"] == 0

    async def test_latency_is_weighted_by_calls_in_sql_not_averaged_in_python(self):
        # A month with 4000 calls and one with 3 must not carry equal weight. The
        # weighting lives in the SELECT, so what is pinned here is that the column is
        # taken as given rather than re-derived from a mean of means.
        db = self._totals_db(
            {
                "documents": 1,
                "submissions": 1,
                "llm_calls": 4003,
                "tokens": 1,
                "cost_usd": Decimal("0"),
                "errors": 0,
                "avg_llm_latency_ms": 5000.4,
            }
        )
        assert (await self._call(db))["avg_llm_latency_ms"] == 5000.4

        sql = str(db.execute.await_args[0][0]).lower()
        assert "avg_llm_latency_ms * monthly_usage_summary.total_llm_calls" in sql
        # nullif guards the all-zero month; without it the division raises.
        assert "nullif" in sql

    async def test_the_split_stays_null_here_too(self):
        totals = await self._call(self._totals_db(None))
        assert totals["extract_calls"] is None
        assert totals["suggest_calls"] is None
