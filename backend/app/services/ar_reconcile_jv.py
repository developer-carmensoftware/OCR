"""AR-reconciliation JV builder — KBANK settlement report → Carmen `gljv` body.

The second half of a pair. `cc_jv.py` builds the JV for the settlement's cash side
(`Cr.` the lump control account, `Dr.` bank / commission / input tax). This builds the
one that clears that lump: `Dr.` the control account for the day's gross takings, `Cr.`
one line per card scheme. Both carry the same tax invoice number, and both are meant to.

Unlike `cc_jv.py` there is no browser twin and no contract file to keep in step. Email
ingest is the only poster, and the settings screen's preview asks this module through the
API rather than reimplementing it, so there is exactly one implementation of the
arithmetic that decides what reaches the customer's books.

Only `THB AMT` is journalised here (FRD §6.1). The commission, its VAT and the net
deposit belong to the fee invoice's own JV; taking them again from this document would
book the same expense twice.
"""

from __future__ import annotations

from typing import Any

from app.constants import PostType
from app.models.schemas import ExtractedDetailRow
from app.services.cc_jv import num, r2

# Rounding floor for the double-entry check. NFR §9.4 says tolerance 0.00, and this is
# how that is spelled once floats are involved: anything at or under half a satang is the
# representation, anything above it is a real imbalance.
BALANCE_EPSILON = 0.005


def group_key(payment_type: str, post_type: str) -> str:
    """The mapping key a printed payment type resolves to.

    Detail keeps the label as printed. Summary takes its first token, which is how KBANK
    writes the scheme: `VS INTER UP PREM` → `VS`, `MC LOCAL UP PREM` → `MC`, `JCB PREM`
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
    debit_dept: str | None,
    debit_acc: str | None,
    mappings: dict[str, Any],
    doc_no: str | None,
) -> list[dict]:
    """Grouped THB AMT → one debit leg against the control account, one credit leg per key.

    A group whose total is negative (a refund or chargeback settling on the same report,
    FRD §8 case 5) swaps sides and posts its absolute value, so the entry stays a
    reclassification in the right direction instead of a negative credit Carmen would
    reject. The debit leg follows the net of all groups for the same reason: a report that
    nets negative overall reverses as a whole.
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

    rows: list[dict] = []
    total = r2(sum(grouped.values()))
    rows.append(
        {
            "dept": debit_dept or "",
            "acc": debit_acc or "",
            "desc": f"{prefix}Credit Card AR Summary",
            "debit": abs(total) if total >= 0 else 0.0,
            "credit": 0.0 if total >= 0 else abs(total),
            # The counterpart to every group, so it belongs to none of them.
            "key": "",
        }
    )
    for key, raw in grouped.items():
        cfg = _mapping_for(mappings, key)
        amt = r2(raw)
        rows.append(
            {
                "dept": cfg.get("dept") or "",
                "acc": cfg.get("acc") or "",
                "desc": f"{prefix}{key}",
                "debit": abs(amt) if amt < 0 else 0.0,
                "credit": amt if amt >= 0 else 0.0,
                # What the review screen joins the printed lines back to. `desc` carries the
                # same text, but behind a prefix that only exists when the document has a
                # number — parsing it back out would be a second, weaker copy of this.
                "key": key,
            }
        )
    return rows


def unmapped_ar_types(
    details: list[ExtractedDetailRow], mappings: dict[str, Any], post_type: str
) -> list[str]:
    """Group keys on the document that the BU has never mapped to a GL account.

    Mirrors `cc_jv.unmapped_payment_types`: a non-empty result parks the document instead
    of posting it, because an AI-guessed account must never reach the books unattended.
    Debit-side completeness is checked separately — it lives in the settings row, not here.
    """
    missing: list[str] = []
    for d in details:
        if not num(d.pay_amt):
            continue
        key = group_key(d.transaction or "UNKNOWN", post_type)
        cfg = _mapping_for(mappings, key)
        if not (cfg.get("dept") and cfg.get("acc")) and key not in missing:
            missing.append(key)
    return missing


def is_balanced(rows: list[dict]) -> bool:
    """Σ debit == Σ credit. Checked before posting, never repaired."""
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
