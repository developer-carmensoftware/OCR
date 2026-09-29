"""kbank_tax_summary.parse — the TIN second-factor sidecar's own parser.

Real header and figures from TAX_SUMMARY_BY_TAX_ID_CSV_0835553001610_20260721.csv (the
sample zip's third file): one tax ID covering two merchant IDs (a hotel and its "-VCN"
sibling), plus a TOTAL row that must never be read as a merchant.
"""

from app.models.schemas.ocr import ExtractedDetailRow
from app.services.credit_card import kbank_tax_summary as k

HEADER = (
    "MERCHANT ID,TAX ID,ACCOUNT NO,TAX INVOICE NO,MERCHANT NAME (ENG),"
    "MERCHANT NAME (THAI),PROCESS DATE,TRANS. ITEM,CREDIT/DEBIT CARD AMOUNT,"
    "QR PAYMENT/PAYMENT LINK AMOUNT,TOTAL AMT,CREDIT/DEBIT CARD FEE/COMMISSION AMOUNT,"
    "QR PAYMENT/PAYMENT LINK FEE/COMMISSION AMOUNT,TOTAL FEE/COMMISSION AMOUNT,VAT 7%,"
    "DEBIT AMT,NET CREDIT AMT,W.H. TAX,VAT CODE"
)

# The two real merchant rows, then the real TOTAL row — quoted and padded exactly as
# KBank exports it (leading `'` text-cell marker, trailing spaces).
ROW_VCN = (
    '"\'401017745386001","\'0835553001610  ","xxx-x-x0078-x","\'210726E00022454    ",'
    '"THE YAMA HOTEL PHUKET-VCN","เดอะ ยามาโฮเทล ภูเก็ต         ","21/07/2026","    1",'
    '"         8244.80","            0.00","         8244.80","       272.08",'
    '"         0.00","       272.08","      19.05","          291.13","         7953.67",'
    '"            8.16","\'00000     "'
)
ROW_MAIN = (
    '"\'451005282039001","\'0835553001610  ","xxx-x-x0078-x","\'210726E00035291    ",'
    '"THE YAMA HOTEL PHUKET    ","บ.ปุรณาการ จก.                ","21/07/2026",'
    '"   22","        25091.00","            0.00","        25091.00","       582.99",'
    '"         0.00","       582.99","      40.81","          623.80","        24467.20",'
    '"           17.49","\'00000     "'
)
ROW_TOTAL = (
    '"TOTAL","","","","","","","        23","            33335.80","                0.00",'
    '"            33335.80","              855.07","                0.00","              855.07",'
    '"               59.86","              914.93","            32420.87","               25.65",""'
)

REAL_CSV = "\n".join([HEADER, ROW_VCN, ROW_MAIN, ROW_TOTAL]).encode("utf-8-sig")


def test_the_real_sample_yields_both_merchants_and_skips_total():
    out = k.parse(REAL_CSV)

    assert set(out) == {"401017745386001", "451005282039001"}
    assert out["451005282039001"] == {
        "tax_id": "0835553001610",
        "tax_invoice_no": "210726E00035291",
        "fee": "582.99",
        "vat": "40.81",
        "net": "24467.20",
        "wht": "17.49",
    }


def test_the_wht_figure_is_roughly_3pct_of_the_fee():
    """Cross-check only, not asserted anywhere in the JV: 3% of 582.99 ≈ 17.49."""
    row = k.parse(REAL_CSV)["451005282039001"]
    assert abs(float(row["wht"]) - round(float(row["fee"]) * 0.03, 2)) < 0.05


def test_leading_quote_and_padding_are_stripped():
    assert k.digits_only("'451005282039001") == "451005282039001"
    assert k.digits_only("'0835553001610  ") == "0835553001610"


def test_malformed_bytes_return_an_empty_map_rather_than_raising():
    """A sidecar that failed to parse costs nothing on its own — the settlement report
    still posts, just without this second factor (`tin_unverified` in the pipeline)."""
    assert k.parse(b"\xff\xfe\x00\x01not a csv at all") == {}
    assert k.parse(b"") == {}


def test_a_csv_with_no_merchant_id_column_yields_nothing_not_an_error():
    assert k.parse(b"A,B\n1,2\n") == {}


# ── cross_check (ticket 05) ─────────────────────────────────────────────────────

CSV_ROW = k.parse(REAL_CSV)["451005282039001"]
# Same figures, comma-formatted the way the report itself prints them — proves the
# comparison tolerates that formatting difference rather than a real disagreement.
MATCHING_TOTAL_ROW = ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="24,467.20")


def test_agreeing_figures_produce_no_warnings():
    out = k.cross_check(CSV_ROW, "210726E00035291", MATCHING_TOTAL_ROW)
    assert out == []


def test_one_disagreeing_figure_produces_exactly_one_warning_naming_both_numbers():
    total_row = ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="20,000.00")
    out = k.cross_check(CSV_ROW, "210726E00035291", total_row)

    assert len(out) == 1
    assert out[0].code == "csvNetMismatch"
    assert out[0].params == {"csv": "24,467.20", "report": "20,000.00"}


def test_a_two_satang_gap_is_not_a_mismatch():
    total_row = ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="24,467.21")
    assert k.cross_check(CSV_ROW, "210726E00035291", total_row) == []


def test_a_disagreeing_tax_invoice_number_is_its_own_warning():
    out = k.cross_check(CSV_ROW, "210726E00099999", MATCHING_TOTAL_ROW)

    assert len(out) == 1
    assert out[0].code == "csvTaxInvoiceMismatch"
    assert out[0].params == {"csv": "210726E00035291", "report": "210726E00099999"}


def test_a_missing_total_row_is_silent_not_a_warning():
    """No anchor row to compare against (`_normalize_ar_settlement` already warns about
    that on its own, via `settlementTotalMissing`) — this check has nothing to add."""
    assert k.cross_check(CSV_ROW, "210726E00035291", None) == []


def test_an_unparseable_report_figure_is_silent_not_a_warning():
    total_row = ExtractedDetailRow(commis_amt="582.99", tax_amt="40.81", total="—")
    assert k.cross_check(CSV_ROW, "210726E00035291", total_row) == []
