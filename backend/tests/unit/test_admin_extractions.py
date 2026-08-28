"""
Unit tests for the extraction-failure and tenant-engagement admin surfaces.

Both exist because /error-breakdown answers "how many failed" but never "why, and
whose" — for a month an `errors: 4` cell sat on the Usage page with nothing to click.

Uses direct async calls with a mocked AsyncSession — no HTTP stack.
"""

import uuid
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

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


def _result(batch):
    r = MagicMock()
    rows = [_DictMapping(x) if isinstance(x, dict) else x for x in batch]
    r.mappings.return_value.all.return_value = rows
    r.scalars.return_value.all.return_value = batch
    r.scalar_one.return_value = len(batch)
    return r


def _make_db(*batches):
    db = AsyncMock()
    db.execute.side_effect = [_result(b) for b in batches]
    return db


def _make_failures_db(*batches, total=None):
    """`_make_db` plus the leading COUNT that get_extraction_failures now runs.

    `total` used to be len(rows), which could never reveal that the 500-row cap had
    bitten and left the page's grouped cause counts describing a sample.
    """
    db = AsyncMock()
    count_first = MagicMock()
    count_first.scalar_one.return_value = (
        total if total is not None else (len(batches[0]) if batches else 0)
    )
    db.execute.side_effect = [count_first, *(_result(b) for b in batches)]
    return db


def _task(task_id, *, error="boom", filename="doc.pdf", tenant=None, module="credit_card_ocr"):
    t = MagicMock()
    t.id = task_id
    t.created_at = datetime(2026, 7, 7, 14, 48, tzinfo=UTC)
    t.tenant_id = tenant or uuid.uuid4()
    t.module_id = module
    t.original_filename = filename
    t.error_message = error
    t.carmen_user_id = "user-1"
    return t


# ── /extraction-failures ─────────────────────────────────────────────────────


class TestExtractionFailuresEndpoint:
    async def _call(self, db, admin=None, **kwargs):
        from app.routers.admin.usage import extraction_failures

        return await extraction_failures(
            from_date=kwargs.get("from_date"),
            to_date=kwargs.get("to_date"),
            module_id=kwargs.get("module_id"),
            tenant_id=kwargs.get("tenant_id"),
            limit=kwargs.get("limit", 500),
            db=db,
            admin=admin or _make_admin(),
        )

    async def test_rejects_range_wider_than_a_year(self):
        # The guard must fire before any query runs. The ceiling is a year, not the old
        # 92 days: this endpoint is bounded by its own row limit, and the reason the cap
        # existed (an unbounded row count) only ever applied to /usage-summary.
        db = _make_failures_db()
        with pytest.raises(ValidationError, match="max 366 days"):
            await self._call(db, from_date=date(2025, 1, 1), to_date=date(2026, 4, 10))
        db.execute.assert_not_called()

    async def test_accepts_a_full_year(self):
        # The complaint this whole change answers: a range past 30-ish days used to come
        # back as a red toast instead of data.
        db = _make_failures_db([])
        result = await self._call(db, from_date=date(2026, 1, 1), to_date=date(2026, 7, 1))
        assert result["from"] == "2026-01-01"

    async def test_rejects_inverted_range(self):
        db = _make_failures_db()
        with pytest.raises(ValidationError):
            await self._call(db, from_date=date(2026, 7, 10), to_date=date(2026, 7, 1))

    async def test_defaults_to_month_to_date(self):
        db = _make_failures_db([])
        result = await self._call(db)
        today = date.today()
        assert result["from"] == str(today.replace(day=1))
        assert result["to"] == str(today)

    async def test_scoped_admin_cannot_read_another_tenant(self):
        # Filenames and carmen_user_id are in the payload, so tenant scoping is a
        # privacy boundary here, not just a filter.
        db = _make_failures_db([])
        result = await self._call(
            db, admin=_make_admin(is_global=False, tenant_scope="t-owned"), tenant_id="t-other"
        )
        assert result["tenant_id"] == "t-owned"


# ── get_extraction_failures ──────────────────────────────────────────────────


