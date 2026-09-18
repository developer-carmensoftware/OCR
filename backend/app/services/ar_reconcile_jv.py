"""AR-reconciliation JV builder — KBANK settlement report → Carmen `gljv` body.

One document, one JV. `Cr.` one line per card scheme (the report's per-payment-type rows),
`Dr.` commission / input tax / bank account — the same three fixed buckets `cc_jv.py`
debits for the fee invoice, read from the report's own `TOTAL BY MERCHANT ID` row instead
of from a second document. Decision #28 (`docs/email-automation/06-decision-log.md`):
until 2026-09-18 this builder derived a single control leg from the sum of the very rows
it credited, meant to be cleared by a second JV built from the encrypted e-tax invoice —
FRD §6.1 as originally written. The settlement report's own text layer turned out to carry
every figure that second document had (COMM AMT / VAT AMT / NET AMT are printed on its
anchor row too), so the split added a credit, a review and a password requirement the
figures never required.

Only `THB AMT` groups into credit legs; COMM AMT / VAT AMT / NET AMT come from the one
anchor row, not summed across `details` — a settlement report's per-payment-type rows
print those three columns as dashes (`_normalize_ar_settlement` in credit_card_service.py
is where the anchor is read and kept as `extracted.total_row`).

No browser twin and no contract file to keep in step. Email ingest is the only poster, and
the settings screen's preview asks this module through the API rather than reimplementing
it, so there is exactly one implementation of the arithmetic that decides what reaches the
customer's books.
"""

from __future__ import annotations

from typing import Any

from app.constants import PostType
from app.models.schemas import ExtractedDetailRow
from app.services.cc_jv import _FIXED_TYPES, num, r2

# Rounding floor for the double-entry check. NFR §9.4 says tolerance 0.00, and this is
# how that is spelled once floats are involved: anything at or under half a satang is the
# representation, anything above it is a real imbalance.
BALANCE_EPSILON = 0.005


def group_key(payment_type: str, post_type: str) -> str:
    """The mapping key a printed payment type resolves to.

    Detail keeps the label as printed. Summary takes its first token, which is how KBANK
    writes the scheme: `VS INTER UP PREM` → `VS`, `MC INTER UP PREM` → `MC`, `JCB PREM`
    → `JCB`. A scheme nobody has seen before (`AMEX PREM` → `AMEX`) therefore becomes its
    own unmapped key and parks the document rather than quietly joining another group.
    """
    label = (payment_type or "").strip()
    if post_type != PostType.SUMMARY:
        return label
    return label.split(" ", 1)[0] if label else label


def _mapping_for(mappings: dict[str, Any], key: str) -> dict:
    return mappings.get(key) or {}


