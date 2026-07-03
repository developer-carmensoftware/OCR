"""
Unit tests for the fee-invoice normalizer + BAY tax fill in credit_card_service.

QA findings (CA-4): the LLM frequently swaps or omits the amount fields on the
fee-invoice formats (KTC Amount↔Net, GHL Net↔Commission, SiamPay commission/tax
missing) and misses BAY's VAT column — these are repaired deterministically from
arithmetic, not re-OCR'd.
"""

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow
from app.services.credit_card_service import _fill_bay_missing_tax, _normalize_fee_invoice


def _extracted(**row_kwargs) -> ExtractedCreditCardData:
    return ExtractedCreditCardData(
        merchant_id=row_kwargs.pop("merchant_id", "M-123"),
        details=[ExtractedDetailRow(transaction="fee", **row_kwargs)],
    )


def _row(ext: ExtractedCreditCardData) -> ExtractedDetailRow:
    return ext.details[0]


def test_correct_extraction_passes_through():
    ext = _extracted(pay_amt="4,716.31", commis_amt="4,407.76", tax_amt="308.55", total="0")
    _normalize_fee_invoice(ext, "KTC")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt, r.total) == ("4,716.31", "4,407.76", "308.55", "0")
    assert ext.merchant_id is None


def test_ktc_amount_and_net_swapped():
    # QA: grand total landed in Total, nothing in PayAmt
    ext = _extracted(total="4,716.31", commis_amt="4,407.76", tax_amt="308.55")
    _normalize_fee_invoice(ext, "KTC")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt, r.total) == ("4,716.31", "4,407.76", "308.55", "0")


def test_ghl_net_and_commission_swapped():
    # QA: fee landed in Total, grand in CommisAmt
    ext = _extracted(commis_amt="39,653.73", tax_amt="2,594.17", total="37,059.56")
    _normalize_fee_invoice(ext, "GHL")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt, r.total) == (
        "39,653.73",
        "37,059.56",
        "2,594.17",
        "0",
    )


def test_siampay_only_line_fee_present():
    # QA: commission/tax missing — per-line layout emits only commis_amt
    ext = _extracted(commis_amt="6,171.52")
    _normalize_fee_invoice(ext, "SIAMPAY")
    r = _row(ext)
    assert r.commis_amt == "6,171.52"
    assert r.tax_amt == "432.01"  # 7% VAT
    assert r.pay_amt == "6,603.53"
    assert r.total == "0"


def test_only_grand_total_present():
    ext = _extracted(pay_amt="370.47")
    _normalize_fee_invoice(ext, "PAYPAL")
    r = _row(ext)
    assert r.tax_amt == "24.24"  # 370.47 * 7/107
    assert r.commis_amt == "346.23"
    assert r.pay_amt == "370.47"


def test_grand_and_vat_pair():
    ext = _extracted(pay_amt="370.47", tax_amt="24.24")
    _normalize_fee_invoice(ext, "PAYPAL")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt) == ("370.47", "346.23", "24.24")


def test_fee_and_vat_pair_reconstructs_grand():
    ext = _extracted(commis_amt="4,407.76", tax_amt="308.55")
    _normalize_fee_invoice(ext, "KTC")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt) == ("4,716.31", "4,407.76", "308.55")


def test_paypal_keeps_customer_id_as_merchant_id():
    ext = _extracted(pay_amt="370.47", merchant_id="8C45WPKBSFA86")
    _normalize_fee_invoice(ext, "PAYPAL")
    assert ext.merchant_id == "8C45WPKBSFA86"


def test_bay_missing_tax_computed_from_row_arithmetic():
    # QA: BAY VAT column unread — tax = gross − commis − net
    ext = _extracted(pay_amt="112,576.00", commis_amt="2,532.96", tax_amt=None, total="109,865.73")
    _fill_bay_missing_tax(ext)
    assert _row(ext).tax_amt == "177.31"


def test_bay_existing_tax_untouched():
    ext = _extracted(pay_amt="906.00", commis_amt="13.59", tax_amt="0.95", total="891.46")
    _fill_bay_missing_tax(ext)
    assert _row(ext).tax_amt == "0.95"


def test_bay_negative_result_not_written():
    ext = _extracted(pay_amt="100.00", commis_amt="10.00", tax_amt=None, total="95.00")
    _fill_bay_missing_tax(ext)
    assert _row(ext).tax_amt is None
