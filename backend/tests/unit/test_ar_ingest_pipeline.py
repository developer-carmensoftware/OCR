"""AR reconciliation through the email pipeline — the second document type.

The rule decides which of the two documents arrived, because nothing on the page does: a
KBANK settlement report and the commission invoice for that same settlement share the
bank, the date and the tax invoice number. Everything asserted here hangs off that one
decision, so these tests are mostly about the branch being taken (or not taken) rather
than about arithmetic, which `test_cc_jv.py`'s settlement-report section pins on its own.

Reuses the harness in `test_email_ingest_pipeline` rather than rebuilding it: the point of
several of these is that the AR path meets exactly the same gates, charge and ledger as
the path that was already there.

Updated 2026-09-22 for decision #3: `_ar_mappings` (a query against the now-archived
`ar_reconcile_mappings` table) is gone from `email_ingest_service.py`, so there is nothing
left to mock it with. The settlement report's credit-side keys live in
`bu_accounting_mapping_entries` now, the same dict `config.mappings` already supplied for
the three fixed debit legs — so every fixture below that used to pass a separate `maps=`
into a mocked `_ar_mappings` now merges that same dict into `_config(mappings=...)`
instead.

Updated 2026-09-29: the rule is the whole switch — "switched off" is the rule going
inactive, not a settings row. The Detail/Summary grouping is still the mapping page's, read
through `pipeline._ar_post_type`, which `_run_ar` patches. The fee-invoice double-book guard and its tests are gone with it: rules are one
per bank, so a KBANK fee-invoice rule and a reconciling KBANK can no longer coexist.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow
from app.services.email_automation import ledger, pipeline
from tests.unit.test_email_ingest_pipeline import (
    MAPPINGS,
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


def _ar_mappings_dict(maps=None) -> dict:
    """The merged `config.mappings` dict the AR path now reads for both debit legs and
    credit groups — commission/tax/net/Visa (`MAPPINGS` from `test_email_ingest_pipeline`)
    plus whichever credit-side dict a test wants, folded into one (decision #3)."""
    return {**MAPPINGS, **(AR_MAPS if maps is None else maps)}


# The default `_ar_extracted()`'s own merchant id, with a CSV sidecar row that verifies
# it — so a test not specifically about the TIN check gets a clean, verified document by
# default. Tests covering ticket 04 itself override `tax_summary` explicitly.
AR_TAX_SUMMARY = {
    "451005282039001": {"tax_id": "0835553001610", "tax_invoice_no": "210726E00035291"}
}


async def _run_ar(db, *, post_type="Summary", rules=None, maps=None, **kw):
    kw.setdefault("extracted", _ar_extracted())
    kw.setdefault("config", _config(mappings=_ar_mappings_dict(maps)))
    kw.setdefault("carmen_result", {"Code": 0, "InternalMessage": "JV-2606-0089"})
    kw.setdefault("tax_summary", AR_TAX_SUMMARY)
    with patch.object(pipeline, "_ar_post_type", AsyncMock(return_value=post_type)):
        return await _run(db, filename=AR_FILE, rules=rules or AR_RULE, **kw)


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
    with patch.object(ledger, "async_session", _session_factory(db)):
        blocked = await ledger._already_pending(
            tenant_id, "KBANK", "210726E00035291", "ar_reconcile"
        )
    assert blocked is False


@pytest.mark.asyncio
async def test_a_second_copy_of_the_same_document_type_is_still_caught():
    """The fix narrows the key, it must not blind it: two settlement reports parked for
    the same tax invoice number are a real duplicate."""
    tenant_id = str(uuid4())
    db = _FakeDB(pending_payloads=[{"doc_type": "ar_reconcile"}])
    with patch.object(ledger, "async_session", _session_factory(db)):
        blocked = await ledger._already_pending(
            tenant_id, "KBANK", "210726E00035291", "ar_reconcile"
        )
    assert blocked is True


@pytest.mark.asyncio
async def test_a_row_parked_before_doc_type_existed_defaults_to_fee_invoice():
    """`email_documents` has no `doc_type` column — everything downstream reads it from
    `review_payload`, which a row parked before this feature shipped never had."""
    tenant_id = str(uuid4())
    db = _FakeDB(pending_payloads=[{}])
    with patch.object(ledger, "async_session", _session_factory(db)):
        assert await ledger._already_pending(tenant_id, "KTC", "INV-001", "fee_invoice") is True
        assert await ledger._already_pending(tenant_id, "KTC", "INV-001", "ar_reconcile") is False


# ── What it posts ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ar_posts_three_fixed_debit_legs_and_one_credit_per_scheme():
    """The debit side reads the BU's existing credit-card mapping (MAPPINGS in
    test_email_ingest_pipeline.py, patched in via `_config()`/`get_accounting_config`) —
    not a mapping table of this feature's own — off the report's own total row. The
    description now resolves from that same config's `bank_descriptions` too (Ticket D,
    2026-09-22) — not a settlement-only template."""
    _, p = await _run_ar(
        _FakeDB(),
        config=_config(
            mappings=_ar_mappings_dict(),
            bank_descriptions={"KBANK": "Credit Card AR Reconcile {Settlement_Date}"},
        ),
    )

    payload = p.post_gljv.call_args[0][0]
    detail = payload["Detail"]
    assert len(detail) == 6, "3 fixed debit legs + VS + MC + JCB"

    debits = {r["Description"]: r for r in detail[-3:]}
    assert debits["Credit card commission"]["AccCode"] == "5100"
    assert debits["Credit card commission"]["DrAmount"] == 300.0
    assert debits["Input Tax"]["AccCode"] == "1150" and debits["Input Tax"]["DrAmount"] == 20.0
    assert debits["Bank Account"]["AccCode"] == "1010"
    assert debits["Bank Account"]["DrAmount"] == 11376.0
    credits = {r["AccCode"]: r["CrAmount"] for r in detail[:-3]}
    assert credits == {"1021001": 5451.0, "1021002": 5945.0, "1021003": 300.0}
    assert sum(r["DrAmount"] for r in detail) == sum(r["CrAmount"] for r in detail)
    assert payload["Description"] == "Credit Card AR Reconcile 21/07/2026"
    assert detail[0]["Description"] == "VS", "the payment type alone, no Tax Inv.# prefix"


@pytest.mark.asyncio
async def test_detail_mode_posts_one_credit_per_printed_payment_type():
    detail_maps = {
        "VS INTER NON-PREM": {"dept": "GEN", "acc": "1021001"},
        "VS INTER PREM": {"dept": "GEN", "acc": "1021001"},
        "MC INTER PREM": {"dept": "GEN", "acc": "1021002"},
        "JCB PREM": {"dept": "GEN", "acc": "1021003"},
    }
    _, p = await _run_ar(_FakeDB(), post_type="Detail", maps=detail_maps)

    detail = p.post_gljv.call_args[0][0]["Detail"]
    assert len(detail) == 7, "3 fixed debit legs + 4 printed payment types"


@pytest.mark.asyncio
async def test_ar_files_its_own_input_tax_from_the_total_row():
    """Since decision #28 the fee invoice that used to file this claim is no longer
    processed once AR reconciliation covers a bank, so the settlement report claims the
    commission's VAT itself — from the report's own `total_row`
    (`_ar_extracted()`'s default: commis_amt=300.00, tax_amt=20.00), not `extracted.details`
    (whose per-scheme rows print no commission/VAT of their own)."""
    outcome, p = await _run_ar(_FakeDB())

    assert outcome == "posted"
    p.post_input_tax.assert_awaited_once()
    assert p.post_input_tax.call_args.kwargs["details"] == [
        ExtractedDetailRow(commis_amt="300.00", tax_amt="20.00", total="11,376.00")
    ]


@pytest.mark.asyncio
async def test_a_failed_input_tax_post_does_not_block_the_ar_jv():
    """Same non-fatal contract every other document type already gets: the JV is already
    in Carmen's books, so a failed input-tax record is recorded on the ledger, not turned
    into a park or a failure."""
    outcome, p = await _run_ar(_FakeDB(), tax_note="Input tax not recorded: Carmen said no")
    assert outcome == "posted"


@pytest.mark.asyncio
async def test_settlement_report_input_tax_uses_the_real_worked_example():
    """Ticket 06's own acceptance criterion, exercised for real (not mocked at the
    `_post_input_tax` boundary): approving produces base 582.99, VAT 40.81, and KBank's
    registered legal name/TIN/address — read from the `banks` table, not the document,
    which prints none of the three."""
    total_row = ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="24467.20")
    bank = SimpleNamespace(
        id="KBANK",
        code="KBANK",
        legal_name="Kasikornbank Public Company Limited",
        tax_id="0107536000315",
        address="1 Ratburana Rd, Bangkok",
    )
    db = _FakeDB()
    db.add(bank)
    profiles = {"Data": [{"Code": "VAT7", "Description": "VAT 7%", "Active": True, "TaxRate": 7}]}
    post_mock = AsyncMock(return_value={"Code": 0})
    with (
        patch.object(pipeline, "async_session", _session_factory(db)),
        patch.object(pipeline, "get_tax_profiles", AsyncMock(return_value=profiles)),
        patch.object(pipeline.carmen, "post_input_tax", post_mock),
    ):
        note = await pipeline._post_input_tax(
            _ar_extracted(total_row=total_row),
            bank_code="KBANK",
            config=_config(),
            carmen_token="tok",
            details=[total_row],
        )

    assert note is None
    payload = post_mock.call_args.args[0]
    assert payload["BfTaxAmt"] == "582.99"
    assert payload["TaxAmt"] == 40.81
    assert payload["VnName"] == "Kasikornbank Public Company Limited"
    assert payload["TaxId"] == "0107536000315"
    assert payload["Address"] == "1 Ratburana Rd, Bangkok"


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


