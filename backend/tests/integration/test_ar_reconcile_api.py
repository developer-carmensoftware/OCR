"""Integration tests for /api/v1/ar-reconcile/*.

The preview endpoint is the one that matters most here: it is what the settings screen
renders, and `approve_document` rebuilds the same rows from the same builder, so a preview
that lies about the line count or the balance is a JV that posts wrong.

Rewritten 2026-09-22 for decision #3 (docs/email-automation/06-decision-log.md #29):
`ARPreviewIn.mappings` changed shape from `list[ARMappingItem]` (this feature's own
credit-side rows, keyed by post type, with the three fixed debit legs read separately
from `get_accounting_config`) to `dict[str, FieldMapping]` — the merged mapping page's
*whole* live state, commission/tax/net and every credit-side key together, the same shape
`AccountingConfigResponse.mappings` already is. `/preview` no longer reads the database for
mapping data at all: the caller sends everything it needs. `ARSettingsIn` lost `mappings`
entirely (saved through `PUT /api/v1/config/accounting` now) and the bank selector's
`SUPPORTED_BANKS`/`RECONCILABLE_BANKS` constants are gone, replaced by
`banks.settlement_grouping` (`get_settlement_grouping`).
"""

from types import SimpleNamespace

from tests.conftest import make_mock_db
from tests.integration.conftest import make_test_client

BASE = "/api/v1/ar-reconcile"
AUTH = {"Authorization": "Bearer dummy"}

FIXED_MAPPINGS = {
    "commission": {"dept": "GEN", "acc": "9990"},
    "tax": {"dept": "GEN", "acc": "9991"},
    "net": {"dept": "GEN", "acc": "9992"},
}

DETAIL_MAPPINGS = {
    "VS INTER NON-PREM": {"dept": "GEN", "acc": "1021001"},
    "VS INTER PREM": {"dept": "GEN", "acc": "1021001"},
    "VS INTER UP PREM": {"dept": "GEN", "acc": "1021001"},
    "MC INTER NON-PREM": {"dept": "GEN", "acc": "1021002"},
    "MC INTER PREM": {"dept": "GEN", "acc": "1021002"},
    "MC INTER UP PREM": {"dept": "GEN", "acc": "1021002"},
    "JCB PREM": {"dept": "GEN", "acc": "1021003"},
}

SUMMARY_MAPPINGS = {
    "VS": {"dept": "GEN", "acc": "1021001"},
    "MC": {"dept": "GEN", "acc": "1021002"},
    "JCB": {"dept": "GEN", "acc": "1021003"},
}


def _preview(client, **over):
    body = {
        "bank_code": "KBANK",
        "post_type": "Detail",
        "jv_description_template": "Credit Card AR Reconcile {Settlement_Date}",
        "mappings": {**FIXED_MAPPINGS, **DETAIL_MAPPINGS},
    }
    body.update(over)
    return client.post(f"{BASE}/preview", json=body, headers=AUTH)


# ── preview ───────────────────────────────────────────────────────────────────


def test_preview_detail_is_three_fixed_debits_and_seven_credits():
    with make_test_client(make_mock_db()) as client:
        resp = _preview(client)
        assert resp.status_code == 200
        body = resp.json()

        assert len(body["rows"]) == 10, "3 fixed debit legs + 7 credits"
        assert body["total_debit"] == body["total_credit"] == 25091.0
        assert body["balanced"] is True
        assert body["unmapped"] == []
        assert body["description"] == "Credit Card AR Reconcile 21/07/2026"


def test_preview_summary_collapses_to_three_credits():
    with make_test_client(make_mock_db()) as client:
        resp = _preview(
            client, post_type="Summary", mappings={**FIXED_MAPPINGS, **SUMMARY_MAPPINGS}
        )
        assert resp.status_code == 200
        body = resp.json()

        assert len(body["rows"]) == 6, "3 fixed debit legs + VS + MC + JCB"
        assert body["total_debit"] == body["total_credit"] == 25091.0
        assert body["balanced"] is True


def test_preview_falls_back_to_the_sample_when_the_real_parked_report_has_no_total_row():
    """A report parked before decision #28 (2026-09-18) never got a `total_row`. Previewing
    it as-is would stick the three debit legs at zero forever — a real document that can
    never balance is a worse worked example than the hardcoded one that always can."""
    doc = SimpleNamespace(
        review_payload={
            "doc_type": "ar_reconcile",
            "extracted": {
                "doc_no": "OLD-NO-ANCHOR",
                "doc_date": "01/01/2026",
                "details": [{"transaction": "VS LOCAL PREM", "pay_amt": "999.00"}],
                # No total_row key at all — the pre-#28 shape.
            },
        }
    )
    with make_test_client(make_mock_db(execute_rows=[doc])) as client:
        resp = _preview(client)
        assert resp.status_code == 200
        body = resp.json()

        assert body["doc_no"] == "210726E00035291", "the hardcoded sample, not the real doc"
        assert body["total_debit"] == body["total_credit"] == 25091.0
        assert body["balanced"] is True


