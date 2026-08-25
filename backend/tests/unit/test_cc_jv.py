"""
Unit tests for cc_jv.py — the Python twin of frontend/src/lib/ccJv.ts, used by
email automation (no browser, no human review) to build the same JV a wizard
user would build by hand. Cases mirror frontend/src/lib/ccJv.test.ts so the two
implementations stay provably in sync.
"""

import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from app.models.schemas.ocr import ExtractedDetailRow
from app.services.cc_jv import (
    BANK_SOURCE_MAP,
    build_gljv_payload,
    build_jv_rows,
    canonical_payment_type,
    unmapped_payment_types,
)

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


# ── Misread payment types (canonical_payment_type) ────────────────────────────
#
# The extractor drops Thai vowel/tone marks often enough that a type the BU
# mapped months ago arrives unrecognisable. Folding those away must never fold
# away a digit — this tenant really has two SiamPay lines one character apart.

THAI_CONFIG = {
    "commission": {"dept": "GEN", "acc": "5100"},
    "tax": {"dept": "GEN", "acc": "1150"},
    "net": {"dept": "GEN", "acc": "1010"},
    "ค่าบริการ Merchant Discount Rate (MDR)": {"dept": "GEN", "acc": "1021005"},
    "04-4100-03 SiamPay Service - Processing Fee": {"dept": "101", "acc": "1010003"},
    "04-4100-04 SiamPay Service - Transaction Fe": {"dept": "101", "acc": "1010004"},
}


def test_dropped_thai_vowel_marks_still_resolve_to_the_saved_mapping():
    # 'ค่าบริการ' read as 'คาบรการ' — mai ek and sara i lost.
    assert (
        canonical_payment_type("คาบรการ Merchant Discount Rate (MDR)", THAI_CONFIG)
        == "ค่าบริการ Merchant Discount Rate (MDR)"
    )


def test_spacing_and_case_noise_resolves_too():
    assert (
        canonical_payment_type("04-4100-03  siampay service - processing fee", THAI_CONFIG)
        == "04-4100-03 SiamPay Service - Processing Fee"
    )


def test_a_differing_digit_is_never_folded_away():
    # The two SiamPay types differ by one digit and map to different accounts.
    # Folding must keep them apart, so an unknown '-05' parks instead of posting
    # to '-04'.
    assert (
        canonical_payment_type("04-4100-05 SiamPay Service - Settlement Fee", THAI_CONFIG)
        == "04-4100-05 SiamPay Service - Settlement Fee"
    )


def test_new_type_differing_only_in_a_digit_parks_instead_of_borrowing_a_gl():
    """The case a similarity score gets wrong, which is why this is not fuzzy.

    'difflib.get_close_matches' scores this pair at 0.977 and would silently post
    a brand-new payment type to the '-03' account. Only the digit differs, and a
    digit is exactly what must never be forgiven on a money path.
    """
    probe = "04-4100-05 SiamPay Service - Processing Fee"
    assert canonical_payment_type(probe, THAI_CONFIG) == probe
    details = [_row(transaction=probe, pay_amt="100.00", commis_amt="3.00", tax_amt="0.21")]
    assert unmapped_payment_types(details, THAI_CONFIG) == [probe]


def test_misread_type_no_longer_parks_the_document():
    details = [
        _row(
            transaction="คาบรการ Merchant Discount Rate (MDR)",
            pay_amt="4716.31",
            commis_amt="4407.76",
            tax_amt="308.55",
            total="0",
        )
    ]
    assert unmapped_payment_types(details, THAI_CONFIG) == []
    rows = build_jv_rows(details, THAI_CONFIG)
    credit = next(r for r in rows if r["credit"])
    assert credit["acc"] == "1021005"
    # The BU's own wording reaches the JV, not the misread one.
    assert credit["desc"] == "ค่าบริการ Merchant Discount Rate (MDR)"


def test_genuinely_new_type_still_parks():
    details = [
        _row(
            transaction="Alipay", pay_amt="100.00", commis_amt="3.00", tax_amt="0.21", total="96.79"
        )
    ]
    assert unmapped_payment_types(details, THAI_CONFIG) == ["Alipay"]


# ── Cross-language contract ───────────────────────────────────────────────────
#
# Everything above pins the Python side against hand-written expectations. That was
# never enough: the wizard builds the same Carmen body in TypeScript
# (frontend/src/lib/ccJv.ts + hooks/credit-card/useOcrSubmission.ts), the module
# docstring says the two are "kept deliberately in step", and nothing checked that
# they were. A drift posts wrong money and no test goes red.
#
# contracts/cc-jv.contract.json is the shared source of truth.
# frontend/src/lib/ccJv.contract.test.ts asserts the other half against the same file.
# Change an expectation there and this fails too — that is the whole point.

CONTRACT = json.loads(
    (Path(__file__).parents[3] / "contracts" / "cc-jv.contract.json").read_text(encoding="utf-8")
)


def test_contract_bank_source_map_matches_fixture():
    """The code→source table is copied three times (here, constants/banks.ts, the
    fixture). Pin ours to the fixture; the TS test pins the other."""
    expected = {k: v for k, v in CONTRACT["bankSourceMap"].items() if not k.startswith("$")}
    assert BANK_SOURCE_MAP == expected


def _config(case: dict) -> SimpleNamespace:
    cfg = case["config"]
    return SimpleNamespace(
        file_prefix=cfg["filePrefix"],
        file_source=cfg["fileSource"],
        description=cfg["description"],
        bank_descriptions=cfg["bankDescriptions"],
    )


def test_contract_fixture():
    for case in CONTRACT["cases"]:
        # The TS builder takes fixed types and payment types as two dicts; ours takes
        # one merged dict. Merging here (rather than in the fixture) keeps that
        # difference visible instead of baking one side's shape into the shared file.
        mappings = {**case["mappings"], **case["paymentTypes"]}
        details = [
            ExtractedDetailRow(
                transaction=d["Transaction"],
                pay_amt=d["PayAmt"],
                commis_amt=d["CommisAmt"],
                tax_amt=d["TaxAmt"],
                total=d["Total"],
            )
            for d in case["details"]
        ]

        body = build_gljv_payload(
            build_jv_rows(details, mappings),
            doc_date=case["docDate"],
            bank_code=case["bankCode"],
            config=_config(case),
        )

        # JvhDate is compared as an instant: Python emits '+00:00' and JS '.000Z' for
        # the same moment, so a string compare would fail on a difference Carmen
        # does not see.
        assert datetime.fromisoformat(body.pop("JvhDate")) == datetime.fromisoformat(
            case["expectedJvhDateUtc"].replace("Z", "+00:00")
        ), f"{case['name']}: JvhDate"

        # Deliberately outside the shared contract — the field exists to tell a
        # machine-posted JV from a reviewed one, so the two sides MUST differ here.
        assert body.pop("UserModified") == "OCR-EMAIL", f"{case['name']}: UserModified"

        assert body == case["expected"], f"{case['name']}"
