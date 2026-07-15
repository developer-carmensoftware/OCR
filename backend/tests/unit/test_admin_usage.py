"""
Unit tests for app/routers/admin/usage.py

Covers all 5 GET endpoints:
  - _resolve_tenant
  - get_usage_summary
  - get_usage_totals
  - get_llm_usage
  - tenant_ranking
  - user_usage
  - error_breakdown

Uses direct async calls with a mocked AsyncSession — no HTTP stack.
"""

from datetime import date, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── helpers ──────────────────────────────────────────────────────────────────


def _make_admin(is_global: bool = True, tenant_scope: str | None = None):
    admin = MagicMock()
    admin.is_global = is_global
    admin.tenant_scope = tenant_scope
    return admin


def _make_db(*result_batches):
    """
    Return an AsyncMock AsyncSession whose execute() returns each batch in
    sequence.  Each batch is a list of mapping-like dicts that can be consumed
    via .mappings().all(), .mappings().fetchone(), or .scalars().all().
    """
    db = AsyncMock()

    side_effects = []
    for batch in result_batches:
        result = MagicMock()
        if isinstance(batch, list):
            # Convert plain dicts to MappingMock so dict-style access works
            mapping_rows = [_DictMapping(r) if isinstance(r, dict) else r for r in batch]
            result.mappings.return_value.all.return_value = mapping_rows
            result.mappings.return_value.fetchone.return_value = (
                mapping_rows[0] if mapping_rows else None
            )
            result.scalars.return_value.all.return_value = batch
            result.scalar.return_value = batch[0] if batch else None
        else:
            # Raw scalar (int, None, …)
            result.scalar.return_value = batch
            result.scalars.return_value.all.return_value = [batch] if batch is not None else []
            result.mappings.return_value.all.return_value = []
            result.mappings.return_value.fetchone.return_value = None
        side_effects.append(result)

    db.execute.side_effect = side_effects if len(side_effects) > 1 else None
    if len(side_effects) == 1:
        db.execute.return_value = side_effects[0]
    elif not side_effects:
        empty = MagicMock()
        empty.mappings.return_value.all.return_value = []
        empty.mappings.return_value.fetchone.return_value = None
        empty.scalars.return_value.all.return_value = []
        empty.scalar.return_value = 0
        db.execute.return_value = empty
    return db


class _DictMapping(dict):
    """Dict that also supports attribute-style access for ORM-like rows."""

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name)

    def get(self, key, default=None):
        return super().get(key, default)


# ── _resolve_tenant ───────────────────────────────────────────────────────────


class TestResolveTenant:
    def _call(self, is_global, tenant_scope, param):
        from app.routers.admin.usage import _resolve_tenant

        admin = _make_admin(is_global=is_global, tenant_scope=tenant_scope)
        return _resolve_tenant(admin, param)

    def test_global_admin_no_param_returns_none(self):
        assert self._call(True, None, None) is None

    def test_global_admin_with_param_returns_param(self):
        assert self._call(True, None, "t-001") == "t-001"

    def test_scoped_admin_always_returns_own_scope(self):
        # Even if param says something else, scoped admin sees only their tenant
        assert self._call(False, "t-owned", "t-other") == "t-owned"

    def test_scoped_admin_no_param_returns_own_scope(self):
        assert self._call(False, "t-owned", None) == "t-owned"


# ── get_usage_summary ─────────────────────────────────────────────────────────