def test_preview_with_nothing_mapped_reports_every_leg_as_unmapped():
    """No `get_accounting_config` fallback any more (decision #3) — `/preview` takes the
    caller's word for the whole dict, so an empty one is genuinely nothing mapped."""
    with make_test_client(make_mock_db()) as client:
        resp = _preview(client, mappings={})
        body = resp.json()

        assert sorted(body["unmapped"]) == sorted(
            ["commission", "tax", "net", *DETAIL_MAPPINGS.keys()]
        )


def test_preview_reports_unmapped_types_rather_than_dropping_them():
    with make_test_client(make_mock_db()) as client:
        partial = dict(DETAIL_MAPPINGS)
        del partial["JCB PREM"]
        resp = _preview(client, mappings={**FIXED_MAPPINGS, **partial})
        body = resp.json()

        # The row still appears — it is what the reviewer has to map — and it still balances.
        assert len(body["rows"]) == 10
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


def test_preview_adds_nothing_to_a_plain_description_with_no_tag():
    """Ticket D (2026-09-22): this field carries whatever the mapping page's one
    Description input holds, fee-invoice or settlement. Since 2026-09-30 a value with no
    template tag posts exactly as saved — no ` - doc_date` — and the preview must show
    the same, or it would promise wording that never posts."""
    with make_test_client(make_mock_db()) as client:
        body = _preview(client, jv_description_template="AR Recon").json()
        assert body["description"] == "AR Recon"


# ── settings ──────────────────────────────────────────────────────────────────


def test_get_settings_of_a_bank_never_configured_prefills():
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalars.return_value.first.return_value = None
    with make_test_client(mock_db) as client:
        resp = client.get(f"{BASE}/settings?bank_code=KBANK", headers=AUTH)
        assert resp.status_code == 200
        body = resp.json()

        assert body["enabled"] is False
        assert body["post_type"] == "Detail"


def test_save_settings_rejects_an_unknown_post_type():
    with make_test_client(make_mock_db()) as client:
        resp = client.put(
            f"{BASE}/settings",
            json={"bank_code": "KBANK", "post_type": "Weekly"},
            headers=AUTH,
        )
        assert resp.status_code == 422


def test_saving_a_grouping_for_a_bank_with_no_settlement_layout_is_refused():
    """Every save, not only an "enabling" one. Since 2026-09-29 (`60c09c86`) this PUT carries
    `post_type` alone — the switch is the bank's email rule, set in Carmen — and nothing reads
    a grouping for a bank no settlement report can arrive from. It used to let an unsupported
    bank through "switched off" as a draft; with no switch left here there is no draft either.

    `make_mock_db()` with no `execute_rows` answers every query — including
    `get_settlement_grouping` — with nothing: "this bank has no settlement layout on file"
    (what replaced `SUPPORTED_BANKS`/`RECONCILABLE_BANKS`, decision #8)."""
    with make_test_client(make_mock_db()) as client:
        resp = client.put(
            f"{BASE}/settings",
            json={"bank_code": "SCB", "post_type": "Summary"},
            headers=AUTH,
        )
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert "SCB" in detail and "settlement" in detail.lower()


def test_a_bank_with_a_settlement_layout_saves_its_grouping():
    """The mapping page's only call here. A client still sending `enabled` changes nothing:
    it is not a field of `ARSettingsIn` any more."""
    mock_db = make_mock_db()
    mock_db.execute.return_value.scalar_one_or_none.return_value = "scheme"  # has a layout
    mock_db.execute.return_value.scalars.return_value.first.return_value = None  # never saved
    with make_test_client(mock_db) as client:
        resp = client.put(
            f"{BASE}/settings",
            json={"bank_code": "kbank", "post_type": "Summary", "enabled": True},
            headers=AUTH,
        )
        assert resp.status_code == 200
    row = mock_db.add.call_args.args[0]
    assert (row.bank_code, row.post_type) == ("KBANK", "Summary")


# ── sample payment types ──────────────────────────────────────────────────────


def test_no_parked_document_seeds_no_rows_at_all():
    """No document has ever parked for this tenant/bank (`make_mock_db()` answers every
    query with nothing), so there is nothing of theirs to map and the endpoint says so.

    It used to answer with the built-in `_SAMPLE_ROWS` KBANK example. Those rows are
    editable and get saved, so the fallback shipped a mapping keyed to payment types no
    document of this tenant's had ever printed. An empty table carrying `ar.mappingEmpty`
    is the honest version of the same answer.
    """
    with make_test_client(make_mock_db()) as client:
        resp = client.get(f"{BASE}/sample-payment-types?bank_code=KBANK", headers=AUTH)
        assert resp.status_code == 200
        assert resp.json() == []


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
