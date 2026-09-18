"""AR reconciliation through the email pipeline — the second document type.

The rule decides which of the two documents arrived, because nothing on the page does: a
KBANK settlement report and the commission invoice for that same settlement share the
bank, the date and the tax invoice number. Everything asserted here hangs off that one
decision, so these tests are mostly about the branch being taken (or not taken) rather
than about arithmetic, which `test_ar_reconcile_jv.py` pins on its own.

Reuses the harness in `test_email_ingest_pipeline` rather than rebuilding it: the point of
several of these is that the AR path meets exactly the same gates, charge and ledger as
the path that was already there.
"""

from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow
from app.services import email_ingest_service as ingest
from tests.unit.test_email_ingest_pipeline import (
    _config,
    _extracted,
    _FakeDB,
    _run,
    _session_factory,
)

AR_RULE = [
    {
        "bank_code": "KBANK",
        "filename_patterns": ["KB1P554V2"],
        "is_active": True,
        "doc_type": "ar_reconcile",
    }
]

AR_FILE = "KB1P554V2_SUM_451005282039001_20260721.pdf"

AR_MAPS = {
    "VS": {"dept": "GEN", "acc": "1021001"},
    "MC": {"dept": "GEN", "acc": "1021002"},
    "JCB": {"dept": "GEN", "acc": "1021003"},
}

# SUMMARY MERCHANT ID block, page 3 of the sample PDF — every printed row, Σ THB AMT = 25,091.00.
FULL_DETAIL_ROWS = [
    ("VS INTER NON-PREM", "2,200.00"),
    ("VS INTER PREM", "3,251.00"),
    ("VS INTER UP PREM", "10,020.00"),
    ("MC INTER NON-PREM", "1,000.00"),
    ("MC INTER PREM", "5,945.00"),
    ("MC INTER UP PREM", "2,375.00"),
    ("JCB PREM", "300.00"),
]

FULL_DETAIL_MAPS = {
    "VS INTER NON-PREM": {"dept": "GEN", "acc": "1021001"},
    "VS INTER PREM": {"dept": "GEN", "acc": "1021001"},
    "VS INTER UP PREM": {"dept": "GEN", "acc": "1021001"},
    "MC INTER NON-PREM": {"dept": "GEN", "acc": "1021002"},
    "MC INTER PREM": {"dept": "GEN", "acc": "1021002"},
    "MC INTER UP PREM": {"dept": "GEN", "acc": "1021002"},
    "JCB PREM": {"dept": "GEN", "acc": "1021003"},
}


def _ar_extracted(**overrides) -> ExtractedCreditCardData:
    defaults = dict(
        doc_no="210726E00035291",
        doc_date="21/07/2026",
        bank_name="KASIKORNBANK",
        company_name="THE YAMA HOTEL PHUKET",
        merchant_id="451005282039001",
        raw_text="",
        tax_ids=[],
        is_duplicate=False,
        details=[
            ExtractedDetailRow(transaction=t, pay_amt=a)
            for t, a in (
                ("VS INTER NON-PREM", "2,200.00"),
                ("VS INTER PREM", "3,251.00"),
                ("MC INTER PREM", "5,945.00"),
                ("JCB PREM", "300.00"),
            )
        ],
        # Σ pay_amt above = 11,696.00 = commis_amt + tax_amt + total below — what a real
        # anchor row's own self-consistency guarantees (decision #28).
        total_row=ExtractedDetailRow(commis_amt="300.00", tax_amt="20.00", total="11,376.00"),
    )
    defaults.update(overrides)
    return ExtractedCreditCardData(**defaults)


def _setting(enabled=True, post_type="Summary"):
    return SimpleNamespace(
        id=7,
        enabled=enabled,
        post_type=post_type,
        jv_description_template="Credit Card AR Reconcile {Settlement_Date}",
        debit_dept_code="GEN",
        debit_account_code="1021000",
    )


@contextmanager
def _ar_config(setting, maps=None):
    with (
        patch.object(ingest, "_ar_setting", AsyncMock(return_value=setting)),
        patch.object(
            ingest, "_ar_mappings", AsyncMock(return_value=AR_MAPS if maps is None else maps)
        ),
    ):
        yield


# The default `_ar_extracted()`'s own merchant id, with a CSV sidecar row that verifies
# it — so a test not specifically about the TIN check gets a clean, verified document by
# default. Tests covering ticket 04 itself override `tax_summary` explicitly.
AR_TAX_SUMMARY = {
    "451005282039001": {"tax_id": "0835553001610", "tax_invoice_no": "210726E00035291"}
}