def build_ar_jv_rows(
    details: list[ExtractedDetailRow],
    *,
    post_type: str,
    total_row: ExtractedDetailRow | None,
    cc_mappings: dict[str, Any],
    mappings: dict[str, Any],
    doc_no: str | None,
) -> list[dict]:
    """Three fixed debit legs (commission / input tax / bank account) + one credit leg
    per grouped payment type.

    The debit side reads `total_row`'s COMM AMT / VAT AMT / NET AMT — never summed across
    `details`, which print those columns as dashes on a settlement report — against the
    BU's *existing* credit-card GL mapping (`cc_mappings`, the same dict `cc_jv.build_jv_rows`
    reads for the fee invoice; no mapping table of this feature's own for these three).
    `total_row=None` (the anchor was missing or unreadable) posts zero on all three —
    `_normalize_ar_settlement` already warned, so the document is parked before this
    matters, but the arithmetic itself never guesses a figure that was not printed.

    A group whose total is negative (a refund or chargeback settling on the same report,
    FRD §8 case 5) swaps sides and posts its absolute value, so the entry stays a
    reclassification in the right direction instead of a negative credit Carmen would
    reject.
    """
    tax_inv = (doc_no or "").strip()
    prefix = f"Tax Inv.# {tax_inv} - " if tax_inv else ""

    grouped: dict[str, float] = {}
    for d in details:
        amt = num(d.pay_amt)
        if not amt:
            continue
        key = group_key(d.transaction or "UNKNOWN", post_type)
        grouped[key] = grouped.get(key, 0.0) + amt

    if not grouped:
        return []

    def leg(cfg: dict | None, desc: str, debit: float, credit: float, key: str = "") -> dict:
        return {
            "dept": (cfg or {}).get("dept", "") or "",
            "acc": (cfg or {}).get("acc", "") or "",
            "desc": desc,
            "debit": debit,
            "credit": credit,
            # What the review screen joins the printed lines back to. `desc` carries the
            # same text on a credit leg, but behind a prefix that only exists when the
            # document has a number — parsing it back out would be a second, weaker copy
            # of this. Empty on all three debit legs: none of them is a printed payment
            # type, so none belongs to a group.
            "key": key,
        }

    def anchor_amt(field: str) -> float:
        # ponytail: posted straight into "debit" with no sign flip for a negative figure —
        # matches cc_jv.build_jv_rows's own commission/tax/net legs, which have the same
        # gap today. A settlement day negative enough to print a negative COMM/VAT/NET
        # would need the same fix in both places at once; out of scope here.
        return r2(num(getattr(total_row, field, None))) if total_row is not None else 0.0

    rows: list[dict] = [
        leg(cc_mappings.get("commission"), "Credit card commission", anchor_amt("commis_amt"), 0.0),
        leg(cc_mappings.get("tax"), "Input Tax", anchor_amt("tax_amt"), 0.0),
        leg(cc_mappings.get("net"), "Bank Account", anchor_amt("total"), 0.0),
    ]
    for key, raw in grouped.items():
        cfg = _mapping_for(mappings, key)
        amt = r2(raw)
        rows.append(
            leg(
                cfg,
                f"{prefix}{key}",
                abs(amt) if amt < 0 else 0.0,
                amt if amt >= 0 else 0.0,
                key,
            )
        )
    return rows


def unmapped_ar_types(
    details: list[ExtractedDetailRow],
    mappings: dict[str, Any],
    post_type: str,
    cc_mappings: dict[str, Any],
) -> list[str]:
    """Group keys on the document, plus the three fixed debit keys, that the BU has never
    mapped to a GL account.

    Mirrors `cc_jv.unmapped_payment_types`: a non-empty result parks the document instead
    of posting it, because an AI-guessed account must never reach the books unattended.
    The three fixed keys are checked unconditionally, the same way `cc_jv`'s version always
    checks them — they are a structural requirement of every settlement JV, not something
    that only matters when a row happens to be non-zero.
    """
    missing: list[str] = []
    for d in details:
        if not num(d.pay_amt):
            continue
        key = group_key(d.transaction or "UNKNOWN", post_type)
        cfg = _mapping_for(mappings, key)
        if not (cfg.get("dept") and cfg.get("acc")) and key not in missing:
            missing.append(key)
    for field_type in _FIXED_TYPES:
        cfg = cc_mappings.get(field_type) or {}
        if not (cfg.get("dept") and cfg.get("acc")):
            missing.append(field_type)
    return missing


def is_balanced(rows: list[dict]) -> bool:
    """Σ debit vs Σ credit, where the two sides come from independent readings of the
    same page: credits are the per-row THB AMT column (grouped), debits are the anchor
    row's COMM AMT / VAT AMT / NET AMT. A real verification since 2026-09-18 — before, the
    debit side was derived from the sum of the very credit rows it was compared against,
    which could never disagree with itself. `_review_flags`' `ar_unbalanced` and
    `approve_document`'s own check both read this now.
    """
    debit = sum(r["debit"] for r in rows)
    credit = sum(r["credit"] for r in rows)
    return abs(debit - credit) <= BALANCE_EPSILON


def render_jv_description(
    template: str,
    *,
    settlement_date: str | None,
    tax_invoice_no: str | None,
    bank_name: str | None,
) -> str:
    """Fill the BU's description template. An unset tag renders empty, not as itself."""
    out = template or ""
    for tag, value in (
        ("{Settlement_Date}", settlement_date),
        ("{Tax_Invoice_No}", tax_invoice_no),
        ("{Bank_Name}", bank_name),
    ):
        out = out.replace(tag, value or "")
    return " ".join(out.split())
