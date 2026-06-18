import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.summary_service import _aggregate_all


class RowMock:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


@pytest.mark.anyio
async def test_aggregate_all_normalizes_uuid_tenant_id_to_string():
    """Verify that _aggregate_all converts UUID tenant_ids from queries into string keys."""
    tenant_uuid = uuid.uuid4()
    tenant_str = str(tenant_uuid)

    # Mock database results
    mock_db = AsyncMock()

    # 1. Documents per tenant x module (accessed via properties: r.tenant_id, r.module_id, r.cnt)
    doc_mapping = RowMock(tenant_id=tenant_uuid, module_id="credit_card_ocr", cnt=5)

    mock_doc_result = MagicMock()
    mock_doc_result.mappings.return_value.fetchall.return_value = [doc_mapping]

    # 2. Submissions (accessed via dict keys: r["tenant_id"], r["module_id"], r["cnt"])
    cc_mapping = {"tenant_id": tenant_uuid, "module_id": "credit_card_ocr", "cnt": 2}

    mock_cc_result = MagicMock()
    mock_cc_result.mappings.return_value = [cc_mapping]

    mock_ap_result = MagicMock()
    mock_ap_result.mappings.return_value = []

    # 3. LLM usage (accessed via dict keys and .get(): r["tenant_id"], r["module_id"])
    llm_mapping = {
        "tenant_id": tenant_str,
        "module_id": "credit_card_ocr",
        "total_llm_calls": 10,
        "total_tokens": 5000,
        "total_cost_usd": 0.05,
        "avg_llm_latency_ms": 250.0,
    }

    mock_llm_result = MagicMock()
    mock_llm_result.mappings.return_value.fetchall.return_value = [llm_mapping]

    # 4. Performance (accessed via dict keys and .get())
    perf_mapping = {
        "tenant_id": tenant_str,
        "total_api_calls": 15,
        "avg_api_latency_ms": 120.0,
        "total_errors": 0,
    }

    mock_perf_result = MagicMock()
    mock_perf_result.mappings.return_value.fetchall.return_value = [perf_mapping]

    # 5. P95 latency (accessed via dict keys and .get())
    p95_mapping = {"tenant_id": tenant_str, "p95_ms": 150.0}

    mock_p95_result = MagicMock()
    mock_p95_result.mappings.return_value.fetchall.return_value = [p95_mapping]

    # 6. Corrections (accessed via dict keys)
    corr_mapping = {"tenant_id": tenant_uuid, "cnt": 1}

    mock_corr_result = MagicMock()
    mock_corr_result.mappings.return_value.fetchall.return_value = [corr_mapping]

    # 7. Outbound calls (accessed via dict keys)
    out_mapping = {"tenant_id": tenant_str, "cnt": 3}

    mock_out_result = MagicMock()
    mock_out_result.mappings.return_value.fetchall.return_value = [out_mapping]

    # Set execution side effects for mock_db.execute
    mock_db.execute.side_effect = [
        mock_doc_result,
        mock_cc_result,
        mock_ap_result,
        mock_llm_result,
        mock_perf_result,
        mock_p95_result,
        mock_corr_result,
        mock_out_result,
    ]

    params = {"start": datetime.now(UTC), "end": datetime.now(UTC)}

    results = await _aggregate_all(mock_db, params)

    # Verify that the keys merged properly and we only have exactly 1 result row
    assert len(results) == 1
    row = results[0]

    # Check that tenant_id in the row dictionary is a string, not a UUID object
    assert row["tenant_id"] == tenant_str
    assert isinstance(row["tenant_id"], str)

    # Verify values merged correctly across string and UUID keys
    assert row["total_documents"] == 5
    assert row["total_submissions"] == 2
    assert row["total_llm_calls"] == 10
    assert row["total_corrections"] == 1
    assert row["total_outbound_calls"] == 3