class TestGetUsageSummary:
    async def _call(self, db, admin=None, **kwargs):
        from app.routers.admin.usage import get_usage_summary

        return await get_usage_summary(
            from_date=kwargs.get("from_date"),
            to_date=kwargs.get("to_date"),
            module_id=kwargs.get("module_id"),
            tenant_id=kwargs.get("tenant_id"),
            db=db,
            admin=admin or _make_admin(),
        )

    async def test_A1_returns_data_key_with_list(self):
        db = _make_db([], [], [], [])  # LLM, task, cc_sub, ap_sub rows
        result = await self._call(db)
        assert "data" in result
        assert isinstance(result["data"], list)

    async def test_A1_returns_from_to_keys(self):
        db = _make_db([], [], [], [])
        result = await self._call(db)
        assert "from" in result
        assert "to" in result

    async def test_A1_defaults_from_to_start_of_month(self):
        db = _make_db([], [], [], [])
        result = await self._call(db)
        today = date.today()
        assert result["from"] == str(today.replace(day=1))
        assert result["to"] == str(today)

    async def test_A1_accepts_explicit_dates(self):
        db = _make_db([], [], [], [])
        from_d = date(2024, 1, 1)
        to_d = date(2024, 1, 31)
        result = await self._call(db, from_date=from_d, to_date=to_d)
        assert result["from"] == "2024-01-01"
        assert result["to"] == "2024-01-31"

    async def test_A1_days_equals_row_count(self):
        # 2 LLM summary rows → days = 2
        llm_rows = [
            {
                "summary_date": date(2024, 1, 1),
                "module_id": "cc",
                "tenant_id": "t1",
                "llm_calls": 5,
                "tokens": 1000,
                "cost_usd": Decimal("0.01"),
                "avg_llm_latency_ms": 200,
            },
            {
                "summary_date": date(2024, 1, 2),
                "module_id": "cc",
                "tenant_id": "t1",
                "llm_calls": 3,
                "tokens": 600,
                "cost_usd": Decimal("0.006"),
                "avg_llm_latency_ms": 180,
            },
        ]
        # batches: llm rows, tenant_name_map lookup (llm_rows have a truthy tenant_id,
        # so it's actually called), task, cc_sub, ap_sub
        db = _make_db(llm_rows, [], [], [], [])
        result = await self._call(db)
        assert result["days"] == 2

    async def test_A1_scoped_admin_sets_tenant_id(self):
        db = _make_db([], [], [], [])
        result = await self._call(db, admin=_make_admin(is_global=False, tenant_scope="t-scoped"))
        assert result["tenant_id"] == "t-scoped"

    async def test_A1_submissions_count(self):
        llm_rows = [
            {
                "summary_date": date(2024, 1, 1),
                "module_id": "cc",
                "tenant_id": "t1",
                "llm_calls": 5,
                "tokens": 1000,
                "cost_usd": Decimal("0.01"),
                "avg_llm_latency_ms": 200,
            },
        ]
        task_rows = [
            {
                "task_date": date(2024, 1, 1),
                "task_module": "cc",
                "task_tenant": "t1",
                "doc_count": 2,
                "error_count": 0,
            }
        ]
        cc_sub_rows = [
            {"sub_date": date(2024, 1, 1), "sub_module": "cc", "sub_tenant": "t1", "sub_count": 1}
        ]
        ap_sub_rows = [
            {"sub_date": date(2024, 1, 1), "sub_module": "cc", "sub_tenant": "t1", "sub_count": 2}
        ]
        # tenant_name_map lookup slots in between llm and task (llm_rows has a
        # truthy tenant_id, so it's actually called)
        db = _make_db(llm_rows, [], task_rows, cc_sub_rows, ap_sub_rows)
        result = await self._call(db)
        # 1 cc + 2 ap = 3 submissions
        assert result["data"][0]["submissions"] == 3


# ── get_usage_totals ──────────────────────────────────────────────────────────


