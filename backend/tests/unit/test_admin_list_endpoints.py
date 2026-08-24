"""The admin list endpoints that moved onto `Page[T]` + server-side sort.

What is worth pinning here is not the SQL — that is `test_admin_query.py` — but the
contract each endpoint now owes its table: a `total` counted off the *unlimited* query,
the window it was actually given back, and a 400 rather than a silent re-sort when the
`sort` key is not one it supports.

Every one of these used to answer `total: len(rows)`, i.e. capped at `limit`, so a page
could never tell the reader how much it was hiding.
"""

from datetime import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app.exceptions import ValidationError
from app.models.observability import JobRun
from app.utils.list_query import ListQuery, apply_list_query


def _make_admin(is_global: bool = True, tenant_scope: str | None = None):
    admin = MagicMock()
    admin.is_global = is_global
    admin.tenant_scope = tenant_scope
    return admin


def _lq(**kw):
    return ListQuery(
        q=kw.get("q"),
        sort=kw.get("sort"),
        dir=kw.get("dir", "desc"),
        limit=kw.get("limit", 50),
        offset=kw.get("offset", 0),
    )


def _paged_db(rows, total, extra_batches=()):
    """paginate() runs COUNT then the window; `extra_batches` are the lookups after it."""
    count_result = MagicMock()
    count_result.scalar_one.return_value = total
    rows_result = MagicMock()
    rows_result.scalars.return_value.all.return_value = rows

    def _mapping_res(batch):
        r = MagicMock()
        r.mappings.return_value.all.return_value = list(batch)
        r.all.return_value = list(batch)
        return r

    db = AsyncMock()
    db.execute.side_effect = [count_result, rows_result, *(_mapping_res(b) for b in extra_batches)]
    return db


# ── /alerts ───────────────────────────────────────────────────────────────────


class TestListAlerts:
    @staticmethod
    def _alert():
        a = MagicMock()
        a.id = 1
        a.tenant_id = "t-1"
        a.module_id = "credit_card_ocr"
        a.metric = "error_rate"
        a.severity = MagicMock(value="warn")
        a.threshold = Decimal("5")
        a.actual = Decimal("9")
        a.description = "error rate above baseline"
        a.created_at = datetime(2026, 8, 1)
        a.resolved_at = None
        return a

    async def _call(self, db, **kw):
        from app.routers.admin.monitoring import list_alerts

        return await list_alerts(
            status=kw.get("status", "open"),
            severity=kw.get("severity"),
            tenant_id=kw.get("tenant_id"),
            from_date=kw.get("from_date"),
            to_date=kw.get("to_date"),
            lq=_lq(**kw),
            db=db,
            admin=_make_admin(),
        )

    async def test_total_is_the_whole_match_not_the_window(self):
        # Overview's KPI card calls this with limit=1. Counting the returned rows could
        # only ever have answered 0 or 1, whatever the real backlog was.
        result = await self._call(_paged_db([self._alert()], 47, [[]]), limit=1)
        assert result["total"] == 47
        assert len(result["data"]) == 1

    async def test_returns_the_window_it_was_given(self):
        result = await self._call(_paged_db([], 47, [[]]), limit=25, offset=50)
        assert (result["limit"], result["offset"]) == (25, 50)

    async def test_unknown_sort_key_is_refused(self):
        with pytest.raises(ValidationError, match="Cannot sort by"):
            await self._call(_paged_db([], 0, [[]]), sort="whenever")


# ── /jobs ─────────────────────────────────────────────────────────────────────


class TestListJobs:
    @staticmethod
    def _job():
        j = MagicMock()
        j.id = "j-1"
        j.job_name = "daily-summary"
        j.status = MagicMock(value="success")
        j.started_at = datetime(2026, 8, 1, 1, 17)
        j.completed_at = datetime(2026, 8, 1, 1, 18)
        j.rows_affected = 12
        j.error_message = None
        return j

    async def _call(self, db, **kw):
        from app.routers.admin.monitoring import list_jobs

        return await list_jobs(
            status=kw.get("status"),
            job_name=kw.get("job_name"),
            from_date=kw.get("from_date"),
            to_date=kw.get("to_date"),
            lq=_lq(**kw),
            db=db,
            _admin=_make_admin(),
        )

    async def test_total_survives_the_window(self):
        result = await self._call(_paged_db([self._job()], 72), limit=3)
        assert result["total"] == 72
        assert len(result["data"]) == 1

    async def test_duration_is_derived_not_sorted_on(self):
        # duration_s is computed in Python from two columns, so it is deliberately not
        # in the sortable whitelist — offering it would sort one page against itself.
        result = await self._call(_paged_db([self._job()], 1))
        assert result["data"][0]["duration_s"] == 60.0
        with pytest.raises(ValidationError):
            await self._call(_paged_db([], 0), sort="duration_s")

    def test_error_message_is_searchable_because_that_is_why_you_open_this_page(self):
        stmt = apply_list_query(
            select(JobRun),
            _lq(q="timeout"),
            sortable={"started_at": JobRun.started_at},
            tiebreak=JobRun.id,
            default_sort="started_at",
            searchable=(JobRun.job_name, JobRun.error_message),
        )
        assert str(stmt.compile(dialect=postgresql.dialect())).lower().count("ilike") == 2