async def _run_ar(db, *, setting=None, maps=None, **kw):
    kw.setdefault("extracted", _ar_extracted())
    kw.setdefault("config", _config())
    kw.setdefault("carmen_result", {"Code": 0, "InternalMessage": "JV-2606-0089"})
    kw.setdefault("tax_summary", AR_TAX_SUMMARY)
    with _ar_config(_setting() if setting is None else setting, maps):
        return await _run(db, filename=AR_FILE, rules=AR_RULE, **kw)


# ── The branch ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ar_rule_reads_the_last_page_with_the_settlement_layout():
    outcome, p = await _run_ar(_FakeDB())

    assert outcome == "posted"
    kwargs = p.extract.call_args.kwargs
    # The usable figures are on the last page; the earlier ones repeat the same money per
    # terminal and per batch.
    assert kwargs["page_indexes"] == [-1]
    assert kwargs["doc_type"] == "ar_reconcile"
    # Selected, not auto-detected: the rule already named the bank, and there is one
    # settlement layout per bank.
    assert kwargs["bank_code"] == "KBANK"


@pytest.mark.asyncio
async def test_a_fee_invoice_still_takes_the_original_path():
    """The branch must not capture documents that were never tagged for it."""
    outcome, p = await _run(
        _FakeDB(),
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-9"},
    )

    assert outcome == "posted"
    kwargs = p.extract.call_args.kwargs
    assert kwargs["doc_type"] == "fee_invoice"
    assert kwargs["page_indexes"] is None
    assert kwargs["bank_code"] is None
    p.post_input_tax.assert_called_once()


# ── Duplicate key must agree with `finalize_extraction`'s ──────────────────────
#
# KBANK prints ONE tax invoice number across both documents: the commission fee invoice
# and the settlement report that reclassifies the same day's takings. Before this fix,
# `_already_pending` matched on (bank_code, doc_no) alone, so a fee invoice already
# waiting for review made the settlement report sharing its number look like a copy of
# itself — and vice versa. `finalize_extraction`'s own duplicate key already includes
# `doc_type` for this exact reason.


@pytest.mark.asyncio
async def test_a_parked_fee_invoice_does_not_block_its_sibling_settlement_report():
    tenant_id = str(uuid4())
    db = _FakeDB(pending_payloads=[{"doc_type": "fee_invoice"}])
    with patch.object(ingest, "async_session", _session_factory(db)):
        blocked = await ingest._already_pending(
            tenant_id, "KBANK", "210726E00035291", "ar_reconcile"
        )
    assert blocked is False


@pytest.mark.asyncio
async def test_a_second_copy_of_the_same_document_type_is_still_caught():
    """The fix narrows the key, it must not blind it: two settlement reports parked for
    the same tax invoice number are a real duplicate."""
    tenant_id = str(uuid4())
    db = _FakeDB(pending_payloads=[{"doc_type": "ar_reconcile"}])
    with patch.object(ingest, "async_session", _session_factory(db)):
        blocked = await ingest._already_pending(
            tenant_id, "KBANK", "210726E00035291", "ar_reconcile"
        )
    assert blocked is True


@pytest.mark.asyncio
async def test_a_row_parked_before_doc_type_existed_defaults_to_fee_invoice():
    """`email_documents` has no `doc_type` column — everything downstream reads it from
    `review_payload`, which a row parked before this feature shipped never had."""
    tenant_id = str(uuid4())
    db = _FakeDB(pending_payloads=[{}])
    with patch.object(ingest, "async_session", _session_factory(db)):
        assert await ingest._already_pending(tenant_id, "KTC", "INV-001", "fee_invoice") is True
        assert await ingest._already_pending(tenant_id, "KTC", "INV-001", "ar_reconcile") is False


# ── What it posts ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ar_posts_three_fixed_debit_legs_and_one_credit_per_scheme():
    """The debit side reads the BU's existing credit-card mapping (MAPPINGS in
    test_email_ingest_pipeline.py, patched in via `_config()`/`get_accounting_config`) —
    not a mapping table of this feature's own — off the report's own total row."""
    _, p = await _run_ar(_FakeDB())

    payload = p.post_gljv.call_args[0][0]
    detail = payload["Detail"]
    assert len(detail) == 6, "3 fixed debit legs + VS + MC + JCB"

    debits = {r["Description"]: r for r in detail[:3]}
    assert debits["Credit card commission"]["AccCode"] == "5100"
    assert debits["Credit card commission"]["DrAmount"] == 300.0
    assert debits["Input Tax"]["AccCode"] == "1150" and debits["Input Tax"]["DrAmount"] == 20.0
    assert debits["Bank Account"]["AccCode"] == "1010"
    assert debits["Bank Account"]["DrAmount"] == 11376.0
    credits = {r["AccCode"]: r["CrAmount"] for r in detail[3:]}
    assert credits == {"1021001": 5451.0, "1021002": 5945.0, "1021003": 300.0}
    assert sum(r["DrAmount"] for r in detail) == sum(r["CrAmount"] for r in detail)
    assert payload["Description"] == "Credit Card AR Reconcile 21/07/2026"
    assert detail[3]["Description"].startswith("Tax Inv.# 210726E00035291 - ")