class TestGetUsageTotals:
    async def _call(self, db, admin=None, **kwargs):
        from app.routers.admin.usage import get_usage_totals

        return await get_usage_totals(
            from_date=kwargs.get("from_date"),
            to_date=kwargs.get("to_date"),
            tenant_id=kwargs.get("tenant_id"),
            db=db,
            admin=admin or _make_admin(),
        )

    async def test_A2_returns_totals_key(self):
        # 4 execute calls: LLM agg, task agg, cc_count scalar, ap_count scalar
        db = _make_db(
            [
                {
                    "total_llm_calls": 10,
                    "total_tokens": 5000,
                    "total_cost_usd": Decimal("0.05"),
                    "avg_llm_latency_ms": 300,
                }
            ],  # llm_q
            [{"total_documents": 8, "total_errors": 1}],  # task_q
            0,  # cc scalar
            0,  # ap scalar
        )
        result = await self._call(db)
        assert "totals" in result
        assert result["totals"]["llm_calls"] == 10
        assert result["totals"]["documents"] == 8

    async def test_A2_empty_db_returns_zero_totals(self):
        empty_llm = [
            {
                "total_llm_calls": None,
                "total_tokens": None,
                "total_cost_usd": None,
                "avg_llm_latency_ms": None,
            }
        ]
        empty_task = [{"total_documents": None, "total_errors": None}]
        db = _make_db(empty_llm, empty_task, 0, 0)
        result = await self._call(db)
        assert result["totals"]["llm_calls"] == 0
        assert result["totals"]["documents"] == 0
        assert result["totals"]["errors"] == 0

    async def test_A2_submissions_sum_cc_plus_ap(self):
        llm_r = [
            {
                "total_llm_calls": 0,
                "total_tokens": 0,
                "total_cost_usd": Decimal("0"),
                "avg_llm_latency_ms": 0,
            }
        ]
        task_r = [{"total_documents": 0, "total_errors": 0}]
        # cc=3, ap=2 → submissions=5
        db = _make_db(llm_r, task_r, 3, 2)
        result = await self._call(db)
        assert result["totals"]["submissions"] == 5


# ── get_llm_usage ─────────────────────────────────────────────────────────────


class TestGetLlmUsage:
    def _make_log_row(self, **kwargs):
        row = MagicMock()
        row.id = kwargs.get("id", "log-1")
        row.tenant_id = kwargs.get("tenant_id", "t-1")
        row.module_id = kwargs.get("module_id", "cc")
        row.model = kwargs.get("model", "gpt-4o")
        row.task_id = kwargs.get("task_id", None)
        row.carmen_user_id = kwargs.get("carmen_user_id", "u-1")
        row.prompt_tokens = kwargs.get("prompt_tokens", 100)
        row.completion_tokens = kwargs.get("completion_tokens", 50)
        row.total_tokens = kwargs.get("total_tokens", 150)
        row.duration_ms = kwargs.get("duration_ms", Decimal("250"))
        row.cost_usd = kwargs.get("cost_usd", Decimal("0.003"))
        row.created_at = kwargs.get("created_at", datetime(2024, 1, 15, 10, 0))
        return row

    async def _call(self, db, **kwargs):
        from app.routers.admin.usage import get_llm_usage

        return await get_llm_usage(
            from_date=kwargs.get("from_date"),
            to_date=kwargs.get("to_date"),
            module_id=kwargs.get("module_id"),
            tenant_id=kwargs.get("tenant_id"),
            order_by=kwargs.get("order_by", "created_at"),
            limit=kwargs.get("limit", 100),
            db=db,
            admin=_make_admin(),
        )

    async def test_A3_returns_count_and_has_more(self):
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [self._make_log_row()]
        db = AsyncMock()
        db.execute.return_value = result_mock

        result = await self._call(db)
        assert "count" in result
        assert "has_more" in result
        assert result["count"] == 1
        assert result["has_more"] is False  # 1 < limit(100)

    async def test_A3_has_more_true_when_rows_equal_limit(self):
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [self._make_log_row() for _ in range(5)]
        db = AsyncMock()
        db.execute.return_value = result_mock

        result = await self._call(db, limit=5)
        assert result["has_more"] is True

    async def test_A3_data_contains_expected_fields(self):
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [self._make_log_row()]
        db = AsyncMock()
        db.execute.return_value = result_mock

        result = await self._call(db)
        row = result["data"][0]
        for field in (
            "id",
            "tenant_id",
            "module_id",
            "model",
            "prompt_tokens",
            "total_tokens",
            "cost_usd",
            "created_at",
        ):
            assert field in row, f"Missing field: {field}"

    async def test_A3_empty_result_returns_empty_data(self):
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db = AsyncMock()
        db.execute.return_value = result_mock

        result = await self._call(db)
        assert result["data"] == []
        assert result["count"] == 0