# ── CSV vs. report figure cross-check (ticket 05) ───────────────────────────────
#
# Once the CSV (ticket 01) and the report's own total row (ticket 03) are both on hand,
# three more numbers are free to check against each other. A disagreement never rejects
# the document — same as every other reconciliation check on this path, it's a warning,
# parked via the existing `warnings` flag. Figures line up against `_ar_extracted()`'s
# own default `total_row` (commis_amt="300.00", tax_amt="20.00", total="11,376.00").

AR_TAX_SUMMARY_AGREEING = {
    "451005282039001": {
        "tax_id": "0835553001610",
        "tax_invoice_no": "210726E00035291",
        "fee": "300.00",
        "vat": "20.00",
        "net": "11376.00",
    }
}

AR_TAX_SUMMARY_DISAGREEING = {
    "451005282039001": {
        "tax_id": "0835553001610",
        "tax_invoice_no": "210726E00035291",
        "fee": "999.00",
        "vat": "20.00",
        "net": "11376.00",
    }
}


@pytest.mark.asyncio
async def test_agreeing_csv_figures_post_clean():
    outcome, p = await _run_ar(_FakeDB(), tax_summary=AR_TAX_SUMMARY_AGREEING)
    assert outcome == "posted"


@pytest.mark.asyncio
async def test_a_disagreeing_csv_figure_parks_with_a_warning_instead_of_a_skip():
    db = _FakeDB()
    outcome, p = await _run_ar(db, tax_summary=AR_TAX_SUMMARY_DISAGREEING)

    assert outcome == "pending_review"
    p.post_gljv.assert_not_called()
    row = db.added[0]
    assert "warnings" in row.review_payload["flags"]
    warnings = row.review_payload["extracted"]["warnings"]
    assert len(warnings) == 1
    assert warnings[0]["code"] == "csvFeeMismatch"
    assert warnings[0]["params"] == {"csv": "999.00", "report": "300.00"}


