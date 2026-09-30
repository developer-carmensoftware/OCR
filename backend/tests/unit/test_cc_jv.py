"""
Unit tests for cc_jv.py — the Python twin of frontend/src/lib/ccJv.ts, used by
email automation (no browser, no human review) to build the same JV a wizard
user would build by hand. Cases mirror frontend/src/lib/ccJv.test.ts so the two
implementations stay provably in sync.
"""

import json
from datetime import datetime
from functools import partial
from pathlib import Path
from types import SimpleNamespace

from app.constants import PostType
from app.models.schemas.ocr import ExtractedDetailRow
from app.services.credit_card.jv import (
    BANK_SOURCE_MAP,
    build_gljv_payload,
    build_jv_rows,
    canonical_payment_type,
    group_key,
    is_balanced,
    render_description,
    render_jv_description,
    resolve_jv_description,
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


# ── Settlement report -- the `grouping=`/`total_row=` branch ---------------------
#
# Ported from tests/unit/test_ar_reconcile_jv.py (deleted 2026-09-22) when
# app/services/ar_reconcile_jv.py folded into this module -- decision #28's collapse
# made the two builders' shapes identical enough that they became one function with
# two optional keyword arguments rather than two functions. Figures are the real ones
# from KB1P554V2_SUM_451005282039001_20260721.pdf (settlement 21/07/2026, tax invoice
# 210726E00035291) rather than invented round numbers, because the thing most likely
# to break here is grouping a scheme label wrongly, and only real labels have the
# shape that catches it.
#
# Covers FRD QA matrix TC-REC-001 (Detail), TC-REC-002 (Summary) and TC-REC-005
# (template tag replacement).

AR_DOC_NO = "210726E00035291"

# SUMMARY MERCHANT ID block, page 3. Sum THB AMT = 25,091.00.
AR_SAMPLE = [
    ("VS INTER NON-PREM", "2,200.00"),
    ("VS INTER PREM", "3,251.00"),
    ("VS INTER UP PREM", "10,020.00"),
    ("MC INTER NON-PREM", "1,000.00"),
    ("MC INTER PREM", "5,945.00"),
    ("MC INTER UP PREM", "2,375.00"),
    ("JCB PREM", "300.00"),
]
AR_TOTAL = 25091.00

# The same block's own TOTAL BY MERCHANT ID row. COMM + VAT + NET == THB AMT above --
# the same self-consistency the real document has to pass before this module sees it.
AR_TOTAL_ROW = ExtractedDetailRow(
    transaction="TOTAL BY MERCHANT ID",
    pay_amt="25,091.00",
    commis_amt="582.99",
    tax_amt="40.81",
    total="24,467.20",
)


def _ar_rows(pairs=AR_SAMPLE):
    return [ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in pairs]


def _ar_mapping(keys, dept="GEN", acc="1021001"):
    return {k: {"dept": dept, "acc": acc} for k in keys}


def _ar_detail_mappings():
    return {
        "VS INTER NON-PREM": {"dept": "GEN", "acc": "1021001"},
        "VS INTER PREM": {"dept": "GEN", "acc": "1021001"},
        "VS INTER UP PREM": {"dept": "GEN", "acc": "1021001"},
        "MC INTER NON-PREM": {"dept": "GEN", "acc": "1021002"},
        "MC INTER PREM": {"dept": "GEN", "acc": "1021002"},
        "MC INTER UP PREM": {"dept": "GEN", "acc": "1021002"},
        "JCB PREM": {"dept": "GEN", "acc": "1021003"},
    }


def _ar_summary_mappings():
    return {
        "VS": {"dept": "GEN", "acc": "1021001"},
        "MC": {"dept": "GEN", "acc": "1021002"},
        "JCB": {"dept": "GEN", "acc": "1021003"},
    }


def _ar_cc_mappings(commission="5001", tax="5002", net="1010"):
    """The BU's existing credit-card commission/tax/net mapping -- the same dict the
    fee-invoice branch above reads, merged into the one `mappings` dict every real
    caller now passes (decision #3: no separate table for these three)."""
    return {
        "commission": {"dept": "GEN", "acc": commission},
        "tax": {"dept": "GEN", "acc": tax},
        "net": {"dept": "GEN", "acc": net},
    }


def _ar_build(post_type, credit_mappings, detail=None, total_row=AR_TOTAL_ROW, cc_maps=None):
    """`build_jv_rows` exercised with the merged single dict every real caller uses:
    commission/tax/net plus this post type's credit-side keys, looked up by one
    `mappings.get(key)` -- there is no separate `cc_mappings` parameter any more."""
    merged = {**(cc_maps if cc_maps is not None else _ar_cc_mappings()), **credit_mappings}
    return build_jv_rows(
        detail if detail is not None else _ar_rows(),
        merged,
        total_row=total_row,
        grouping=partial(group_key, post_type=post_type),
    )


# -- TC-REC-001: Detail ---------------------------------------------------------


def test_settlement_detail_posts_one_credit_per_printed_payment_type():
    out = _ar_build(PostType.DETAIL, _ar_detail_mappings())

    assert len(out) == 10, "3 fixed debit legs + 7 credits"
    debits, credits = out[-3:], out[:-3]
    assert [d["desc"] for d in debits] == ["Credit card commission", "Input Tax", "Bank Account"]
    assert [d["debit"] for d in debits] == [582.99, 40.81, 24467.20]
    assert all(d["credit"] == 0 for d in debits)
    assert [d["acc"] for d in debits] == ["5001", "5002", "1010"]
    # The payment type alone -- no `Tax Inv.# <doc_no> - ` prefix since 2026-09-29.
    assert [c["desc"] for c in credits] == [t for t, _ in AR_SAMPLE]
    assert is_balanced(out)
    assert sum(c["credit"] for c in credits) == AR_TOTAL
    assert sum(d["debit"] for d in debits) == AR_TOTAL


# -- TC-REC-002: Summary ---------------------------------------------------------


def test_settlement_summary_folds_schemes_onto_their_first_token():
    out = _ar_build(PostType.SUMMARY, _ar_summary_mappings())

    assert len(out) == 6, "3 fixed debit legs + VS + MC + JCB"
    by_key = {r["desc"]: r for r in out[:-3]}
    assert by_key["VS"]["credit"] == 15471.00  # 2,200 + 3,251 + 10,020
    assert by_key["MC"]["credit"] == 9320.00  # 1,000 + 5,945 + 2,375
    assert by_key["JCB"]["credit"] == 300.00
    assert sum(d["debit"] for d in out[-3:]) == AR_TOTAL
    assert is_balanced(out)


def test_settlement_leg_carries_the_group_it_posts_under():
    """The review pane joins printed lines to legs on `key`, not by parsing `desc`.

    `desc` is the posted wording, which is free to change without breaking the join
    (it carried a `Tax Inv.# ... - ` prefix until 2026-09-29). None of the three fixed debit legs belongs to a group and
    all three say so with an empty key -- same as the fee-invoice legs above.
    """
    detail = _ar_build(PostType.DETAIL, _ar_detail_mappings())
    assert [r["key"] for r in detail[-3:]] == ["", "", ""]
    assert [r["key"] for r in detail[:-3]] == [t for t, _ in AR_SAMPLE]

    summary = _ar_build(PostType.SUMMARY, _ar_summary_mappings())
    assert [r["key"] for r in summary[-3:]] == ["", "", ""]
    assert [r["key"] for r in summary[:-3]] == ["VS", "MC", "JCB"]

    # The join the browser performs, spelled out: a printed label is either the key
    # itself or the key plus a space and the rest of it. Nothing else has to be true.
    keys = {r["key"] for r in summary[:-3]}
    for label, _ in AR_SAMPLE:
        assert any(label == k or label.startswith(f"{k} ") for k in keys), label


def test_settlement_both_post_types_balance_to_the_same_total():
    detail = _ar_build(PostType.DETAIL, _ar_detail_mappings())
    summary = _ar_build(PostType.SUMMARY, _ar_summary_mappings())

    assert sum(r["credit"] for r in detail) == sum(r["credit"] for r in summary) == AR_TOTAL
    assert is_balanced(detail) and is_balanced(summary)


def test_group_key_leaves_detail_labels_alone():
    assert group_key("VS INTER UP PREM", PostType.DETAIL) == "VS INTER UP PREM"
    assert group_key("VS INTER UP PREM", PostType.SUMMARY) == "VS"
    assert group_key("JCB", PostType.SUMMARY) == "JCB"


# -- TC-REC-004: an unseen scheme parks instead of joining a group -------------


def test_settlement_new_scheme_becomes_its_own_unmapped_key():
    detail = _ar_rows([*AR_SAMPLE, ("AMEX PREM", "500.00")])

    summary_grouping = partial(group_key, post_type=PostType.SUMMARY)
    detail_grouping = partial(group_key, post_type=PostType.DETAIL)
    assert unmapped_payment_types(
        detail, {**_ar_cc_mappings(), **_ar_summary_mappings()}, grouping=summary_grouping
    ) == ["AMEX"]
    assert unmapped_payment_types(
        detail, {**_ar_cc_mappings(), **_ar_detail_mappings()}, grouping=detail_grouping
    ) == ["AMEX PREM"]
    assert (
        unmapped_payment_types(
            _ar_rows(), {**_ar_cc_mappings(), **_ar_detail_mappings()}, grouping=detail_grouping
        )
        == []
    )


def test_settlement_zero_amount_row_is_not_something_to_map():
    """It contributes nothing to the JV, so demanding an account for it would park a
    document over a line that was never going to post."""
    detail = _ar_rows([*AR_SAMPLE, ("AMEX PREM", "0.00")])
    grouping = partial(group_key, post_type=PostType.DETAIL)
    merged = {**_ar_cc_mappings(), **_ar_detail_mappings()}

    assert unmapped_payment_types(detail, merged, grouping=grouping) == []
    built = _ar_build(PostType.DETAIL, _ar_detail_mappings(), detail)
    assert "AMEX PREM" not in [r["desc"] for r in built]


def test_settlement_inactive_and_missing_accounts_both_read_as_unmapped():
    partial_map = dict(_ar_detail_mappings())
    partial_map["JCB PREM"] = {"dept": "GEN", "acc": ""}
    grouping = partial(group_key, post_type=PostType.DETAIL)

    assert unmapped_payment_types(
        _ar_rows(), {**_ar_cc_mappings(), **partial_map}, grouping=grouping
    ) == ["JCB PREM"]


def test_settlement_missing_fixed_debit_key_is_unmapped_regardless_of_amount():
    """Structural, not per-row, unlike the credit-side keys above: the three fixed
    legs are required even though nothing about `details` would suggest one needs a
    mapping -- the same unconditional check the fee-invoice tests above rely on,
    since this is now the same function."""
    incomplete = {
        "commission": {"dept": "GEN", "acc": "5001"},
        "tax": {},
        "net": {"dept": "GEN", "acc": "1010"},
    }
    grouping = partial(group_key, post_type=PostType.DETAIL)
    assert unmapped_payment_types(
        _ar_rows(), {**incomplete, **_ar_detail_mappings()}, grouping=grouping
    ) == ["tax"]
    assert unmapped_payment_types(_ar_rows(), _ar_detail_mappings(), grouping=grouping) == [
        "commission",
        "tax",
        "net",
    ]


# -- FRD Sec.8 case 5: refunds and chargebacks ------------------------------------
#
# The debit side does not derive from the credit rows (decision #28), so these
# fixtures supply a `total_row` whose three figures sum to whatever the synthetic
# detail rows below credit -- the same self-consistency a real document's own anchor
# row has to satisfy, just asserted by the test instead of by a printed page.


def test_settlement_negative_group_swaps_sides_and_still_balances():
    out = _ar_build(
        PostType.SUMMARY,
        _ar_summary_mappings(),
        detail=_ar_rows([("VS INTER PREM", "3,251.00"), ("MC INTER PREM", "-1,000.00")]),
        total_row=ExtractedDetailRow(total="2,251.00", commis_amt="0.00", tax_amt="0.00"),
    )

    by_key = {r["desc"]: r for r in out[:-3]}
    assert by_key["VS"]["credit"] == 3251.00 and by_key["VS"]["debit"] == 0
    assert by_key["MC"]["debit"] == 1000.00 and by_key["MC"]["credit"] == 0
    assert sum(d["debit"] for d in out[-3:]) == 2251.00  # net of the two groups
    assert is_balanced(out)


def test_settlement_lone_negative_group_still_posts_as_a_debit_leg():
    """The fixed debit legs never derive from the credit rows (decision #28), so a
    lone negative group debits on its own sign and nothing on the debit side answers
    it unless the report's own total row says the same thing -- `is_balanced` is the
    check that would catch a report whose total row disagrees with a refunded
    scheme."""
    out = _ar_build(
        PostType.SUMMARY,
        _ar_summary_mappings(),
        detail=_ar_rows([("VS INTER PREM", "-3,251.00")]),
        total_row=None,
    )

    assert out[0]["debit"] == 3251.00 and out[0]["credit"] == 0
    assert not is_balanced(out), "nothing on the debit side answers the refund"


# -- Degenerate input --------------------------------------------------------------


def test_settlement_document_with_no_amounts_produces_no_jv():
    assert _ar_build(PostType.DETAIL, _ar_detail_mappings(), detail=[]) == []
    zero_row = _ar_rows([("VS INTER PREM", "0.00")])
    assert _ar_build(PostType.DETAIL, _ar_detail_mappings(), detail=zero_row) == []


def test_settlement_unmapped_key_still_appears_in_the_rows_so_the_reviewer_can_see_it():
    out = _ar_build(PostType.SUMMARY, _ar_mapping(["VS"]))
    by_key = {r["desc"]: r for r in out[:-3]}

    assert by_key["MC"]["acc"] == "", "blank, not dropped -- the row is what gets mapped"
    assert is_balanced(out)


# -- TC-REC-005: description template ----------------------------------------------


def test_settlement_template_tags_are_replaced():
    out = render_jv_description(
        "Credit Card AR Reconcile {Settlement_Date}",
        settlement_date="21/07/2026",
        tax_invoice_no=AR_DOC_NO,
        bank_name="KBANK",
    )
    assert out == "Credit Card AR Reconcile 21/07/2026"


def test_settlement_every_tag_is_supported_and_unset_ones_collapse():
    assert (
        render_jv_description(
            "{Bank_Name} {Tax_Invoice_No} {Settlement_Date}",
            settlement_date="21/07/2026",
            tax_invoice_no=AR_DOC_NO,
            bank_name="KBANK",
        )
        == f"KBANK {AR_DOC_NO} 21/07/2026"
    )
    # An unset tag must not reach Carmen as literal "{Tax_Invoice_No}".
    assert (
        render_jv_description(
            "AR Reconcile {Tax_Invoice_No}",
            settlement_date=None,
            tax_invoice_no=None,
            bank_name=None,
        )
        == "AR Reconcile"
    )


# -- Ticket D (2026-09-22): one description mechanism, not two ---------------------
#
# `render_jv_description` used to be settlement-only; the fee-invoice path did its own
# plain `base - doc_date` concatenation inside `build_gljv_payload`. Both now go
# through `render_description`. Until 2026-09-30 a value with no tag had ` - doc_date`
# appended; now the saved text is the whole sentence and the date appears only where a
# `{Settlement_Date}` tag puts it.


def test_render_description_with_no_tag_posts_exactly_as_saved():
    assert (
        render_description("AR Recon", doc_date="21/07/2026", doc_no=AR_DOC_NO, bank_name="KBANK")
        == "AR Recon"
    )


def test_render_description_with_no_tag_and_no_date_is_just_the_base():
    assert render_description("AR Recon", doc_date=None, doc_no=None, bank_name=None) == "AR Recon"


def test_render_description_with_a_tag_is_treated_as_a_full_template():
    """The tag is the only way the date reaches the description, and it lands exactly
    where the BU put it."""
    out = render_description(
        "Credit Card AR Reconcile {Settlement_Date}",
        doc_date="21/07/2026",
        doc_no=AR_DOC_NO,
        bank_name="KBANK",
    )
    assert out == "Credit Card AR Reconcile 21/07/2026"


def test_render_description_empty_base_is_empty():
    assert (
        render_description(None, doc_date="21/07/2026", doc_no=AR_DOC_NO, bank_name="KBANK") == ""
    )
    assert render_description("", doc_date="21/07/2026", doc_no=AR_DOC_NO, bank_name="KBANK") == ""


def test_resolve_jv_description_reads_the_bank_scoped_config_entry():
    config = SimpleNamespace(description=None, bank_descriptions={"KBANK": "AR Recon"})
    assert (
        resolve_jv_description(config, "KBANK", doc_date="21/07/2026", doc_no=AR_DOC_NO)
        == "AR Recon"
    )


def test_build_gljv_payload_default_description_is_tag_aware():
    """The exact fallback `_ar_description` used to compute by hand before it was
    deleted (Ticket D) -- proof the merge did not change what a settlement JV posts,
    only where the wording comes from."""
    config = SimpleNamespace(
        file_prefix="IC",
        file_source="ACKB",
        description=None,
        bank_descriptions={"KBANK": "Credit Card AR Reconcile {Settlement_Date}"},
    )
    payload = build_gljv_payload(
        [
            {
                "dept": "GEN",
                "acc": "1021001",
                "desc": "VS",
                "debit": 0.0,
                "credit": 100.0,
                "key": "VS",
            }
        ],
        doc_date="21/07/2026",
        doc_no=AR_DOC_NO,
        bank_code="KBANK",
        config=config,
    )
    assert payload["Description"] == "Credit Card AR Reconcile 21/07/2026"


def test_build_gljv_payload_default_description_without_a_tag_has_no_date():
    """No auto date since 2026-09-30, deliberately not migrated: a description saved
    before then posts as saved until its BU inserts `{Settlement_Date}`."""
    config = SimpleNamespace(
        file_prefix="IC",
        file_source="ACBY",
        description="Credit Card Commission",
        bank_descriptions={},
    )
    payload = build_gljv_payload(
        [{"dept": "GEN", "acc": "1130V", "desc": "Visa", "debit": 0.0, "credit": 100.0, "key": ""}],
        doc_date="15/06/2026",
        doc_no="DOC-1",
        bank_code="BAY",
        config=config,
    )
    assert payload["Description"] == "Credit Card Commission"


def test_build_gljv_payload_an_explicit_description_overrides_the_default():
    config = SimpleNamespace(
        file_prefix="IC", file_source="ACKB", description=None, bank_descriptions={}
    )
    payload = build_gljv_payload(
        [],
        doc_date="21/07/2026",
        doc_no=AR_DOC_NO,
        bank_code="KBANK",
        config=config,
        description="Already rendered",
    )
    assert payload["Description"] == "Already rendered"


# -- total_row missing --------------------------------------------------------------
#
# `_normalize_ar_settlement` already warns when the anchor row cannot be found on the
# real document -- this is the arithmetic's own behaviour in that case, not a
# substitute for it.


def test_settlement_missing_total_row_posts_zero_on_every_debit_leg():
    out = _ar_build(PostType.DETAIL, _ar_detail_mappings(), total_row=None)

    assert [d["debit"] for d in out[-3:]] == [0.0, 0.0, 0.0]
    assert not is_balanced(out), "credits still post; debits do not -- a real imbalance"


# -- is_balanced is a real check now -----------------------------------------------
#
# Before 2026-09-18 the debit leg was derived from the sum of the very rows it was
# compared against, so this could never return False for the builder's own output
# (decision #28). The two sides are now independent readings of the same page and
# can disagree.


def test_settlement_is_balanced_catches_a_total_row_that_disagrees_with_the_grouped_rows():
    wrong_total = ExtractedDetailRow(commis_amt="1.00", tax_amt="1.00", total="1.00")
    out = _ar_build(PostType.DETAIL, _ar_detail_mappings(), total_row=wrong_total)

    assert not is_balanced(out)
