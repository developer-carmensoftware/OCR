"""The settlement report's post-extraction checks.

This normalizer repairs nothing — every figure it needs is printed. What it does is
verify, and the thing it verifies against is the one danger this document carries: it is a
stack of subtotals of the same money (per terminal, per batch, per service, per merchant),
so a model that sums the wrong blocks produces a JV that posts the day's takings twice and
still balances perfectly.
"""

from app.models.schemas import ExtractedCreditCardData, ExtractedDetailRow
from app.services.credit_card_service import _normalize_ar_settlement

FILE = "KB1P554V2_SUM_451005282039001_20260721.pdf"
MERCHANT = "451005282039001"

# SUMMARY MERCHANT ID block, page 3 of the sample. Σ THB AMT = 25,091.00.
ROWS = [
    ("VS INTER NON-PREM", "2,200.00"),
    ("VS INTER PREM", "3,251.00"),
    ("VS INTER UP PREM", "10,020.00"),
    ("MC INTER NON-PREM", "1,000.00"),
    ("MC INTER PREM", "5,945.00"),
    ("MC INTER UP PREM", "2,375.00"),
    ("JCB PREM", "300.00"),
]


def make(
    rows=None,
    *,
    total="25,091.00",
    merchant=MERCHANT,
    anchor_label="TOTAL BY MERCHANT ID",
    commis="582.99",
    tax="40.81",
    net=None,
):
    details = [ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in (rows or ROWS)]
    if total is not None:
        details.append(
            ExtractedDetailRow(
                transaction=anchor_label,
                pay_amt=total,
                commis_amt=commis,
                tax_amt=tax,
                total=net,
            )
        )
    return ExtractedCreditCardData(
        doc_no="210726E00035291",
        doc_date="21/07/2026",
        merchant_id=merchant,
        details=details,
    )


def codes(doc):
    return [w.code for w in doc.warnings]


def test_clean_report_keeps_its_rows_and_says_nothing():
    doc = make()
    _normalize_ar_settlement(doc, FILE)

    assert len(doc.details) == 7, "the TOTAL row is consumed, never posted"
    assert [d.transaction for d in doc.details] == [t for t, _ in ROWS]
    assert codes(doc) == []

    # Consumed onto its own field, not just dropped — `cc_jv.build_jv_rows`'s grouping
    # branch reads its three debit legs from here (decision #28).
    assert doc.total_row is not None
    assert doc.total_row.transaction == "TOTAL BY MERCHANT ID"
    assert (doc.total_row.commis_amt, doc.total_row.tax_amt) == ("582.99", "40.81")


def test_rows_that_do_not_add_up_to_the_printed_total_are_flagged():
    """The whole reason the TOTAL row is asked for: a per-terminal block read as well as
    the merchant summary doubles the money and would otherwise post silently."""
    doubled = ROWS + [("VS INTER PREM", "3,251.00")]
    doc = make(doubled)
    _normalize_ar_settlement(doc, FILE)

    assert "reconMismatch" in codes(doc)
    params = next(w for w in doc.warnings if w.code == "reconMismatch").params
    assert params["printed"] == "25,091.00"
    assert params["lines"] == "28,342.00"
    assert params["gap"] == "3,251.00"


def test_a_satang_of_rounding_is_not_a_mismatch():
    doc = make(total="25,091.01")
    _normalize_ar_settlement(doc, FILE)
    assert codes(doc) == []


def test_a_report_with_no_readable_total_says_so_rather_than_trusting_the_rows():
    doc = make(total=None)
    _normalize_ar_settlement(doc, FILE)

    assert codes(doc) == ["settlementTotalMissing"]
    assert len(doc.details) == 7
    assert doc.total_row is None, "no anchor to build the debit legs from — the JV posts 0"


def test_merchant_in_the_filename_is_a_second_opinion_on_what_was_read():
    doc = make(merchant="451005189370001")
    _normalize_ar_settlement(doc, FILE)

    assert "merchantMismatch" in codes(doc)
    params = next(w for w in doc.warnings if w.code == "merchantMismatch").params
    assert params["file"] == MERCHANT and params["doc"] == "451005189370001"


def test_a_filename_that_carries_no_merchant_id_is_not_a_conflict():
    doc = make()
    _normalize_ar_settlement(doc, "forwarded settlement.pdf")
    assert codes(doc) == []


def test_zero_and_withholding_rows_are_dropped():
    doc = make([*ROWS, ("WHT 3%", "500.00"), ("AMEX PREM", "0.00")], total="25,091.00")
    _normalize_ar_settlement(doc, FILE)

    labels = [d.transaction for d in doc.details]
    assert "WHT 3%" not in labels and "AMEX PREM" not in labels
    assert codes(doc) == [], "dropping a WHT row must not itself look like a mismatch"


def test_a_leaked_block_total_earlier_in_the_array_is_not_the_anchor():
    """The MANDATORY FINAL ROW is always the last object the prompt asks for — an earlier
    "TOTAL"-shaped row (a TERMINAL or SERVICE block's own total leaking through) must not
    be picked up just because it matched first."""
    leaked = [("TOTAL BY TERMINAL ID", "600.00"), *ROWS]
    doc = make(leaked)
    _normalize_ar_settlement(doc, FILE)

    assert codes(doc) == []
    assert "TOTAL BY TERMINAL ID" not in [d.transaction for d in doc.details]


def test_an_anchor_without_merchant_wording_is_not_trusted():
    """The whole-block substitution this document is dangerous for: the model reads only
    a TERMINAL/SERVICE block and its own total, never reaching the merchant summary. Σ rows
    would equal that block's own total by construction, so only the exact wording — which
    the prompt now asks the model to copy verbatim — tells the two apart."""
    doc = make(anchor_label="TOTAL BY TERMINAL ID")
    _normalize_ar_settlement(doc, FILE)

    assert codes(doc) == ["settlementTotalMissing"]
    assert doc.total_row is None, "wrong wording is treated as no anchor at all"


def test_anchor_columns_that_do_not_add_up_are_flagged():
    """THB AMT = COMM + VAT + NET on the anchor row is the only per-line identity this
    layout has — every detail row leaves VAT/NET dashed. 582.99 + 40.81 + 23,000.00 =
    23,623.80, not the printed 25,091.00."""
    doc = make(net="23,000.00")
    _normalize_ar_settlement(doc, FILE)

    assert "reconMismatch" in codes(doc)
    params = next(w for w in doc.warnings if w.code == "reconMismatch").params
    assert params["printed"] == "25,091.00"
    assert params["lines"] == "23,623.80"


def test_anchor_columns_left_dashed_stay_silent():
    """A bank whose settlement layout does not print COMM/VAT/NET on the total row must
    not be flagged for it — `net` (NET AMT) unset here, as every existing fixture leaves
    it, is exactly that shape."""
    doc = make()
    _normalize_ar_settlement(doc, FILE)
    assert codes(doc) == []