class TestGetExtractionFailures:
    async def _call(self, db, **kwargs):
        from app.services.usage_analytics_service import get_extraction_failures

        return await get_extraction_failures(
            db,
            kwargs.get("from_date", date(2026, 7, 1)),
            kwargs.get("to_date", date(2026, 7, 31)),
            kwargs.get("tenant_id"),
            kwargs.get("module_id"),
            kwargs.get("limit", 500),
        )

    async def test_no_failures_short_circuits(self):
        # No tasks → no point querying llm_usage_logs or tenant names. Two executes,
        # not one: the COUNT runs first so `total` can report a truncated window.
        db = _make_failures_db([])
        result = await self._call(db)
        assert result == {"total": 0, "data": []}
        assert db.execute.await_count == 2

    async def test_llm_stats_merged_onto_task(self):
        tid = uuid.uuid4()
        task = _task(tid, error="Unterminated string starting at: line 34 column 22 (char 839)")
        db = _make_failures_db(
            [task],
            [
                {
                    "tid": str(tid),
                    "llm_calls": 1,
                    "total_tokens": 0,
                    "duration_ms": 5518.4,
                    "model": "google/gemini-2.5-flash-lite",
                }
            ],
            [],
        )
        row = (await self._call(db))["data"][0]
        assert row["llm_calls"] == 1
        assert row["total_tokens"] == 0
        assert row["duration_ms"] == 5518.4
        assert row["model"] == "google/gemini-2.5-flash-lite"
        assert row["error_message"].startswith("Unterminated string")

    async def test_task_without_llm_call_reports_none_not_zero(self):
        # This is the distinction that made the live JSON bug diagnosable: a task
        # absent from llm_usage_logs means the model was NEVER CALLED, whereas
        # total_tokens == 0 means it was called and returned nothing. Collapsing
        # both to 0 destroys the signal.
        task = _task(uuid.uuid4(), error="document closed or encrypted")
        db = _make_failures_db([task], [], [])
        row = (await self._call(db))["data"][0]
        assert row["llm_calls"] is None
        assert row["total_tokens"] is None
        assert row["duration_ms"] is None
        assert row["model"] is None

    async def test_tenant_name_resolved_and_id_stringified(self):
        tenant = uuid.uuid4()
        task = _task(uuid.uuid4(), tenant=tenant)
        db = _make_failures_db(
            [task],
            [],
            [{"id": tenant, "name": "Pilot BU", "bu_code": "pilot"}],
        )
        row = (await self._call(db))["data"][0]
        assert row["tenant_id"] == str(tenant)
        assert row["tenant_name"] == "Pilot BU (pilot)"

    async def test_total_is_the_whole_match_so_the_page_can_admit_it_truncated(self):
        # The page groups these by cause client-side. Over the cap those cause counts
        # describe a sample, and len(data) could never have revealed that.
        task = _task(uuid.uuid4())
        db = _make_failures_db([task], [], [], total=843)
        result = await self._call(db)
        assert result["total"] == 843
        assert len(result["data"]) == 1


# ── get_tenant_engagement_map ────────────────────────────────────────────────


class TestTenantEngagementMap:
    async def _call(self, db, tenant_uuids, today=None):
        from app.services.usage_analytics_service import get_tenant_engagement_map

        return await get_tenant_engagement_map(db, tenant_uuids, today=today)

    async def test_empty_tenant_list_does_not_query(self):
        db = _make_db()
        assert await self._call(db, []) == {}
        db.execute.assert_not_called()

    async def test_tenant_with_no_tasks_is_absent_from_map(self):
        # Absence is the "logged in but never extracted" signal — the router spreads
        # _NO_ENGAGEMENT defaults over it. The map must not invent a zero row itself.
        tid = uuid.uuid4()
        db = _make_db([], [], [])  # cc_sub, ap_sub, task_q
        assert await self._call(db, [tid]) == {}

    async def test_aggregates_and_posted_are_summed_across_both_doc_tables(self):
        tid = uuid.uuid4()
        db = _make_db(
            [{"tid": tid, "n": 16}],  # credit_cards submitted
            [{"tid": tid, "n": 8}],  # ap_invoices submitted
            [
                {
                    "tid": tid,
                    "tried": 30,
                    "ok": 28,
                    "failed": 2,
                    "users": 20,
                    "active_days": 5,
                    "active_weeks": 4,
                    "first_use": date(2026, 6, 18),
                    "last_use": date(2026, 7, 9),
                    "cc": 16,
                    "ap": 14,
                }
            ],
        )
        out = await self._call(db, [tid], today=date(2026, 7, 15))
        row = out[str(tid)]
        assert row["tried"] == 30
        assert row["ok"] == 28
        assert row["failed"] == 2
        assert row["posted_to_carmen"] == 24  # 16 + 8, summed across both tables
        assert row["active_weeks"] == 4
        assert row["days_idle"] == 6  # 2026-07-15 minus 2026-07-09
        assert row["first_use"] == "2026-06-18"

    async def test_tried_without_posted_is_representable(self):
        # The activation signal: they extracted but never submitted to Carmen.
        tid = uuid.uuid4()
        db = _make_db(
            [],
            [],
            [
                {
                    "tid": tid,
                    "tried": 5,
                    "ok": 2,
                    "failed": 3,
                    "users": 3,
                    "active_days": 1,
                    "active_weeks": 1,
                    "first_use": date(2026, 7, 7),
                    "last_use": date(2026, 7, 7),
                    "cc": 5,
                    "ap": 0,
                }
            ],
        )
        row = (await self._call(db, [tid], today=date(2026, 7, 15)))[str(tid)]
        assert row["tried"] == 5
        assert row["posted_to_carmen"] == 0
        assert row["days_idle"] == 8


