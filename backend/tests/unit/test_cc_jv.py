"""
Unit tests for cc_jv.py — the Python twin of frontend/src/lib/ccJv.ts, used by
email automation (no browser, no human review) to build the same JV a wizard
user would build by hand. Cases mirror frontend/src/lib/ccJv.test.ts so the two
implementations stay provably in sync.
"""

from app.models.schemas.ocr import ExtractedDetailRow
from app.services.cc_jv import build_jv_rows, unmapped_payment_types

CONFIG = {
    "commission": {"dept": "GEN", "acc": "5100"},
    "tax": {"dept": "GEN", "acc": "1150"},
    "net": {"dept": "GEN", "acc": "1010"},
    "Visa": {"dept": "GEN", "acc": "1130V"},
    "MasterCard": {"dept": "GEN", "acc": "1130M"},
    "JCB": {"dept": "GEN", "acc": "1130J"},
}


def _row(**kw) -> ExtractedDetailRow:
    return ExtractedDetailRow(**kw)


def _sum(rows, side):
    return round(sum(r[side] for r in rows), 2)


def test_consolidated_one_debit_leg_per_account_credit_per_payment_type():
    details = [
        _row(
            transaction="Visa",
            pay_amt="1000.00",
            commis_amt="30.00",
            tax_amt="2.10",
            total="967.90",
        ),
        _row(
            transaction="MasterCard",
            pay_amt="500.00",
            commis_amt="15.00",
            tax_amt="1.05",
            total="483.95",
        ),
        _row(
            transaction="JCB", pay_amt="300.00", commis_amt="9.00", tax_amt="0.63", total="290.37"
        ),
    ]
    rows = build_jv_rows(details, CONFIG)

    credits = [r for r in rows if r["credit"] > 0]
    debits = [r for r in rows if r["debit"] > 0]
    assert len(credits) == 3
    assert len(debits) == 3

    by_desc = {r["desc"]: r for r in debits}
    assert by_desc["Credit card commission"]["debit"] == 54.0
    assert by_desc["Input Tax"]["debit"] == 3.78
    assert by_desc["Bank Account"]["debit"] == 1742.22

    assert _sum(rows, "debit") == _sum(rows, "credit")
    assert _sum(rows, "credit") == 1800.0


def test_gateway_fee_invoice_zero_total_keeps_standard_three_debit_legs():
    details = [
        _row(
            transaction="MDR Fee", pay_amt="107.00", commis_amt="100.00", tax_amt="7.00", total="0"
        ),
        _row(transaction="Txn Fee", pay_amt="53.50", commis_amt="50.00", tax_amt="3.50", total="0"),
    ]
    fee_config = {
        **{k: CONFIG[k] for k in ("commission", "tax", "net")},
        "MDR Fee": {"dept": "GEN", "acc": "2100"},
        "Txn Fee": {"dept": "GEN", "acc": "2100"},
    }
    rows = build_jv_rows(details, fee_config)

    debit_descs = [r["desc"] for r in rows if r["credit"] == 0]
    assert debit_descs == ["Credit card commission", "Input Tax", "Bank Account"]
    bank = next(r for r in rows if r["desc"] == "Bank Account")
    assert bank["debit"] == 0
    assert next(r for r in rows if r["desc"] == "Credit card commission")["debit"] == 150.0
    assert _sum(rows, "debit") == _sum(rows, "credit")


def test_empty_or_blank_details_emit_no_rows():
    assert build_jv_rows([], CONFIG) == []
    blank = [_row(transaction="", pay_amt="", commis_amt="", tax_amt="", total="")]
    assert build_jv_rows(blank, CONFIG) == []


def test_unmapped_payment_types_flags_missing_dept_or_acc():
    details = [
        _row(transaction="Amex", pay_amt="100.00", commis_amt="3.00", tax_amt="0.21", total="96.79")
    ]
    missing = unmapped_payment_types(details, CONFIG)
    assert missing == ["Amex"]  # Amex has no entry; commission/tax/net are mapped


def test_unmapped_payment_types_flags_missing_fixed_buckets():
    details = [
        _row(transaction="Visa", pay_amt="100.00", commis_amt="3.00", tax_amt="0.21", total="96.79")
    ]
    config = {"Visa": CONFIG["Visa"]}  # commission/tax/net never mapped
    missing = unmapped_payment_types(details, config)
    assert set(missing) == {"commission", "tax", "net"}


def test_unmapped_payment_types_empty_when_everything_is_mapped():
    details = [
        _row(transaction="Visa", pay_amt="100.00", commis_amt="3.00", tax_amt="0.21", total="96.79")
    ]
    assert unmapped_payment_types(details, CONFIG) == []
