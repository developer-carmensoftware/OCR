"""kbank_settlement_text.parse — the deterministic reader for KB1P554V2 (ticket 08).

`_fixture_pdf()` builds a page in memory with the same structural quirks the real
settlement report has (verified 2026-09-18 against the customer's own sample, see
decision #28): the column-header row lands after its data rows in insertion order but
above them visually, and the TOTAL BY MERCHANT ID row's NET AMT figure is inserted as
its own call — landing on the same printed row but forcing the same cross-block
y-bucketing the real report's PDF generator produces. The money figures are the real
worked example's own (25,091.00 / 582.99 / 40.81 / 24,467.20, and each payment type's
own THB AMT) — that is what proves this parser reads a real report faithfully. Only
the merchant's identity (name, ID, account number, tax invoice number) is fake: this
file is committed to the repo, the customer's is not.
"""

import fitz

from app.services import kbank_settlement_text as k

FAKE_MERCHANT_ID = "999999999999999"
FAKE_MERCHANT_NAME = "TEST MERCHANT COMPANY LTD"
FAKE_TAX_INVOICE_NO = "210101E00000001"

# transaction, THB AMT — the real report's own 7 rows (2026-09-18 sample), Σ = 25,091.00.
_ROWS = (
    ("VS INTER NON-PREM", "2,200.00"),
    ("VS INTER PREM", "3,251.00"),
    ("VS INTER UP PREM", "10,020.00"),
    ("MC INTER NON-PREM", "1,000.00"),
    ("MC INTER PREM", "5,945.00"),
    ("MC INTER UP PREM", "2,375.00"),
    ("JCB PREM", "300.00"),
)


def _fixture_pdf(
    *,
    report_no: str = "KB1P554V2",
    rows: tuple[tuple[str, str], ...] = _ROWS,
    total: tuple[str, str, str, str] | None = ("22", "25,091.00", "582.99", "40.81"),
    net_amt: str | None = "24,467.20",
    tax_invoice_no: str | None = FAKE_TAX_INVOICE_NO,
) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((20, 40), f"REPORT NO. : {report_no}")
    page.insert_text((20, 55), "SETTLEMENT DATE : 21/07/2026")
    # A per-terminal block above the summary — must never be read as the merchant row.
    page.insert_text((20, 90), "MERCHANT ID : 000000000000001 ACCOUNT NO : xxx-x-xTEST-x")
    page.insert_text((20, 105), "TERMINAL ID : T001")
    page.insert_text((20, 130), f"SUMMARY MERCHANT ID : {FAKE_MERCHANT_ID} {FAKE_MERCHANT_NAME}")

    y = 200
    for label, amt in rows:
        page.insert_text((20, y), f"{label} 2 {amt} 1.800% PERCENTAGE 39.60 - -")
        y += 12

    # Inserted last (after every data row) but placed above them — content order
    # disagrees with visual order here, same as the real report.
    page.insert_text(
        (20, 185),
        "PAYMENT TYPE NO TXN THB AMT COMM RATE RATE TYPE COMM AMT VAT AMT NET AMT",
    )

    if total is not None:
        no_txn, pay_amt, commis_amt, tax_amt = total
        page.insert_text(
            (20, y + 18), f"TOTAL BY MERCHANT ID {no_txn} {pay_amt} {commis_amt} {tax_amt}"
        )
        if net_amt is not None:
            # Far right, like the real NET AMT column — and at a slightly different y,
            # like the real report's own separate content block for this figure.
            page.insert_text((400, y + 18.3), net_amt)

    if tax_invoice_no is not None:
        page.insert_text((20, y + 50), f"TAX INVOICE NUMBER : {tax_invoice_no}")

    buf = doc.tobytes()
    doc.close()
    return buf


def test_parses_the_full_layout_with_scrubbed_identity():
    result = k.parse(_fixture_pdf())

    assert result is not None
    assert result.doc_no == FAKE_TAX_INVOICE_NO
    assert result.doc_date == "21/07/2026"
    assert result.merchant_id == FAKE_MERCHANT_ID
    assert result.merchant_name == FAKE_MERCHANT_NAME
    assert result.company_name == FAKE_MERCHANT_NAME
    assert result.bank_code == "KBANK"
    assert result.bank_company_name == "KASIKORNBANK"
    assert result.doc_name == "SALE TRANSACTION REPORT"

    assert len(result.details) == 8, "7 payment types + the TOTAL BY MERCHANT ID anchor"
    for (label, amt), row in zip(_ROWS, result.details[:7]):
        assert row.transaction == label
        assert row.pay_amt == amt

    anchor = result.details[-1]
    assert anchor.transaction == "TOTAL BY MERCHANT ID"
    assert anchor.pay_amt == "25,091.00"
    assert anchor.commis_amt == "582.99"
    assert anchor.tax_amt == "40.81"
    assert anchor.total == "24,467.20"


def test_survives_the_real_normalizer_unchanged():
    """The whole point of matching the vision prompt's own output shape: this parser's
    result needs no special-casing downstream. `_normalize_ar_settlement` finds the
    anchor, verifies Σ THB AMT and COMM+VAT+NET against it, and raises no warning."""
    from app.services.credit_card_service import _normalize_ar_settlement

    result = k.parse(_fixture_pdf())
    _normalize_ar_settlement(result, "KB1P554V2_SUM_999999999999999_20260721.pdf")

    assert result.warnings == []
    assert result.total_row is not None
    assert result.total_row.total == "24,467.20"
    assert len(result.details) == 7


def test_a_future_report_version_returns_none_not_a_guess():
    """Decision #28's own known risk: a version bump must fall back to vision, not
    silently misread a page this parser was never taught."""
    assert k.parse(_fixture_pdf(report_no="KB1P554V3")) is None


def test_a_missing_net_amt_returns_none_rather_than_a_partial_anchor():
    assert k.parse(_fixture_pdf(net_amt=None)) is None


def test_no_total_row_at_all_returns_none():
    assert k.parse(_fixture_pdf(total=None)) is None


def test_no_tax_invoice_number_returns_none():
    assert k.parse(_fixture_pdf(tax_invoice_no=None)) is None


def test_a_terminal_block_merchant_id_is_never_mistaken_for_the_summary_one():
    """The fixture's own per-terminal row (`000000000000001`) sits above the summary
    block; only `SUMMARY MERCHANT ID`'s value belongs on the document."""
    result = k.parse(_fixture_pdf())
    assert result is not None
    assert result.merchant_id == FAKE_MERCHANT_ID
    assert result.merchant_id != "000000000000001"


def test_an_encrypted_pdf_returns_none():
    doc = fitz.open()
    doc.new_page()
    buf = doc.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret")
    doc.close()
    assert k.parse(buf) is None


def test_malformed_bytes_return_none_not_raise():
    assert k.parse(b"not a pdf at all") is None
    assert k.parse(b"") is None
