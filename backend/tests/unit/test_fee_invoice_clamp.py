"""
Unit tests for the fee-invoice normalizer + BAY tax fill in credit_card_service.

QA findings (CA-4): the LLM frequently swaps or omits the amount fields on the
fee-invoice formats (KTC Amount↔Net, GHL Net↔Commission, SiamPay commission/tax
missing) and misses BAY's VAT column — these are repaired deterministically from
arithmetic, not re-OCR'd.
"""

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow
from app.services.credit_card_service import (
    _normalize_bay_statement,
    _normalize_fee_invoice,
    _strip_noncard_rows,
)


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


def test_zero_vat_invoice_with_explicit_zero_tax():
    # Zero-rated / exempt fee invoice: grand == fee, VAT printed as 0 — must NOT
    # fabricate a 7% VAT out of the grand total.
    ext = _extracted(pay_amt="1,000.00", commis_amt="1,000.00", tax_amt="0.00")
    _normalize_fee_invoice(ext, "PAYPAL")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt) == ("1,000.00", "1,000.00", "0.00")


def test_zero_vat_invoice_with_blank_tax():
    # Same document but the LLM left the tax cell blank — grand == fee is the
    # structural signal that this is a zero-VAT invoice, not a missed 7%.
    ext = _extracted(pay_amt="1,000.00", commis_amt="1,000.00")
    _normalize_fee_invoice(ext, "PAYPAL")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt) == ("1,000.00", "1,000.00", "0.00")


def test_ten_percent_vat_passes_through_as_printed():
    # A reconciling document needs no rate assumption — 10% VAT is untouched.
    ext = _extracted(pay_amt="110.00", commis_amt="100.00", tax_amt="10.00")
    _normalize_fee_invoice(ext, "KTC")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt) == ("110.00", "100.00", "10.00")


def test_ten_percent_grand_and_vat_pair():
    # (grand, vat) at 10% — the single-rate disambiguation used to misread this
    # as (fee, vat) and fabricate grand = 120.00.
    ext = _extracted(pay_amt="110.00", tax_amt="10.00")
    _normalize_fee_invoice(ext, "KTC")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt) == ("110.00", "100.00", "10.00")


def test_inconsistent_triple_repairs_fee_from_grand_and_vat():
    # Middle value misread (4,000.00 instead of 4,407.76) — nothing reconciles,
    # so trust grand & vat and recompute the fee between them.
    ext = _extracted(pay_amt="4,716.31", commis_amt="4,000.00", tax_amt="308.55")
    _normalize_fee_invoice(ext, "KTC")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt) == ("4,716.31", "4,407.76", "308.55")


def test_four_distinct_values_finds_reconciling_triple():
    # Grand landed in Total (KTC swap) AND a spurious value polluted PayAmt —
    # the solver must find the (fee, vat) pair that actually reconciles to the
    # grand, not blindly trust position (which would pick the spurious value as VAT).
    ext = _extracted(pay_amt="50.00", commis_amt="4,407.76", tax_amt="308.55", total="4,716.31")
    _normalize_fee_invoice(ext, "KTC")
    r = _row(ext)
    assert (r.pay_amt, r.commis_amt, r.tax_amt, r.total) == (
        "4,716.31",
        "4,407.76",
        "308.55",
        "0",
    )


# ── BAY statement normalization (QA round 2 screenshot numbers) ───────────────


def _bay_extracted(rows: list[dict]) -> ExtractedCreditCardData:
    return ExtractedCreditCardData(details=[ExtractedDetailRow(**r) for r in rows])


_BAY_QA_ROWS = [
    {"transaction": "VISA", "pay_amt": "906.00", "commis_amt": "13.59"},
    {"transaction": "V-PLAT & INF", "pay_amt": "3,659.00", "commis_amt": "82.33"},
    {"transaction": "M-PREMIUM", "pay_amt": "112,576.00", "commis_amt": "2,532.96"},
]
# LLM grabbed the WHT column (78.87) as tax — the true VAT (184.02) is recovered
# from gross − commis − net on the summary line.
_BAY_QA_TOTAL = {
    "transaction": "TOTAL",
    "pay_amt": "117,141.00",
    "commis_amt": "2,628.88",
    "tax_amt": "78.87",
    "total": "114,328.10",
}


