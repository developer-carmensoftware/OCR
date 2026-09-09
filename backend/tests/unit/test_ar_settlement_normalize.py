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


def make(rows=None, *, total="25,091.00", merchant=MERCHANT):
    details = [ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in (rows or ROWS)]
    if total is not None:
        details.append(
            ExtractedDetailRow(
                transaction="TOTAL", pay_amt=total, commis_amt="582.99", tax_amt="40.81"
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
