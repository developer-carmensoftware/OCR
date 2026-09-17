"""AR-reconciliation JV arithmetic.

Figures are the real ones from KB1P554V2_SUM_451005282039001_20260721.pdf (settlement
21/07/2026, tax invoice 210726E00035291) rather than invented round numbers, because the
thing most likely to break here is grouping a scheme label wrongly, and only real labels
have the shape that catches it.

Covers FRD QA matrix TC-REC-001 (Detail), TC-REC-002 (Summary) and TC-REC-005 (template
tag replacement).
"""

from app.constants import PostType
from app.models.schemas import ExtractedDetailRow
from app.services.ar_reconcile_jv import (
    build_ar_jv_rows,
    control_leg_missing,
    group_key,
    is_balanced,
    render_jv_description,
    unmapped_ar_types,
)

DOC_NO = "210726E00035291"

# SUMMARY MERCHANT ID block, page 3. Σ THB AMT = 25,091.00.
SAMPLE = [
    ("VS INTER NON-PREM", "2,200.00"),
    ("VS INTER PREM", "3,251.00"),
    ("VS INTER UP PREM", "10,020.00"),
    ("MC INTER NON-PREM", "1,000.00"),
    ("MC INTER PREM", "5,945.00"),
    ("MC INTER UP PREM", "2,375.00"),
    ("JCB PREM", "300.00"),
]
TOTAL = 25091.00


def rows(pairs=SAMPLE):
    return [ExtractedDetailRow(transaction=t, pay_amt=a) for t, a in pairs]


def mapping(keys, dept="GEN", acc="1021001"):
    return {k: {"dept": dept, "acc": acc} for k in keys}


def detail_mappings():
    return {
        "VS INTER NON-PREM": {"dept": "GEN", "acc": "1021001"},
        "VS INTER PREM": {"dept": "GEN", "acc": "1021001"},
        "VS INTER UP PREM": {"dept": "GEN", "acc": "1021001"},
        "MC INTER NON-PREM": {"dept": "GEN", "acc": "1021002"},
        "MC INTER PREM": {"dept": "GEN", "acc": "1021002"},
        "MC INTER UP PREM": {"dept": "GEN", "acc": "1021002"},
        "JCB PREM": {"dept": "GEN", "acc": "1021003"},
    }


def summary_mappings():
    return {
        "VS": {"dept": "GEN", "acc": "1021001"},
        "MC": {"dept": "GEN", "acc": "1021002"},
        "JCB": {"dept": "GEN", "acc": "1021003"},
    }


def build(post_type, mappings, detail=None):
    return build_ar_jv_rows(
        detail if detail is not None else rows(),
        post_type=post_type,
        debit_dept="GEN",
        debit_acc="1021000",
        mappings=mappings,
        doc_no=DOC_NO,
    )


# ── TC-REC-001: Detail ────────────────────────────────────────────────────────


def test_detail_posts_one_credit_per_printed_payment_type():
    out = build(PostType.DETAIL, detail_mappings())

    assert len(out) == 8, "1 debit + 7 credits"
    debit, credits = out[0], out[1:]
    assert debit["debit"] == TOTAL and debit["credit"] == 0
    assert debit["acc"] == "1021000"
    assert [c["desc"] for c in credits] == [f"Tax Inv.# {DOC_NO} - {t}" for t, _ in SAMPLE]
    assert is_balanced(out)
    assert sum(c["credit"] for c in credits) == TOTAL


# ── TC-REC-002: Summary ───────────────────────────────────────────────────────


def test_summary_folds_schemes_onto_their_first_token():
    out = build(PostType.SUMMARY, summary_mappings())

    assert len(out) == 4, "1 debit + VS + MC + JCB"
    by_key = {r["desc"].rsplit(" - ", 1)[1]: r for r in out[1:]}
    assert by_key["VS"]["credit"] == 15471.00  # 2,200 + 3,251 + 10,020
    assert by_key["MC"]["credit"] == 9320.00  # 1,000 + 5,945 + 2,375
    assert by_key["JCB"]["credit"] == 300.00
    assert out[0]["debit"] == TOTAL
    assert is_balanced(out)


def test_every_leg_carries_the_group_it_posts_under():
    """The review pane joins printed lines to legs on `key`, not by parsing `desc`.

    `desc` carries the same text behind a `Tax Inv.# … - ` prefix that only exists when the
    document has a number, so slicing it back off would be a second, weaker copy of the
    grouping. The counterpart leg belongs to no group and says so with an empty key.
    """
    detail = build(PostType.DETAIL, detail_mappings())
    assert detail[0]["key"] == ""
    assert [r["key"] for r in detail[1:]] == [t for t, _ in SAMPLE]

    summary = build(PostType.SUMMARY, summary_mappings())
    assert summary[0]["key"] == ""
    assert [r["key"] for r in summary[1:]] == ["VS", "MC", "JCB"]

    # The join the browser performs, spelled out: a printed label is either the key itself
    # or the key plus a space and the rest of it. Nothing else has to be true.
    keys = {r["key"] for r in summary[1:]}
    for label, _ in SAMPLE:
        assert any(label == k or label.startswith(f"{k} ") for k in keys), label


def test_both_post_types_balance_to_the_same_total():
    detail = build(PostType.DETAIL, detail_mappings())
    summary = build(PostType.SUMMARY, summary_mappings())

    assert sum(r["credit"] for r in detail) == sum(r["credit"] for r in summary) == TOTAL
    assert is_balanced(detail) and is_balanced(summary)


