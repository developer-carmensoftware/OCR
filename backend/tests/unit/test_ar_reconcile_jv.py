"""AR-reconciliation JV arithmetic.

Figures are the real ones from KB1P554V2_SUM_451005282039001_20260721.pdf (settlement
21/07/2026, tax invoice 210726E00035291) rather than invented round numbers, because the
thing most likely to break here is grouping a scheme label wrongly, and only real labels
have the shape that catches it.

Covers FRD QA matrix TC-REC-001 (Detail), TC-REC-002 (Summary) and TC-REC-005 (template
tag replacement) — updated 2026-09-18 for v1.2's three fixed debit legs replacing the
single derived control leg (decision #28, docs/email-automation/06-decision-log.md).
"""

from app.constants import PostType
from app.models.schemas import ExtractedDetailRow
from app.services.ar_reconcile_jv import (
    build_ar_jv_rows,
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

# The same block's own TOTAL BY MERCHANT ID row. COMM + VAT + NET == THB AMT above — the
# same self-consistency the real document has to pass before this module ever sees it.
TOTAL_ROW = ExtractedDetailRow(
    transaction="TOTAL BY MERCHANT ID",
    pay_amt="25,091.00",
    commis_amt="582.99",
    tax_amt="40.81",
    total="24,467.20",
)


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


def cc_mappings(commission="5001", tax="5002", net="1010"):
    """The BU's existing credit-card commission/tax/net mapping — the same dict
    `cc_jv.build_jv_rows` reads for the fee invoice, not a table of this feature's own."""
    return {
        "commission": {"dept": "GEN", "acc": commission},
        "tax": {"dept": "GEN", "acc": tax},
        "net": {"dept": "GEN", "acc": net},
    }


def build(post_type, mappings, detail=None, total_row=TOTAL_ROW, cc_maps=None):
    return build_ar_jv_rows(
        detail if detail is not None else rows(),
        post_type=post_type,
        total_row=total_row,
        cc_mappings=cc_maps if cc_maps is not None else cc_mappings(),
        mappings=mappings,
        doc_no=DOC_NO,
    )


# ── TC-REC-001: Detail ────────────────────────────────────────────────────────


def test_detail_posts_one_credit_per_printed_payment_type():
    out = build(PostType.DETAIL, detail_mappings())

    assert len(out) == 10, "3 fixed debit legs + 7 credits"
    debits, credits = out[:3], out[3:]
    assert [d["desc"] for d in debits] == ["Credit card commission", "Input Tax", "Bank Account"]
    assert [d["debit"] for d in debits] == [582.99, 40.81, 24467.20]
    assert all(d["credit"] == 0 for d in debits)
    assert [d["acc"] for d in debits] == ["5001", "5002", "1010"]
    assert [c["desc"] for c in credits] == [f"Tax Inv.# {DOC_NO} - {t}" for t, _ in SAMPLE]
    assert is_balanced(out)
    assert sum(c["credit"] for c in credits) == TOTAL
    assert sum(d["debit"] for d in debits) == TOTAL


# ── TC-REC-002: Summary ───────────────────────────────────────────────────────


def test_summary_folds_schemes_onto_their_first_token():
    out = build(PostType.SUMMARY, summary_mappings())

    assert len(out) == 6, "3 fixed debit legs + VS + MC + JCB"
    by_key = {r["desc"].rsplit(" - ", 1)[1]: r for r in out[3:]}
    assert by_key["VS"]["credit"] == 15471.00  # 2,200 + 3,251 + 10,020
    assert by_key["MC"]["credit"] == 9320.00  # 1,000 + 5,945 + 2,375
    assert by_key["JCB"]["credit"] == 300.00
    assert sum(d["debit"] for d in out[:3]) == TOTAL
    assert is_balanced(out)


def test_every_leg_carries_the_group_it_posts_under():
    """The review pane joins printed lines to legs on `key`, not by parsing `desc`.

    `desc` carries the same text behind a `Tax Inv.# … - ` prefix that only exists when the
    document has a number, so slicing it back off would be a second, weaker copy of the
    grouping. None of the three fixed debit legs belongs to a group and all three say so
    with an empty key.
    """
    detail = build(PostType.DETAIL, detail_mappings())
    assert [r["key"] for r in detail[:3]] == ["", "", ""]
    assert [r["key"] for r in detail[3:]] == [t for t, _ in SAMPLE]

    summary = build(PostType.SUMMARY, summary_mappings())
    assert [r["key"] for r in summary[:3]] == ["", "", ""]
    assert [r["key"] for r in summary[3:]] == ["VS", "MC", "JCB"]

    # The join the browser performs, spelled out: a printed label is either the key itself
    # or the key plus a space and the rest of it. Nothing else has to be true.
    keys = {r["key"] for r in summary[3:]}
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

    assert unmapped_ar_types(detail, summary_mappings(), PostType.SUMMARY, cc_mappings()) == [
        "AMEX"
    ]
    assert unmapped_ar_types(detail, detail_mappings(), PostType.DETAIL, cc_mappings()) == [
        "AMEX PREM"
    ]
    assert unmapped_ar_types(rows(), detail_mappings(), PostType.DETAIL, cc_mappings()) == []


def test_a_zero_amount_row_is_not_something_to_map():
    """It contributes nothing to the JV, so demanding an account for it would park a
    document over a line that was never going to post."""
    detail = rows([*SAMPLE, ("AMEX PREM", "0.00")])

    assert unmapped_ar_types(detail, detail_mappings(), PostType.DETAIL, cc_mappings()) == []
    assert "AMEX PREM" not in [r["desc"] for r in build(PostType.DETAIL, detail_mappings(), detail)]


def test_inactive_and_missing_accounts_both_read_as_unmapped():
    partial = dict(detail_mappings())
    partial["JCB PREM"] = {"dept": "GEN", "acc": ""}

    assert unmapped_ar_types(rows(), partial, PostType.DETAIL, cc_mappings()) == ["JCB PREM"]


def test_a_missing_fixed_debit_key_is_unmapped_regardless_of_amount():
    """Structural, not per-row, unlike the credit-side keys above: the three fixed legs
    are required even though nothing about `details` would suggest one needs a mapping —
    mirrors `cc_jv.unmapped_payment_types`'s own unconditional check of the same three."""
    incomplete = {
        "commission": {"dept": "GEN", "acc": "5001"},
        "tax": {},
        "net": {"dept": "GEN", "acc": "1010"},
    }
    assert unmapped_ar_types(rows(), detail_mappings(), PostType.DETAIL, incomplete) == ["tax"]
    assert unmapped_ar_types(rows(), detail_mappings(), PostType.DETAIL, {}) == [
        "commission",
        "tax",
        "net",
    ]


# ── FRD §8 case 5: refunds and chargebacks ────────────────────────────────────
#
# The debit side no longer derives from the credit rows (decision #28), so these fixtures
# supply a `total_row` whose three figures sum to whatever the synthetic detail rows below
# credit — the same self-consistency a real document's own anchor row has to satisfy, just
# asserted by the test instead of by a printed page.


def test_negative_group_swaps_sides_and_still_balances():
    out = build(
        PostType.SUMMARY,
        summary_mappings(),
        detail=rows([("VS INTER PREM", "3,251.00"), ("MC INTER PREM", "-1,000.00")]),
        total_row=ExtractedDetailRow(total="2,251.00", commis_amt="0.00", tax_amt="0.00"),
    )

    by_key = {r["desc"].rsplit(" - ", 1)[1]: r for r in out[3:]}
    assert by_key["VS"]["credit"] == 3251.00 and by_key["VS"]["debit"] == 0
    assert by_key["MC"]["debit"] == 1000.00 and by_key["MC"]["credit"] == 0
    assert sum(d["debit"] for d in out[:3]) == 2251.00  # net of the two groups
    assert is_balanced(out)


def test_a_lone_negative_group_still_posts_as_a_debit_leg():
    """Before 2026-09-18 the single derived control leg tracked the *net of all groups*,
    so one refunded scheme flipped the whole JV and it still balanced by construction. The
    fixed debit legs no longer derive from the credit rows at all (decision #28), so a lone
    negative group debits on its own sign and nothing on the debit side answers it unless
    the report's own total row says the same thing — `is_balanced` is the check that would
    catch a report whose total row disagrees with a refunded scheme."""
    out = build(
        PostType.SUMMARY,
        summary_mappings(),
        detail=rows([("VS INTER PREM", "-3,251.00")]),
        total_row=None,
    )

    assert out[3]["debit"] == 3251.00 and out[3]["credit"] == 0
    assert not is_balanced(out), "nothing on the debit side answers the refund"


# ── Degenerate input ──────────────────────────────────────────────────────────


def test_document_with_no_amounts_produces_no_jv():
    assert build(PostType.DETAIL, detail_mappings(), detail=[]) == []
    assert build(PostType.DETAIL, detail_mappings(), detail=rows([("VS INTER PREM", "0.00")])) == []


def test_unmapped_key_still_appears_in_the_rows_so_the_reviewer_can_see_it():
    out = build(PostType.SUMMARY, mapping(["VS"]))
    by_key = {r["desc"].rsplit(" - ", 1)[1]: r for r in out[3:]}

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
    """The prefix only ever decorates credit legs — the three fixed debit legs have
    always carried plain, fixed wording, with or without a tax invoice number."""
    out = build_ar_jv_rows(
        rows([("VS INTER PREM", "3,251.00")]),
        post_type=PostType.DETAIL,
        total_row=ExtractedDetailRow(total="3,251.00", commis_amt="0.00", tax_amt="0.00"),
        cc_mappings=cc_mappings(),
        mappings=detail_mappings(),
        doc_no=None,
    )
    assert [r["desc"] for r in out[:3]] == ["Credit card commission", "Input Tax", "Bank Account"]
    assert out[3]["desc"] == "VS INTER PREM"


# ── total_row missing ─────────────────────────────────────────────────────────
#
# `_normalize_ar_settlement` already warns when the anchor row cannot be found on the real
# document — this is the arithmetic's own behaviour in that case, not a substitute for it.


def test_a_missing_total_row_posts_zero_on_every_debit_leg():
    out = build(PostType.DETAIL, detail_mappings(), total_row=None)

    assert [d["debit"] for d in out[:3]] == [0.0, 0.0, 0.0]
    assert not is_balanced(out), "credits still post; debits do not — a real imbalance"


# ── is_balanced is now a real check ─────────────────────────────────────────────
#
# Before 2026-09-18 the debit leg was derived from the sum of the very rows it was
# compared against, so this could never return False for the builder's own output (decision
# #28). The two sides are now independent readings of the same page and can disagree.


def test_is_balanced_catches_a_total_row_that_disagrees_with_the_grouped_rows():
    wrong_total = ExtractedDetailRow(commis_amt="1.00", tax_amt="1.00", total="1.00")
    out = build(PostType.DETAIL, detail_mappings(), total_row=wrong_total)

    assert not is_balanced(out)