# ── call_type: extract vs suggest must never blend ───────────────────────────


class TestCallTypeSplit:
    async def test_vision_logs_extract_text_logs_suggest(self):
        # Both kinds carry the same module_id, so call_type is the only thing keeping
        # "how much did they use it" apart from "what did we pay for". If either client
        # stops tagging, every per-module count silently doubles.
        import inspect

        from app.llm import client

        vision_src = inspect.getsource(client.call_vision_llm)
        text_src = inspect.getsource(client.call_text_llm)
        assert 'call_type="extract"' in vision_src
        assert 'call_type="suggest"' in text_src

    async def test_log_llm_usage_persists_call_type(self):
        from app.services.llm_usage_logger import log_llm_usage

        captured = {}

        class _Session:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            def add(self, row):
                captured["row"] = row

            async def commit(self):
                pass

        with (
            patch("app.services.llm_usage_logger.async_session", _Session),
            patch("app.services.llm_usage_logger.get_pricing", AsyncMock(return_value=None)),
            patch("app.services.llm_usage_logger._ctx", return_value="t-1"),
        ):
            await log_llm_usage(
                model="m", prompt_tokens=1, completion_tokens=1, total_tokens=2, call_type="suggest"
            )

        assert captured["row"].call_type == "suggest"


# ── GET /admin/tenants — the include_engagement default ──────────────────────


class TestListTenantsEngagementFlag:
    def _tenant_row(self):
        t = MagicMock()
        t.id = uuid.uuid4()
        t.host = "example.invalid"
        t.bu_code = "bu1"
        t.name = "BU One"
        t.plan = "free"
        t.is_active = True
        t.contact_email = None
        t.created_at = datetime(2026, 6, 11, tzinfo=UTC)
        return t

    async def _call(self, db, include_engagement):
        from app.routers.admin.tenants import list_tenants

        return await list_tenants(
            active_only=True,
            include_engagement=include_engagement,
            limit=200,
            db=db,
            admin=_make_admin(),
        )

    async def test_default_off_issues_no_engagement_queries(self):
        # TenantSelector calls this endpoint on five other admin pages purely to
        # populate a <select>. If engagement ever becomes unconditional, all five
        # silently pay for three extra aggregate queries. This test is that guard.
        tenant = self._tenant_row()
        count = MagicMock()
        count.scalar_one.return_value = 1
        db = AsyncMock()
        # modules_count is opt-out: the active-module catalog minus explicitly
        # disabled rows, so it costs a catalog count plus a disabled-rows query.
        db.execute.side_effect = [
            count,
            _result([tenant]),
            _result([]),  # last_used
            _result(["credit_card_ocr", "ap_invoice"]),  # catalog count -> scalar_one = 2
            _result([]),  # explicitly-disabled rows: none
        ]

        result = await self._call(db, include_engagement=False)

        assert db.execute.await_count == 5  # count, tenants, last_used, catalog, disabled
        # No tenant_modules rows at all must read as "everything on", not zero.
        assert result["data"][0]["modules_count"] == 2
        assert "tried" not in result["data"][0]
        assert set(result["data"][0]) == {
            "id",
            "host",
            "bu_code",
            "name",
            "plan",
            "is_active",
            "contact_email",
            "modules_count",
            "last_used_at",
            "created_at",
        }

    async def test_engagement_on_adds_zeroed_row_for_never_extracted_tenant(self):
        tenant = self._tenant_row()
        count = MagicMock()
        count.scalar_one.return_value = 1
        db = AsyncMock()
        db.execute.side_effect = [
            count,
            _result([tenant]),
            _result([]),  # last_used
            _result(["credit_card_ocr", "ap_invoice"]),  # module catalog count
            _result([]),  # explicitly-disabled modules
            _result([]),  # cc submitted
            _result([]),  # ap submitted
            _result([]),  # task aggregates — none: this tenant never extracted
        ]

        row = (await self._call(db, include_engagement=True))["data"][0]

        assert row["tried"] == 0
        assert row["posted_to_carmen"] == 0
        assert row["last_use"] is None
        assert row["days_idle"] is None