# ── tenant_ranking ────────────────────────────────────────────────────────────


class TestTenantRanking:
    async def _call(self, db, metric="error_rate", period_hours=24, limit=20, admin=None):
        from app.routers.admin.usage import tenant_ranking

        return await tenant_ranking(
            metric=metric,
            period_hours=period_hours,
            limit=limit,
            db=db,
            admin=admin or _make_admin(),
        )

    def _perf_rows(self):
        return MagicMock(
            **{
                "mappings.return_value.all.return_value": [
                    _DictMapping(
                        {
                            "tid": "t-1",
                            "total_requests": 100,
                            "errors": 10,
                            "avg_latency": Decimal("300"),
                            "max_latency": Decimal("800"),
                        }
                    ),
                ]
            }
        )

    def _cost_rows(self):
        return MagicMock(
            **{
                "mappings.return_value.all.return_value": [
                    _DictMapping(
                        {
                            "tid": "t-1",
                            "total_calls": 50,
                            "total_tokens": 20000,
                            "total_cost": Decimal("0.2"),
                        }
                    ),
                ]
            }
        )

    def _empty_tenant_map(self):
        result = MagicMock()
        result.mappings.return_value.all.return_value = []
        return result

    async def test_A4_error_rate_returns_metric_and_data(self):
        db = AsyncMock()
        db.execute.side_effect = [self._perf_rows(), self._empty_tenant_map()]
        result = await self._call(db, metric="error_rate")
        assert result["metric"] == "error_rate"
        assert "data" in result

    async def test_A4_latency_returns_correct_metric(self):
        db = AsyncMock()
        db.execute.side_effect = [self._perf_rows(), self._empty_tenant_map()]
        result = await self._call(db, metric="latency")
        assert result["metric"] == "latency"

    async def test_A4_volume_returns_correct_metric(self):
        db = AsyncMock()
        db.execute.side_effect = [self._perf_rows(), self._empty_tenant_map()]
        result = await self._call(db, metric="volume")
        assert result["metric"] == "volume"

    async def test_A4_cost_metric_returns_cost_fields(self):
        db = AsyncMock()
        db.execute.side_effect = [self._cost_rows(), self._empty_tenant_map()]
        result = await self._call(db, metric="cost")
        assert result["metric"] == "cost"
        assert result["data"][0]["total_calls"] == 50

    async def test_A4_error_rate_pct_computed_correctly(self):
        db = AsyncMock()
        db.execute.side_effect = [self._perf_rows(), self._empty_tenant_map()]
        result = await self._call(db, metric="error_rate")
        row = result["data"][0]
        # 10 errors / 100 requests = 10.0 %
        assert row["error_rate_pct"] == pytest.approx(10.0, abs=0.01)

    async def test_A4_scoped_admin_ranking_is_limited_to_own_tenant(self):
        """This endpoint ranks tenants against each other — a tenant-scoped admin must
        not be handed other tenants' error rate / latency / cost / volume."""
        db = AsyncMock()
        db.execute.side_effect = [self._perf_rows(), self._empty_tenant_map()]
        with patch(
            "app.services.usage_analytics_service.get_tenant_ranking",
            new_callable=AsyncMock,
        ) as mock_rank:
            mock_rank.return_value = []
            await self._call(db, admin=_make_admin(is_global=False, tenant_scope="t-9"))
        assert mock_rank.await_args.kwargs["tenant_id"] == "t-9"

    async def test_A4_global_admin_ranking_is_unrestricted(self):
        db = AsyncMock()
        db.execute.side_effect = [self._perf_rows(), self._empty_tenant_map()]
        with patch(
            "app.services.usage_analytics_service.get_tenant_ranking",
            new_callable=AsyncMock,
        ) as mock_rank:
            mock_rank.return_value = []
            await self._call(db, admin=_make_admin(is_global=True))
        assert mock_rank.await_args.kwargs["tenant_id"] is None


# ── user_usage ────────────────────────────────────────────────────────────────