@pytest.mark.asyncio
async def test_detail_mode_posts_one_credit_per_printed_payment_type():
    detail_maps = {
        "VS INTER NON-PREM": {"dept": "GEN", "acc": "1021001"},
        "VS INTER PREM": {"dept": "GEN", "acc": "1021001"},
        "MC INTER PREM": {"dept": "GEN", "acc": "1021002"},
        "JCB PREM": {"dept": "GEN", "acc": "1021003"},
    }
    _, p = await _run_ar(_FakeDB(), setting=_setting(post_type="Detail"), maps=detail_maps)

    detail = p.post_gljv.call_args[0][0]["Detail"]
    assert len(detail) == 7, "3 fixed debit legs + 4 printed payment types"


@pytest.mark.asyncio
async def test_ar_claims_no_input_tax():
    """A reclassification moves an existing receivable between accounts. The commission's
    VAT is claimed once, by the fee invoice's own document — claiming it again here would
    double the credit."""
    _, p = await _run_ar(_FakeDB())
    p.post_input_tax.assert_not_called()


# ── TIN second factor (ticket 04) ───────────────────────────────────────────────
#
# The settlement report's own page prints no tax ID (decision #28), so `foreign_tax_id`
# has nothing to check for this document type unless the CSV sidecar supplies one.


@pytest.mark.asyncio
async def test_a_verified_merchant_feeds_its_tin_into_the_existing_check():
    """The default fixture (`AR_TAX_SUMMARY`) matches the default `_ar_extracted()`'s
    merchant id — the ordinary, clean case every other test in this file relies on."""
    outcome, p = await _run_ar(_FakeDB())

    assert outcome == "posted"
    p.foreign_tax_id.assert_awaited_once()
    assert "0835553001610" in p.foreign_tax_id.call_args.args[1]


@pytest.mark.asyncio
async def test_no_csv_sidecar_parks_as_tin_unverified_and_never_auto_posts():
    db = _FakeDB()
    outcome, p = await _run_ar(db, tax_summary={})

    assert outcome == "pending_review"
    p.post_gljv.assert_not_called()
    row = db.added[0]
    assert "tin_unverified" in row.review_payload["flags"]


@pytest.mark.asyncio
async def test_a_csv_for_a_different_merchant_is_the_same_as_no_csv_at_all():
    db = _FakeDB()
    other_merchant = {"999999999999999": {"tax_id": "0835553001610"}}
    outcome, p = await _run_ar(db, tax_summary=other_merchant)

    assert outcome == "pending_review"
    row = db.added[0]
    assert "tin_unverified" in row.review_payload["flags"]


@pytest.mark.asyncio
async def test_a_tin_conflict_via_csv_parks_as_tax_id_mismatch():
    """The same shared `tax_id_mismatch` skip a fee invoice already gets — the settlement
    report's page never prints a TIN of its own, so this is only reachable now that the
    CSV supplies one to check."""
    db = _FakeDB()
    outcome, p = await _run_ar(db, conflict="9999999999999")

    assert outcome == "pending_review"
    assert db.added[0].reason_code == "tax_id_mismatch"
    p.post_gljv.assert_not_called()


# ── What stops it ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ar_switched_off_costs_nothing():
    """The check sits before `consume_document`, so a BU that tagged a rule and then turned
    the feature off is not billed for the mail that keeps arriving."""
    db = _FakeDB()
    outcome, p = await _run_ar(db, setting=_setting(enabled=False), carmen_result=None)

    assert outcome == "skipped"
    assert db.added[0].reason_code == "ar_reconcile_disabled"
    p.consume_document.assert_not_called()
    p.extract.assert_not_called()


@pytest.mark.asyncio
async def test_ar_never_configured_costs_nothing_either():
    db = _FakeDB()
    outcome, p = await _run_ar(db, setting=False, carmen_result=None)

    assert outcome == "skipped"
    p.consume_document.assert_not_called()


@pytest.mark.asyncio
async def test_an_unmapped_scheme_parks_instead_of_posting():
    db = _FakeDB()
    outcome, p = await _run_ar(db, maps={"VS": AR_MAPS["VS"]})

    assert outcome == "pending_review"
    p.post_gljv.assert_not_called()
    row = db.added[0]
    assert "mapping_missing" in row.review_payload["flags"]
    assert sorted(row.review_payload["unmapped"]) == ["JCB", "MC"]
    # The review screen needs to know which builder made this document — nothing on the
    # extraction says so.
    assert row.review_payload["doc_type"] == "ar_reconcile"
    # No AI suggestion on this path: nothing could confirm one into ar_reconcile_mappings,
    # so asking would spend a call to produce a value that disappears on the next poll.
    p.suggest.assert_not_called()