def test_bay_summary_row_consumed_and_vat_spread():
    ext = _bay_extracted([*_BAY_QA_ROWS, _BAY_QA_TOTAL])
    _normalize_bay_statement(ext)
    assert len(ext.details) == 3  # TOTAL removed
    assert [r.tax_amt for r in ext.details] == ["0.95", "5.76", "177.31"]  # Σ = 184.02
    assert [r.total for r in ext.details] == ["891.46", "3,570.91", "109,865.73"]  # Σ = 114,328.10


def test_bay_summary_detected_by_arithmetic_when_label_garbled():
    total = dict(_BAY_QA_TOTAL, transaction="ยอดสิ้น??")  # label misread
    ext = _bay_extracted([*_BAY_QA_ROWS, total])
    _normalize_bay_statement(ext)
    assert len(ext.details) == 3
    assert ext.details[-1].tax_amt == "177.31"


def test_bay_spread_sums_exactly_to_total_vat():
    ext = _bay_extracted([*_BAY_QA_ROWS, _BAY_QA_TOTAL])
    _normalize_bay_statement(ext)
    spread = sum(float((r.tax_amt or "0").replace(",", "")) for r in ext.details)
    assert round(spread, 2) == 184.02


def test_bay_no_summary_row_falls_back_to_row_arithmetic():
    ext = _bay_extracted(
        [
            {
                "transaction": "MSC",
                "pay_amt": "112,576.00",
                "commis_amt": "2,532.96",
                "total": "109,865.73",
            }
        ]
    )
    _normalize_bay_statement(ext)
    assert ext.details[0].tax_amt == "177.31"


def test_bay_existing_row_tax_untouched():
    ext = _bay_extracted(
        [
            {"transaction": "VISA", "pay_amt": "906.00", "commis_amt": "13.59", "tax_amt": "0.95"},
            _BAY_QA_TOTAL,
        ]
    )
    _normalize_bay_statement(ext)
    assert ext.details[0].tax_amt == "0.95"
    assert ext.details[0].total == "891.46"  # net still filled


def test_bay_mixed_prefilled_and_blank_rows_dont_double_count_vat():
    # QA regression: one row already has a (correct) tax_amt, the other two are
    # blank. total_vat (184.02) must be reduced by the pre-filled 0.95 before
    # being spread across the blank rows — not spread in full on top of it.
    rows = [
        {"transaction": "VISA", "pay_amt": "906.00", "commis_amt": "13.59", "tax_amt": "0.95"},
        {"transaction": "V-PLAT & INF", "pay_amt": "3,659.00", "commis_amt": "82.33"},
        {"transaction": "M-PREMIUM", "pay_amt": "112,576.00", "commis_amt": "2,532.96"},
        _BAY_QA_TOTAL,
    ]
    ext = _bay_extracted(rows)
    _normalize_bay_statement(ext)
    assert len(ext.details) == 3
    assert ext.details[0].tax_amt == "0.95"  # untouched
    spread = sum(float((r.tax_amt or "0").replace(",", "")) for r in ext.details)
    assert round(spread, 2) == 184.02  # not 184.02 + 0.95


# ── Unified fee-invoice shape: line rows + TOTAL summary row (real doc numbers) ──
# All 4 processors print N fee lines + a footer (Subtotal/VAT/Grand). The prompt
# emits the footer as a "TOTAL" summary row; the backend spreads its printed VAT
# across the lines (rate-agnostic) and drops the summary row.