class TestUserUsage:
    async def _call(self, db, **kwargs):
        from app.routers.admin.usage import user_usage

        return await user_usage(
            from_date=kwargs.get("from_date"),
            to_date=kwargs.get("to_date"),
            tenant_id=kwargs.get("tenant_id"),
            order_by=kwargs.get("order_by", "calls"),
            limit=kwargs.get("limit", 50),
            db=db,
            admin=_make_admin(),
        )

    async def test_A5_empty_returns_zero_total_users(self):
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = []
        db = AsyncMock()
        db.execute.return_value = result_mock
        result = await self._call(db)
        assert result["total_users"] == 0
        assert result["data"] == []

    async def test_A5_data_contains_carmen_user_id(self):
        row = _DictMapping(
            {
                "uid": "u-999",
                "total_calls": 10,
                "total_tokens": 5000,
                "total_cost": Decimal("0.05"),
                "avg_latency": Decimal("200"),
            }
        )
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = [row]
        db = AsyncMock()
        db.execute.return_value = result_mock
        result = await self._call(db)
        assert result["data"][0]["carmen_user_id"] == "u-999"
        assert result["data"][0]["total_calls"] == 10

    async def test_A5_from_to_keys_present(self):
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = []
        db = AsyncMock()
        db.execute.return_value = result_mock
        result = await self._call(db)
        assert "from" in result
        assert "to" in result


# ── error_breakdown ───────────────────────────────────────────────────────────


class TestErrorBreakdown:
    async def _call(self, db, group_by="module", period_hours=24, limit=50, tenant_id=None):
        from app.routers.admin.usage import error_breakdown

        return await error_breakdown(
            group_by=group_by,
            period_hours=period_hours,
            tenant_id=tenant_id,
            limit=limit,
            db=db,
            admin=_make_admin(),
        )

    async def test_A6_module_grouping_returns_group_by_module(self):
        row = _DictMapping({"group": "credit_card_ocr", "total": 10, "errors": 3})
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = [row]
        db = AsyncMock()
        db.execute.return_value = result_mock
        result = await self._call(db, group_by="module")
        assert result["group_by"] == "module"
        assert result["data"][0]["group"] == "credit_card_ocr"

    async def test_A6_tenant_grouping_returns_group_by_tenant(self):
        row = _DictMapping({"group": "t-1", "total": 5, "errors": 1, "avg_latency": 200})
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = [row]
        # group_by="tenant" with a truthy group ("t-1") means tenant_name_map makes
        # its own extra db.execute() call — give it a separate (empty) result.
        tenant_lookup_mock = MagicMock()
        tenant_lookup_mock.mappings.return_value.all.return_value = []
        db = AsyncMock()
        db.execute.side_effect = [result_mock, tenant_lookup_mock]
        result = await self._call(db, group_by="tenant")
        assert result["group_by"] == "tenant"

    async def test_A6_error_rate_pct_computed(self):
        row = _DictMapping({"group": "cc", "total": 20, "errors": 4})
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = [row]
        db = AsyncMock()
        db.execute.return_value = result_mock
        result = await self._call(db, group_by="module")
        assert result["data"][0]["error_rate_pct"] == pytest.approx(20.0, abs=0.01)

    async def test_A6_zero_total_returns_zero_pct(self):
        row = _DictMapping({"group": "cc", "total": 0, "errors": 0})
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = [row]
        db = AsyncMock()
        db.execute.return_value = result_mock
        result = await self._call(db, group_by="module")
        assert result["data"][0]["error_rate_pct"] == 0

    async def test_A6_endpoint_grouping_returns_group_by_endpoint(self):
        row = _DictMapping(
            {"group": "/api/v1/credit-card/extract", "total": 50, "errors": 2, "avg_latency": 500}
        )
        result_mock = MagicMock()
        result_mock.mappings.return_value.all.return_value = [row]
        db = AsyncMock()
        db.execute.return_value = result_mock
        result = await self._call(db, group_by="endpoint")
        assert result["group_by"] == "endpoint"
        assert "/api" in result["data"][0]["group"]