# ── /performance-logs ─────────────────────────────────────────────────────────


class TestPerformanceLogs:
    @staticmethod
    def _log():
        p = MagicMock()
        p.id = "p-1"
        p.tenant_id = "t-1"
        p.endpoint = "/api/v1/credit-card/extract"
        p.method = "POST"
        p.duration_ms = 158204.1
        p.status_code = 200
        p.carmen_user_id = "u-1"
        p.resource_id = None
        p.created_at = datetime(2026, 8, 1)
        return p

    async def _call(self, db, **kw):
        from app.routers.admin.monitoring import get_performance_logs

        return await get_performance_logs(
            from_date=kw.get("from_date"),
            to_date=kw.get("to_date"),
            endpoint=kw.get("endpoint"),
            status_code=kw.get("status_code"),
            min_duration_ms=kw.get("min_duration_ms"),
            tenant_id=kw.get("tenant_id"),
            lq=_lq(**kw),
            db=db,
            admin=_make_admin(),
        )

    async def test_reports_the_real_backlog_behind_a_small_window(self):
        # There are ~96k rows in this table. The page used to fetch 300 and say nothing,
        # so "slowest request" meant "slowest of the 300 most recent".
        result = await self._call(_paged_db([self._log()], 96_016, [[]]), limit=3)
        assert result["total"] == 96_016

    async def test_sorting_by_duration_is_allowed_because_it_is_a_real_column(self):
        result = await self._call(_paged_db([self._log()], 1, [[]]), sort="duration_ms")
        assert result["data"][0]["duration_ms"] == 158204.1


# ── /sessions ─────────────────────────────────────────────────────────────────


class TestListSessions:
    @staticmethod
    def _session():
        s = MagicMock()
        s.id = "s-1"
        s.tenant_id = "t-1"
        s.carmen_user_id = "u-1"
        s.username = "ADMGDS"
        s.is_active = True
        s.last_used_at = datetime(2026, 8, 20)
        s.created_at = datetime(2026, 8, 19)
        return s

    async def _call(self, db, admin=None, **kw):
        from app.routers.admin.sessions import list_sessions

        return await list_sessions(
            active_only=kw.get("active_only", False),
            tenant_id=kw.get("tenant_id"),
            from_date=kw.get("from_date"),
            to_date=kw.get("to_date"),
            lq=_lq(**kw),
            db=db,
            admin=admin or _make_admin(),
        )

    async def test_login_history_reports_its_real_size(self):
        # Sessions are scrubbed after an hour but retained 30 days, so this list is login
        # history. It was capped at 100 with total=len(rows), i.e. permanently 100.
        result = await self._call(_paged_db([self._session()], 123, [[]]), limit=3)
        assert result["total"] == 123

    async def test_scoped_admin_is_pinned_to_their_own_tenant(self):
        # Usernames are in the payload, so this is a privacy boundary, not just a filter.
        db = _paged_db([], 0, [[]])
        await self._call(
            db, admin=_make_admin(is_global=False, tenant_scope="t-owned"), tenant_id="t-other"
        )
        sql = str(db.execute.await_args_list[0][0][0])
        assert "tenant_id" in sql

    async def test_unknown_sort_key_is_refused(self):
        with pytest.raises(ValidationError):
            await self._call(_paged_db([], 0, [[]]), sort="tenant_name")


# ── credit ledger ─────────────────────────────────────────────────────────────


class TestCreditLedger:
    @staticmethod
    def _entry():
        e = MagicMock()
        e.id = 1
        e.tenant_id = "t-1"
        e.delta = 30
        e.balance_after = 130
        e.reason = "signup_grant"
        e.pack_code = None
        e.note = None
        e.ref = "invoice.pdf"
        e.created_at = datetime(2026, 8, 1)
        return e

    async def _call(self, db, **kw):
        from app.services.credit_service import get_ledger

        return await get_ledger(
            db,
            kw.get("tenant_id", "t-1"),
            _lq(**kw),
            kw.get("from_date"),
            kw.get("to_date"),
        )

    async def test_entry_101_is_reachable(self):
        # The whole reason this moved: a flat newest-100 with no dates and no note, on
        # the one table whose entire purpose is being auditable.
        rows, total = await self._call(_paged_db([self._entry()], 340), limit=25, offset=100)
        assert total == 340
        assert len(rows) == 1

    async def test_note_and_ref_are_searchable(self):
        db = _paged_db([], 0)
        await self._call(db, q="invoice")
        # The rows query, not the COUNT. `ilike` compiles to lower() LIKE lower() on the
        # default dialect, so match on `like` — the point is the fan-out across all
        # three text columns, and that the escape clause survived.
        sql = str(db.execute.await_args_list[1][0][0]).lower()
        assert sql.count(" like ") == 3  # reason, note, ref
        assert "escape" in sql

    async def test_unknown_sort_key_is_refused_on_a_money_table_too(self):
        with pytest.raises(ValidationError):
            await self._call(_paged_db([], 0), sort="amount")