# ── What stops it ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ar_switched_off_costs_nothing():
    """Switching reconciliation off is deactivating the rule — `match_rules` skips it before
    the charge, so the mail that keeps arriving costs nothing, and the BU sees it listed."""
    db = _FakeDB()
    outcome, p = await _run_ar(db, rules=[{**AR_RULE[0], "is_active": False}], carmen_result=None)

    assert outcome == "skipped"
    assert db.added[0].reason_code == "ingest_paused"
    p.consume_document.assert_not_called()
    p.extract.assert_not_called()


@pytest.mark.asyncio
async def test_a_settlement_rule_with_no_bank_costs_nothing():
    """`PUT /carmen/settings` refuses this; the pipeline still stops before the charge for
    a rule that got stored some other way. Since 2026-10-05 it stops one step earlier: a
    settlement report is read by the KBANK rule alone (`imap.match_rules`), so a bankless
    rule never claims the file at all."""
    db = _FakeDB()
    outcome, p = await _run_ar(db, rules=[{**AR_RULE[0], "bank_code": None}], carmen_result=None)

    assert outcome == "skipped"
    assert db.added[0].reason_code == "no_rule_match"
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
    # No AI suggestion on this path, unchanged by decision #3 — see the module-level
    # docstring and `email_ingest_service.py`'s own comment at this branch.
    p.suggest.assert_not_called()


