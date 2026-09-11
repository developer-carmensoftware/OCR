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

import pytest

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow
from app.services import email_ingest_service as ingest
from tests.unit.test_email_ingest_pipeline import _config, _extracted, _FakeDB, _run

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


async def _run_ar(db, *, setting=None, maps=None, **kw):
    kw.setdefault("extracted", _ar_extracted())
    kw.setdefault("config", _config())
    kw.setdefault("carmen_result", {"Code": 0, "InternalMessage": "JV-2606-0089"})
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


# ── What it posts ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ar_posts_one_debit_against_the_control_account_and_one_credit_per_scheme():
    _, p = await _run_ar(_FakeDB())

    payload = p.post_gljv.call_args[0][0]
    detail = payload["Detail"]
    assert len(detail) == 4, "1 debit + VS + MC + JCB"

    debit = detail[0]
    assert debit["AccCode"] == "1021000"
    assert debit["DrAmount"] == 11696.0  # 2,200 + 3,251 + 5,945 + 300
    credits = {r["AccCode"]: r["CrAmount"] for r in detail[1:]}
    assert credits == {"1021001": 5451.0, "1021002": 5945.0, "1021003": 300.0}
    assert sum(r["DrAmount"] for r in detail) == sum(r["CrAmount"] for r in detail)
    assert payload["Description"] == "Credit Card AR Reconcile 21/07/2026"
    assert detail[1]["Description"].startswith("Tax Inv.# 210726E00035291 - ")


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
    assert len(detail) == 5, "1 debit + 4 printed payment types"


@pytest.mark.asyncio
async def test_ar_claims_no_input_tax():
    """A reclassification moves an existing receivable between accounts. The commission's
    VAT is claimed once, by the fee invoice's own document — claiming it again here would
    double the credit."""
    _, p = await _run_ar(_FakeDB())
    p.post_input_tax.assert_not_called()


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
            details=[ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in FULL_DETAIL_ROWS]
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