def test_siampay_two_lines_footer_vat_spread():
    # Real SiamPay receipt RE2026-05269: Processing 6,171.52 + Transaction 15.00,
    # footer Subtotal 6,186.52 / VAT 433.06 / Total 6,619.58.
    ext = _bay_extracted(
        [
            {"transaction": "SiamPay Service - Processing Fee", "commis_amt": "6,171.52"},
            {"transaction": "SiamPay Service - Transaction Fee", "commis_amt": "15.00"},
            {
                "transaction": "TOTAL",
                "commis_amt": "6,186.52",
                "tax_amt": "433.06",
                "pay_amt": "6,619.58",
            },
        ]
    )
    _normalize_fee_invoice(ext, "SIAMPAY")
    assert len(ext.details) == 2  # summary row consumed
    assert (ext.details[0].commis_amt, ext.details[0].tax_amt, ext.details[0].pay_amt) == (
        "6,171.52",
        "432.01",
        "6,603.53",
    )
    assert (ext.details[1].commis_amt, ext.details[1].tax_amt, ext.details[1].pay_amt) == (
        "15.00",
        "1.05",
        "16.05",
    )
    assert sum(float(r.tax_amt.replace(",", "")) for r in ext.details) == 433.06


def test_ktc_single_line_plus_summary():
    # Real KTC S5-2569-05-01: one MDR line 4,407.76, footer VAT 308.55, grand 4,716.31.
    ext = _bay_extracted(
        [
            {"transaction": "ค่าบริการ Merchant Discount Rate (MDR)", "commis_amt": "4,407.76"},
            {
                "transaction": "TOTAL",
                "commis_amt": "4,407.76",
                "tax_amt": "308.55",
                "pay_amt": "4,716.31",
            },
        ]
    )
    _normalize_fee_invoice(ext, "KTC")
    assert len(ext.details) == 1
    assert (ext.details[0].pay_amt, ext.details[0].commis_amt, ext.details[0].tax_amt) == (
        "4,716.31",
        "4,407.76",
        "308.55",
    )


def test_ten_percent_vat_spread_is_rate_agnostic():
    # Hypothetical non-7% fee invoice — VAT must come from the footer (15.00),
    # NOT from 7% of the fees (which would be 10.50). Proves multi-rate support.
    ext = _bay_extracted(
        [
            {"transaction": "Fee A", "commis_amt": "100.00"},
            {"transaction": "Fee B", "commis_amt": "50.00"},
            {
                "transaction": "TOTAL",
                "commis_amt": "150.00",
                "tax_amt": "15.00",
                "pay_amt": "165.00",
            },
        ]
    )
    _normalize_fee_invoice(ext, "SIAMPAY")
    assert [r.tax_amt for r in ext.details] == ["10.00", "5.00"]  # 10% spread, not 7%
    assert sum(float(r.tax_amt) for r in ext.details) == 15.00


def test_summary_vat_derived_when_blank():
    # Footer VAT cell blank on the summary row → derive it from Grand − Subtotal.
    ext = _bay_extracted(
        [
            {"transaction": "MDR", "commis_amt": "4,407.76"},
            {"transaction": "TOTAL", "commis_amt": "4,407.76", "pay_amt": "4,716.31"},
        ]
    )
    _normalize_fee_invoice(ext, "KTC")
    assert ext.details[0].tax_amt == "308.55"


def test_summary_detected_by_arithmetic_when_label_garbled():
    ext = _bay_extracted(
        [
            {"transaction": "Processing", "commis_amt": "6,171.52"},
            {"transaction": "Transaction", "commis_amt": "15.00"},
            {
                "transaction": "???",
                "commis_amt": "6,186.52",
                "tax_amt": "433.06",
                "pay_amt": "6,619.58",
            },
        ]
    )
    _normalize_fee_invoice(ext, "SIAMPAY")
    assert len(ext.details) == 2
    assert sum(float(r.tax_amt.replace(",", "")) for r in ext.details) == 433.06