@pytest.mark.asyncio
async def test_a_missing_fixed_debit_mapping_parks_instead_of_posting():
    """Decision #28: the three fixed debit legs (commission/tax/net) read the BU's
    existing credit-card mapping, not a mapping table of this feature's own — so a gap
    there is caught by the same `mapping_missing` flag the credit side uses, rather than a
    bespoke clearing-account flag (removed along with the control-leg concept). VS/MC/JCB
    stay fully mapped (via `AR_MAPS`) so the only gap is the fixed legs this test is
    about — `config=` is passed directly here rather than through `maps=`, since the
    debit dict needs an actual value (not `MAPPINGS`'s) for `commission`."""
    db = _FakeDB()
    outcome, p = await _run_ar(
        db, config=_config(mappings={"commission": AR_MAPS["VS"], **AR_MAPS})
    )

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
        post_type="Detail",
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
        open_side_effect=pipeline._Skip("wrong_pdf_password", "None of the saved passwords"),
    )

    assert outcome == "skipped"
    assert db.added[0].reason_code == "wrong_pdf_password"
    p.consume_document.assert_not_called()
    p.extract.assert_not_called()


# ── KBANK with the toggle off: the commission tax invoice, and its zip's CSV ─────
#
# 2026-10-05 (decision-log #37). The tax summary rides in the same zip whichever file the
# toggle reads, and on the tax invoice it runs the same two checks — its TIN into
# `foreign_tax_id`, its fee and VAT against the invoice's — minus `tin_unverified`: this
# document prints its own TIN, so a missing CSV costs it nothing.

KBANK_FEE_RULE = [{"bank_code": "KBANK", "is_active": True, "doc_type": "fee_invoice"}]
KBANK_FEE_FILE = "E-TAX_INVOICE_CARD_451005282039001_210726E00035291_20260721.PDF"


def _kbank_fee_invoice(**over):
    # No merchant on the page: the file's own name supplies it.
    return _extracted(
        bank_company_name="ธนาคารกสิกรไทย จำกัด (มหาชน)",
        bank_name=None,
        doc_no="210726E00035291",
        **over,
    )


def _csv(**over):
    row = {
        "tax_id": "0835553001610",
        "tax_invoice_no": "210726E00035291",
        "fee": "30.00",
        "vat": "2.10",
        # The settlement's net, not the invoice's total — never compared on this path.
        "net": "24,467.20",
    }
    return {"451005282039001": {**row, **over}}


async def _run_kbank_fee(db, **kw):
    kw.setdefault("extracted", _kbank_fee_invoice())
    kw.setdefault("config", _config())
    kw.setdefault("carmen_result", {"Code": 0, "InternalMessage": "JV-1"})
    return await _run(db, filename=KBANK_FEE_FILE, rules=KBANK_FEE_RULE, **kw)


@pytest.mark.asyncio
async def test_the_kbank_tax_invoice_feeds_its_csv_tin_into_the_existing_check():
    outcome, p = await _run_kbank_fee(_FakeDB(), tax_summary=_csv())

    assert outcome == "posted"
    assert "0835553001610" in p.foreign_tax_id.call_args.args[1]


@pytest.mark.asyncio
async def test_a_csv_disagreeing_with_the_tax_invoice_parks_it_with_a_warning():
    db = _FakeDB()
    outcome, p = await _run_kbank_fee(db, tax_summary=_csv(vat="9.99"))

    assert outcome == "pending_review"
    p.post_gljv.assert_not_called()
    warnings = db.added[0].review_payload["extracted"]["warnings"]
    assert [(w["code"], w["params"]) for w in warnings] == [
        ("csvVatMismatch", {"csv": "9.99", "report": "2.10"})
    ]


@pytest.mark.asyncio
async def test_a_kbank_tax_invoice_without_a_csv_posts_as_it_always_did():
    db = _FakeDB()
    outcome, _ = await _run_kbank_fee(db, tax_summary={})

    assert outcome == "posted"