def test_group_key_leaves_detail_labels_alone():
    assert group_key("VS INTER UP PREM", PostType.DETAIL) == "VS INTER UP PREM"
    assert group_key("VS INTER UP PREM", PostType.SUMMARY) == "VS"
    assert group_key("JCB", PostType.SUMMARY) == "JCB"


# ── TC-REC-004: an unseen scheme parks instead of joining a group ─────────────


def test_new_scheme_becomes_its_own_unmapped_key():
    detail = rows([*SAMPLE, ("AMEX PREM", "500.00")])

    assert unmapped_ar_types(detail, summary_mappings(), PostType.SUMMARY) == ["AMEX"]
    assert unmapped_ar_types(detail, detail_mappings(), PostType.DETAIL) == ["AMEX PREM"]
    assert unmapped_ar_types(rows(), detail_mappings(), PostType.DETAIL) == []


def test_a_zero_amount_row_is_not_something_to_map():
    """It contributes nothing to the JV, so demanding an account for it would park a
    document over a line that was never going to post."""
    detail = rows([*SAMPLE, ("AMEX PREM", "0.00")])

    assert unmapped_ar_types(detail, detail_mappings(), PostType.DETAIL) == []
    assert "AMEX PREM" not in [r["desc"] for r in build(PostType.DETAIL, detail_mappings(), detail)]


def test_inactive_and_missing_accounts_both_read_as_unmapped():
    partial = dict(detail_mappings())
    partial["JCB PREM"] = {"dept": "GEN", "acc": ""}

    assert unmapped_ar_types(rows(), partial, PostType.DETAIL) == ["JCB PREM"]


# ── FRD §8 case 5: refunds and chargebacks ────────────────────────────────────


def test_negative_group_swaps_sides_and_still_balances():
    out = build(
        PostType.SUMMARY,
        summary_mappings(),
        detail=rows([("VS INTER PREM", "3,251.00"), ("MC INTER PREM", "-1,000.00")]),
    )

    by_key = {r["desc"].rsplit(" - ", 1)[1]: r for r in out[1:]}
    assert by_key["VS"]["credit"] == 3251.00 and by_key["VS"]["debit"] == 0
    assert by_key["MC"]["debit"] == 1000.00 and by_key["MC"]["credit"] == 0
    assert out[0]["debit"] == 2251.00  # net of the two
    assert is_balanced(out)


def test_report_that_nets_negative_reverses_as_a_whole():
    out = build(
        PostType.SUMMARY,
        summary_mappings(),
        detail=rows([("VS INTER PREM", "-3,251.00")]),
    )

    assert out[0]["credit"] == 3251.00 and out[0]["debit"] == 0
    assert out[1]["debit"] == 3251.00
    assert is_balanced(out)


# ── Degenerate input ──────────────────────────────────────────────────────────


def test_document_with_no_amounts_produces_no_jv():
    assert build(PostType.DETAIL, detail_mappings(), detail=[]) == []
    assert build(PostType.DETAIL, detail_mappings(), detail=rows([("VS INTER PREM", "0.00")])) == []


def test_unmapped_key_still_appears_in_the_rows_so_the_reviewer_can_see_it():
    out = build(PostType.SUMMARY, mapping(["VS"]))
    by_key = {r["desc"].rsplit(" - ", 1)[1]: r for r in out[1:]}

    assert by_key["MC"]["acc"] == "", "blank, not dropped — the row is what gets mapped"
    assert is_balanced(out)


# ── TC-REC-005: description template ──────────────────────────────────────────


def test_template_tags_are_replaced():
    out = render_jv_description(
        "Credit Card AR Reconcile {Settlement_Date}",
        settlement_date="21/07/2026",
        tax_invoice_no=DOC_NO,
        bank_name="KBANK",
    )
    assert out == "Credit Card AR Reconcile 21/07/2026"


def test_every_tag_is_supported_and_unset_ones_collapse():
    assert (
        render_jv_description(
            "{Bank_Name} {Tax_Invoice_No} {Settlement_Date}",
            settlement_date="21/07/2026",
            tax_invoice_no=DOC_NO,
            bank_name="KBANK",
        )
        == f"KBANK {DOC_NO} 21/07/2026"
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


def test_document_without_a_tax_invoice_number_drops_the_comment_prefix():
    out = build_ar_jv_rows(
        rows([("VS INTER PREM", "3,251.00")]),
        post_type=PostType.DETAIL,
        debit_dept="GEN",
        debit_acc="1021000",
        mappings=detail_mappings(),
        doc_no=None,
    )
    assert out[0]["desc"] == "Total Credit Card Summary"
    assert out[1]["desc"] == "VS INTER PREM"


# ── control_leg_missing ────────────────────────────────────────────────────────
#
# A JV missing its clearing account still balances and still posts — nothing about the
# arithmetic is wrong, which is exactly why nothing else here would have caught it.


def test_control_leg_missing_when_the_debit_leg_has_no_account():
    out = build_ar_jv_rows(
        rows([("VS INTER PREM", "3,251.00")]),
        post_type=PostType.DETAIL,
        debit_dept="",
        debit_acc="",
        mappings=detail_mappings(),
        doc_no=DOC_NO,
    )
    assert is_balanced(out), "blank dept/acc does not stop the arithmetic from balancing"
    assert control_leg_missing(out) is True


def test_control_leg_not_missing_once_both_fields_are_set():
    out = build(PostType.DETAIL, detail_mappings())
    assert control_leg_missing(out) is False


def test_control_leg_missing_on_a_document_with_no_postable_amounts():
    """`build_ar_jv_rows` returns no rows at all here, so there is no debit leg to check —
    treated as missing rather than vacuously fine, since there is nothing to clear either
    way and callers should not read an empty list as "ready to post"."""
    assert control_leg_missing([]) is True