@pytest.mark.asyncio
async def test_a_missing_fixed_debit_mapping_parks_instead_of_posting():
    """Decision #28: the three fixed debit legs (commission/tax/net) read the BU's
    existing credit-card mapping, not a mapping table of this feature's own — so a gap
    there is caught by the same `mapping_missing` flag the credit side uses, rather than a
    bespoke clearing-account flag (removed along with the control-leg concept)."""
    db = _FakeDB()
    outcome, p = await _run_ar(db, config=_config(mappings={"commission": AR_MAPS["VS"]}))

    assert outcome == "pending_review"
    p.post_gljv.assert_not_called()
    row = db.added[0]
    assert "mapping_missing" in row.review_payload["flags"]
    assert sorted(row.review_payload["unmapped"]) == ["net", "tax"]


@pytest.mark.asyncio
async def test_a_mismatched_total_row_parks_as_unbalanced():
    """Decision #28: the debit side reads the report's own total row, independent of the
    credit rows grouped from `details` — a real disagreement is now possible, and
    `unbalanced` is what catches it (`is_balanced` used to be a tautology over this
    builder's own output, so nothing could ever have set this flag before today)."""
    db = _FakeDB()
    outcome, p = await _run_ar(
        db,
        extracted=_ar_extracted(
            total_row=ExtractedDetailRow(commis_amt="1.00", tax_amt="1.00", total="1.00")
        ),
    )

    assert outcome == "pending_review"
    p.post_gljv.assert_not_called()
    row = db.added[0]
    assert "unbalanced" in row.review_payload["flags"]
    assert row.review_payload["unmapped"] == [], "the arithmetic disagrees, not the mapping"


# ── The review fork: fully mapped and balanced, still no auto-post ────────────


@pytest.mark.asyncio
async def test_a_clean_detail_report_still_waits_when_auto_post_is_off():
    """Every row is mapped and the JV would balance, but `auto_post` off is the whole
    feature: extract, gate, group — then wait for a human, same as the fee-invoice fork
    in test_email_ingest_pipeline.py's `test_review_mode_parks_the_document_instead_of_posting`.
    """
    db = _FakeDB()
    outcome, p = await _run_ar(
        db,
        auto_post=False,
        extracted=_ar_extracted(
            details=[ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in FULL_DETAIL_ROWS],
            # FULL_DETAIL_ROWS is the real worked example — its own real anchor row, not
            # the smaller default `_ar_extracted()` total_row (which matches the smaller
            # 4-row default `details` instead).
            total_row=ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="24,467.20"),
        ),
        setting=_setting(post_type="Detail"),
        maps=FULL_DETAIL_MAPS,
        carmen_result={"Code": 0, "InternalMessage": "JV-2606-0090"},
    )

    assert outcome == "pending_review"
    p.post_gljv.assert_not_called()

    row = db.added[0]
    assert row.status == "pending_review"
    assert row.doc_no == "210726E00035291"
    assert row.review_payload["flags"] == []
    assert row.review_payload["unmapped"] == []
    assert row.review_payload["doc_type"] == "ar_reconcile"
    assert len(row.review_payload["extracted"]["details"]) == 7


# ── Password-protected reports ────────────────────────────────────────────────
#
# Nothing about this is AR-specific, and that is the point of testing it. The unlock sits
# above the document-type branch, so a settlement report is opened by exactly the code that
# opens a commission invoice: the BU's own rule passwords, tried before anything is charged.


@pytest.mark.asyncio
async def test_a_locked_report_is_opened_with_the_rule_password_like_any_other_document():
    db = _FakeDB()
    outcome, p = await _run_ar(db, passwords=["s3cret"], open_password="s3cret")

    assert outcome == "posted"
    # Every one of this BU's rule passwords is offered, not just the matched rule's.
    assert p.open_or_fail.call_args.args[2] == ["s3cret"]
    # And the one that worked travels to the extractor, which has to decrypt before it can
    # take the last page.
    assert p.extract.call_args.kwargs["pdf_password"] == "s3cret"


@pytest.mark.asyncio
async def test_a_report_nobodys_password_opens_costs_nothing():
    """The unlock is above `consume_document`, so a wrong password is not a paid failure —
    same as the commission path."""
    db = _FakeDB()
    outcome, p = await _run_ar(
        db,
        passwords=["wrong"],
        carmen_result=None,
        open_side_effect=ingest._Skip("wrong_pdf_password", "None of the saved passwords"),
    )

    assert outcome == "skipped"
    assert db.added[0].reason_code == "wrong_pdf_password"
    p.consume_document.assert_not_called()
    p.extract.assert_not_called()
