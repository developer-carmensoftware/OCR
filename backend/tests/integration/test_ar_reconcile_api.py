"""Integration tests for /api/v1/ar-reconcile/*.

The preview endpoint is the one that matters most here: it is what the settings screen
renders, and `approve_document` rebuilds the same rows from the same builder, so a preview
that lies about the line count or the balance is a JV that posts wrong.
"""

from types import SimpleNamespace

from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/ar-reconcile"
AUTH = {"Authorization": "Bearer dummy"}

DETAIL_MAPPINGS = [
    {
        "payment_type_code": "VS INTER NON-PREM",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021001",
        "is_active": True,
    },
    {
        "payment_type_code": "VS INTER PREM",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021001",
        "is_active": True,
    },
    {
        "payment_type_code": "VS INTER UP PREM",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021001",
        "is_active": True,
    },
    {
        "payment_type_code": "MC INTER NON-PREM",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021002",
        "is_active": True,
    },
    {
        "payment_type_code": "MC INTER PREM",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021002",
        "is_active": True,
    },
    {
        "payment_type_code": "MC INTER UP PREM",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021002",
        "is_active": True,
    },
    {
        "payment_type_code": "JCB PREM",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021003",
        "is_active": True,
    },
]

SUMMARY_MAPPINGS = [
    {
        "payment_type_code": "VS",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021001",
        "is_active": True,
    },
    {
        "payment_type_code": "MC",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021002",
        "is_active": True,
    },
    {
        "payment_type_code": "JCB",
        "credit_dept_code": "GEN",
        "credit_account_code": "1021003",
        "is_active": True,
    },
]


def _preview(client, **over):
    body = {
        "bank_code": "KBANK",
        "post_type": "Detail",
        "jv_description_template": "Credit Card AR Reconcile {Settlement_Date}",
        "debit_dept_code": "GEN",
        "debit_account_code": "1021000",
        "mappings": DETAIL_MAPPINGS,
    }
    body.update(over)
    return client.post(f"{BASE}/preview", json=body, headers=AUTH)


# ── preview ───────────────────────────────────────────────────────────────────


def test_preview_detail_is_one_debit_and_seven_credits():
    with make_test_client(make_mock_db()) as client:
        resp = _preview(client)
        assert resp.status_code == 200
        body = resp.json()

        assert len(body["rows"]) == 8
        assert body["total_debit"] == body["total_credit"] == 25091.0
        assert body["balanced"] is True
        assert body["unmapped"] == []
        assert body["description"] == "Credit Card AR Reconcile 21/07/2026"


def test_preview_summary_collapses_to_three_credits():
    with make_test_client(make_mock_db()) as client:
        resp = _preview(client, post_type="Summary", mappings=SUMMARY_MAPPINGS)
        assert resp.status_code == 200
        body = resp.json()

        assert len(body["rows"]) == 4
        assert body["total_debit"] == body["total_credit"] == 25091.0
        assert body["balanced"] is True


def test_preview_reports_unmapped_types_rather_than_dropping_them():
    with make_test_client(make_mock_db()) as client:
        resp = _preview(client, mappings=DETAIL_MAPPINGS[:-1])
        body = resp.json()

        # The row still appears — it is what the reviewer has to map — and it still balances.
        assert len(body["rows"]) == 8
        assert body["unmapped"] == ["JCB PREM"]
        assert body["balanced"] is True


def test_preview_rejects_an_unknown_post_type():
    with make_test_client(make_mock_db()) as client:
        assert _preview(client, post_type="Weekly").status_code == 422


def test_preview_renders_every_template_tag():
    with make_test_client(make_mock_db()) as client:
        body = _preview(
            client,
            jv_description_template="{Bank_Name} {Tax_Invoice_No} {Settlement_Date}",
        ).json()
        assert body["description"] == "KBANK 210726E00035291 21/07/2026"


# ── settings ──────────────────────────────────────────────────────────────────


def test_get_settings_of_a_bank_never_configured_prefills_and_lists_blockers():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalars.return_value.first.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/settings?bank_code=KBANK", headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()

        assert body["enabled"] is False
        assert body["post_type"] == "Detail"
        assert {b["key"] for b in body["blockers"]} == {
            "bank_supported",
            "feature_enabled",
            "email_rule",
            "mapping_complete",
            "clearing_account",
            "auto_post",
        }
        # KBANK is the one bank Phase 1 can read, so that link is already green.
        assert next(b for b in body["blockers"] if b["key"] == "bank_supported")["ok"] is True


def test_enabling_an_unsupported_bank_is_refused_with_the_supported_list():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalars.return_value.first.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.put(
            f"{BASE}/settings",
            json={"bank_code": "SCB", "enabled": True, "mappings": {}},
            headers=AUTH,
        )
        assert resp.status_code == 400
        assert "KBANK" in resp.json()["detail"]


def test_an_unsupported_bank_can_still_be_saved_switched_off():
    """A draft is fine; arming a pipeline with no prompt behind it is not."""
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalars.return_value.first.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.put(
            f"{BASE}/settings",
            json={"bank_code": "SCB", "enabled": False, "mappings": {}},
            headers=AUTH,
        )
        assert resp.status_code == 200


def test_save_rejects_a_mapping_set_under_an_unknown_post_type():
    with make_test_client(make_mock_db()) as client:
        resp = client.put(
            f"{BASE}/settings",
            json={"bank_code": "KBANK", "mappings": {"Weekly": []}},
            headers=AUTH,
        )
        assert resp.status_code == 422


# ── sample payment types ──────────────────────────────────────────────────────


def test_sample_payment_types_seed_the_table_before_any_document_arrives():
    """No document has ever parked for this tenant/bank (`make_mock_db()` answers every
    query with nothing), so this falls back to the built-in KBANK sample."""
    with make_test_client(make_mock_db()) as client:
        resp = client.get(f"{BASE}/sample-payment-types?bank_code=KBANK", headers=AUTH)
        assert resp.status_code == 200
        codes = [r["payment_type_code"] for r in resp.json()]

        assert "VS INTER UP PREM" in codes and "JCB PREM" in codes
        assert all(r["credit_account_code"] is None for r in resp.json())


def test_sample_payment_types_prefers_this_tenants_own_parked_report():
    """A settlement report already sitting at `pending_review` for this bank is what a
    reviewer's own screen should seed from, not the generic KBANK example."""
    doc = SimpleNamespace(
        review_payload={
            "doc_type": "ar_reconcile",
            "extracted": {
                "doc_no": "999888E00012345",
                "doc_date": "01/01/2027",
                "details": [
                    {"transaction": "VS LOCAL PREM", "pay_amt": "500.00"},
                    {"transaction": "AMEX PREM", "pay_amt": "750.00"},
                ],
            },
        }
    )
    with make_test_client(make_mock_db(execute_rows=[doc])) as client:
        resp = client.get(f"{BASE}/sample-payment-types?bank_code=KBANK", headers=AUTH)
        assert resp.status_code == 200
        codes = [r["payment_type_code"] for r in resp.json()]

        assert codes == ["VS LOCAL PREM", "AMEX PREM"]
        assert "JCB PREM" not in codes


# Session auth is not asserted here: `make_test_client` overrides `get_current_session`
# for every test in this harness, so an unauthenticated call cannot be expressed. The
# router takes it as a FastAPI dependency like every other tenant-scoped router does.