def test_legacy_single_row_without_summary_still_reconciles():
    # Backward compat: old prompt shape (one row carrying grand/fee/vat, no TOTAL
    # summary row) must still pass through via the per-row fallback.
    ext = _bay_extracted(
        [
            {
                "transaction": "Online Payment Services",
                "pay_amt": "370.47",
                "commis_amt": "346.23",
                "tax_amt": "24.24",
            },
        ]
    )
    _normalize_fee_invoice(ext, "PAYPAL")
    assert len(ext.details) == 1
    assert (ext.details[0].pay_amt, ext.details[0].commis_amt, ext.details[0].tax_amt) == (
        "370.47",
        "346.23",
        "24.24",
    )


# ── Plain statement banks (BBL/KBANK/SCB): strip leaked non-card rows ──────────


def test_strip_real_scb_zero_rows_total_wht_and_net_amount():
    # Real SCB ใบสรุปยอดขายบัตรเครดิต 262302202523 — the table lists ~40 card
    # types, most 0.00, then TOTAL / WITHHOLDING TAX / NET AMOUNT trailer lines.
    # Only the 4 rows with a real (non-zero) gross amount must survive.
    ext = _bay_extracted(
        [
            {
                "transaction": "VSA-DCC-P",
                "pay_amt": "0.00",
                "commis_amt": "0.00",
                "tax_amt": "0.00",
                "total": "0.00",
            },
            {
                "transaction": "VSA-INT-P",
                "pay_amt": "12,290.00",
                "commis_amt": "393.28",
                "tax_amt": "27.53",
                "total": "11,869.19",
            },
            {
                "transaction": "VSA-P",
                "pay_amt": "0.00",
                "commis_amt": "0.00",
                "tax_amt": "0.00",
                "total": "0.00",
            },
            {
                "transaction": "VSA-INT",
                "pay_amt": "4,400.00",
                "commis_amt": "114.40",
                "tax_amt": "8.01",
                "total": "4,277.59",
            },
            {
                "transaction": "MCA-INT-P",
                "pay_amt": "780.00",
                "commis_amt": "24.96",
                "tax_amt": "1.75",
                "total": "753.29",
            },
            {"transaction": "JCB", "pay_amt": "0.00", "commis_amt": "0.00"},
            {
                "transaction": "MCA-INT",
                "pay_amt": "480.00",
                "commis_amt": "12.48",
                "tax_amt": "0.87",
                "total": "466.65",
            },
            {
                "transaction": "TOTAL",
                "pay_amt": "17,950.00",
                "commis_amt": "545.12",
                "tax_amt": "38.16",
                "total": "17,366.72",
            },
            {"transaction": "WITHHOLDING TAX.", "total": "16.35"},
            {"transaction": "NET AMOUNT", "total": "17,366.72"},
        ]
    )
    _strip_noncard_rows(ext)
    assert [r.transaction for r in ext.details] == ["VSA-INT-P", "VSA-INT", "MCA-INT-P", "MCA-INT"]
    # Column sums are now the real totals, not double-counted / padded with zeros.
    assert sum(float(r.pay_amt.replace(",", "")) for r in ext.details) == 17950.00


def test_strip_handles_thai_wht_label():
    ext = _bay_extracted(
        [
            {"transaction": "Visa", "pay_amt": "500.00"},
            {"transaction": "ภาษีเงินได้หัก ณ ที่จ่าย", "total": "16.35"},
        ]
    )
    _strip_noncard_rows(ext)
    assert [r.transaction for r in ext.details] == ["Visa"]


def test_strip_keeps_normal_card_rows_when_no_noncard_row():
    ext = _bay_extracted(
        [
            {"transaction": "Visa", "pay_amt": "500.00"},
            {"transaction": "Master", "pay_amt": "300.00"},
        ]
    )
    _strip_noncard_rows(ext)
    assert len(ext.details) == 2  # nothing wrongly dropped
    # "Subtotal" is explicitly NOT treated as a summary row
    ext2 = _bay_extracted([{"transaction": "Subtotal Visa", "pay_amt": "500.00"}])
    _strip_noncard_rows(ext2)
    assert len(ext2.details) == 1
