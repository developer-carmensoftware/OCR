"""Post-process raw AP-invoice extraction from LLM into the final shape
expected by the frontend.

The LLM only extracts raw values it can read from the document; this module
performs all arithmetic — taxType detection, per-item line totals, footer
discount distribution, deposit/installment negative row, header sums, and
reconciliation against the document's stated grand total.
"""

from __future__ import annotations

from typing import Any


def _num(v: Any) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def _r2(x: float) -> float:
    return round(x + 1e-9, 2)


def _deposit_applies(
    items: list[dict], deposit_pct: float, doc_sub: float, doc_grand: float
) -> bool:
    """Decide whether a detected ``deposit_pct`` is actually applied to the
    document total, or is merely an informational payment-term note.

    A "มัดจำ X%" keyword can appear in two very different documents:
    - a *real deposit invoice* where the footer total already reflects the
      deposit (full order scaled down by the deposit factor), or
    - a *full invoice* that only mentions the deposit in a payment-schedule
      note (footer total = full amount).

    Returns True when the document total reflects the DEPOSIT amount (honour
    the deposit, build the negative row). Returns False when the total is the
    FULL amount and the deposit is informational only. Defaults to True (honour
    the deposit) whenever there is no footer total to reconcile against.
    """
    if not (0 < deposit_pct < 100) or not items:
        return deposit_pct > 0
    item_sum = sum(
        _r2(_num(i.get("qty")) * _num(i.get("unitPrice")) - _num(i.get("discountAmt")))
        for i in items
    )  # full, pre-tax
    if item_sum <= 0:
        return True
    refs = [r for r in (doc_sub, doc_grand) if r > 0]
    if not refs:
        return True

    def near(a: float, b: float) -> bool:  # absorb rounding; 1.2% covers VAT-free noise
        return abs(a - b) <= max(0.05, b * 0.012)

    def matches(v: float) -> bool:  # reconciles to a ref pre-tax OR with 7% VAT added
        return any(near(v, r) or near(v * 1.07, r) for r in refs)

    full = item_sum
    dep = item_sum * deposit_pct / 100.0
    # Deposit is informational only when the FULL total reconciles and the
    # deposit-scaled total does not.
    if matches(full) and not matches(dep):
        return False
    return True


def _detect_tax_type(
    items: list[dict], deposit_pct: float, doc_sub: float, doc_grand: float, doc_tax: float = 0.0
) -> str:
    """Decide Include / Exclude / None by checking which interpretation of the
    items' sum reconciles to the document footer.

    None VAT: triggered when the document's stated tax amount is 0 AND the
    item sum already matches the grand total (within 0.05 rounding), meaning
    no VAT was applied at all.
    """
    if not items:
        return "Exclude"
    item_sum = sum(
        _r2(_num(i.get("qty")) * _num(i.get("unitPrice")) - _num(i.get("discountAmt")))
        for i in items
    )
    factor = (deposit_pct / 100.0) if 0 < deposit_pct < 100 else 1.0
    effective = item_sum * factor
    # Use the first non-zero rate across all items, not items[0] alone — a leading
    # exempt/None row (taxPct 0) must not force whole-document detection back to 7%.
    tax_pct = next((r for r in (_num(i.get("taxPct")) for i in items) if r > 0), 7.0)

    if doc_grand > 0:
        # inc_diff intentionally equals none_diff here: doc_grand already includes VAT, and
        # an Include invoice's item sum (gross unitPrice) already ≈ grand, so the two are
        # indistinguishable by this metric. None is disambiguated below via doc_tax == 0.
        none_diff = abs(effective - doc_grand)
        inc_diff = abs(effective - doc_grand)
        exc_diff = abs(effective * (1 + tax_pct / 100) - doc_grand)
        ref = doc_grand
    elif doc_sub > 0:
        none_diff = abs(effective - doc_sub)
        inc_diff = abs(effective * 100 / (100 + tax_pct) - doc_sub)
        exc_diff = abs(effective - doc_sub)
        ref = doc_sub
    else:
        return "Exclude"

    # None VAT: document explicitly shows tax = 0 and item sum ≈ grand total
    if doc_tax == 0.0 and none_diff <= max(0.05, ref * 0.001):
        return "None"

    return "Include" if inc_diff < exc_diff else "Exclude"


def _distribute_footer_discount(items: list[dict], doc_disc: float) -> None:
    """Split a footer-level discount across items in proportion to invoice
    amount, with the last item absorbing rounding remainder."""
    if doc_disc <= 0 or not items:
        return
    invoice_amts = [_r2(_num(i.get("qty")) * _num(i.get("unitPrice"))) for i in items]
    gross = sum(invoice_amts)
    if gross <= 0:
        return
    running = 0.0
    for idx in range(len(items) - 1):
        share = _r2(doc_disc * invoice_amts[idx] / gross)
        items[idx]["discountAmt"] = _r2(_num(items[idx].get("discountAmt")) + share)
        running += share
    items[-1]["discountAmt"] = _r2(_num(items[-1].get("discountAmt")) + (doc_disc - running))


def _compute_line_totals(item: dict, tax_type: str, has_footer_disc: bool = False) -> None:
    """Fill lineSubTotal / taxAmt / lineTotal, then normalise unitPrice to the
    net-per-unit price (after discount) so Carmen Cloud always receives the
    final net price without a separate discount field.

    Amount-column (lineAmt) semantics depend on where the discount came from:
    - has_footer_disc=True  → discount was distributed from doc footer;
      lineAmt is GROSS (Amount column is before discount). Apply discount normally.
    - has_footer_disc=False → discount is per-row in document (e.g. "Discount Per Unit");
      lineAmt is NET (Amount column already shows post-discount value). Don't double-deduct.
    - No lineAmt → fall back to qty × unitPrice.

    Per-item VAT exemption: if LLM explicitly set taxPct=0 for a row (e.g. เบี้ยปรับผิดนัด),
    treat that item as "None" regardless of the document-level tax_type.
    """
    qty = _num(item.get("qty")) or 1.0
    price = _num(item.get("unitPrice"))
    disc = _num(item.get("discountAmt"))
    disc_pct = _num(item.get("discountPct"))
    tax_pct = _num(item.get("taxPct"))
    # If LLM explicitly set taxPct=0 for this row, honour it as VAT-exempt (None).
    # Only fall back to 7 when the field was missing/zero AND the doc is taxable.
    item_exempt = "taxPct" in item and tax_pct == 0.0
    effective_tax_type = "None" if item_exempt else tax_type
    if effective_tax_type != "None" and tax_pct == 0.0:
        tax_pct = 7.0
    line_amt_doc = _num(item.get("lineAmt"))

    if line_amt_doc and disc > 0 and not has_footer_disc:
        # Amount column = NET (per-row discount in document) — don't deduct again
        after_disc = _r2(line_amt_doc)
        invoice_amt = _r2(after_disc + disc)  # reconstruct gross for discountPct calc
    elif line_amt_doc:
        # Amount column = GROSS (footer discount or no discount)
        invoice_amt = _r2(line_amt_doc)
        after_disc = _r2(invoice_amt - disc)
    else:
        invoice_amt = _r2(qty * price)
        after_disc = _r2(invoice_amt - disc)

    # Compute discountPct for display if not already extracted from document
    if disc_pct == 0 and disc > 0 and invoice_amt > 0:
        disc_pct = _r2(disc / invoice_amt * 100)

    if effective_tax_type == "None":
        line_sub = after_disc
        tax_amt = 0.0
        line_total = after_disc
    elif effective_tax_type == "Include":
        line_sub = _r2(after_disc * 100 / (100 + tax_pct))
        tax_amt = _r2(after_disc - line_sub)
        line_total = _r2(after_disc)
    else:  # Exclude
        line_sub = after_disc
        tax_amt = _r2(line_sub * tax_pct / 100)
        line_total = _r2(line_sub + tax_amt)

    item["qty"] = qty
    item["unitPrice"] = price  # original price from document (display as-is)
    item["discountPct"] = disc_pct  # % shown in column (for display)
    item["discountAmt"] = disc  # original discount amount (for display)
    item["taxPct"] = tax_pct
    item["taxType"] = effective_tax_type
    item["lineSubTotal"] = line_sub
    item["taxAmt"] = tax_amt
    item["lineTotal"] = line_total


def _build_deposit_row(
    items: list[dict], deposit_pct: float, deposit_label: str, tax_type: str
) -> dict | None:
    """Construct the negative deposit/installment row that brings the items
    total down to the actual amount being collected this period."""
    if deposit_pct <= 0 or deposit_pct >= 100 or not items:
        return None
    not_collected = (100.0 - deposit_pct) / 100.0
    full_sub = _r2(sum(_num(i["lineSubTotal"]) for i in items))
    full_grand = _r2(sum(_num(i["lineTotal"]) for i in items))
    tax_pct = _num(items[0].get("taxPct"))
    if tax_type != "None" and tax_pct == 0.0:
        tax_pct = 7.0

    if tax_type == "None":
        adj_sub = _r2(-full_sub * not_collected)
        adj_tax = 0.0
        adj_lt = adj_sub
        unit_price = adj_sub
    elif tax_type == "Include":
        adj_grand = _r2(-full_grand * not_collected)
        adj_sub = _r2(adj_grand * 100 / (100 + tax_pct))
        adj_tax = _r2(adj_grand - adj_sub)
        unit_price = adj_grand
        adj_lt = adj_grand
    else:
        adj_sub = _r2(-full_sub * not_collected)
        adj_tax = _r2(adj_sub * tax_pct / 100)
        adj_lt = _r2(adj_sub + adj_tax)
        unit_price = adj_sub

    return {
        "category": "เงินมัดจำ",
        "description": deposit_label or f"มัดจำ {int(deposit_pct)}%",
        "qty": 1,
        "unitPrice": unit_price,
        "discountPct": 0,
        "discountAmt": 0,
        "lineSubTotal": adj_sub,
        "taxPct": tax_pct,
        "taxType": tax_type,
        "taxAmt": adj_tax,
        "lineTotal": adj_lt,
    }


def postprocess(raw: dict | None) -> dict:
    """Convert the LLM's raw extraction into the final shape consumed by the
    frontend (`useAPInvoice.js`).

    Input keys (from prompt): vendorName, vendorTaxId, vendorBranch,
    documentName, documentDate, documentNumber, items[],
    docSubTotal, docDiscount, docTaxAmount, docGrandTotal,
    depositPct, depositLabel.
    """
    raw = raw or {}
    items_raw = list(raw.get("items") or [])
    doc_sub = _num(raw.get("docSubTotal"))
    doc_tax = _num(raw.get("docTaxAmount"))
    doc_disc = _num(raw.get("docDiscount"))
    doc_grand = _num(raw.get("docGrandTotal"))
    deposit_pct = _num(raw.get("depositPct"))
    deposit_label = (raw.get("depositLabel") or "").strip()

    items = [dict(i) for i in items_raw if i is not None]

    has_footer_disc = doc_disc > 0
    _distribute_footer_discount(items, doc_disc)
    # If "มัดจำ X%" is only an informational payment-term note (footer total =
    # full amount), neutralise the deposit so tax-type detection and the deposit
    # row below don't wrongly scale the document down.
    if not _deposit_applies(items, deposit_pct, doc_sub, doc_grand):
        deposit_pct = 0.0
    tax_type = _detect_tax_type(items, deposit_pct, doc_sub, doc_grand, doc_tax)
    for item in items:
        _compute_line_totals(item, tax_type, has_footer_disc=has_footer_disc)

    items = [i for i in items if _num(i.get("lineTotal")) != 0]

    deposit_row = _build_deposit_row(items, deposit_pct, deposit_label, tax_type)
    if deposit_row is not None:
        items.append(deposit_row)

    sub_total = _r2(sum(_num(i["lineSubTotal"]) for i in items))
    tax_amount = _r2(sum(_num(i["taxAmt"]) for i in items))
    grand_total = _r2(sum(_num(i["lineTotal"]) for i in items))
    total_discount = _r2(sum(_num(i.get("discountAmt")) for i in items))

    # Reconcile header totals against document-stated values (snap within 0.05)
    if doc_grand > 0 and abs(grand_total - doc_grand) <= 0.05:
        grand_total = doc_grand
    if doc_sub > 0 and abs(sub_total - doc_sub) <= 0.05:
        sub_total = doc_sub
    if doc_tax > 0 and abs(tax_amount - doc_tax) <= 0.05:
        tax_amount = doc_tax

    # Penny-rounding reconciliation: if per-item rounding causes computed
    # grand to differ from doc_grand by ≤0.02, absorb into the last regular
    # (non-deposit) item so that sum(lineTotal) == header.grandTotal and the
    # frontend validation passes.
    computed_grand = _r2(sum(_num(i["lineTotal"]) for i in items))
    diff = _r2(grand_total - computed_grand)
    if 0 < abs(diff) <= 0.02:
        # Find the last item that is not the deposit row (category != "เงินมัดจำ")
        regular_items = [i for i in items if i.get("category") != "เงินมัดจำ"]
        if regular_items:
            last = regular_items[-1]
            last["taxAmt"] = _r2(_num(last["taxAmt"]) + diff)
            last["lineTotal"] = _r2(_num(last["lineSubTotal"]) + _num(last["taxAmt"]))
            # The penny went into tax, so move the header tax by the same amount to keep
            # sum(item.taxAmt) == tax_amount and sub + tax == grand. Otherwise the frontend
            # would see a phantom tax diff and force the user onto the Adjust button.
            tax_amount = _r2(tax_amount + diff)

    deposit_amt = _r2(grand_total) if deposit_pct > 0 else 0.0

    return {
        "vendorName": raw.get("vendorName") or "",
        "vendorTaxId": raw.get("vendorTaxId") or "",
        "vendorBranch": raw.get("vendorBranch") or "",
        "documentName": raw.get("documentName") or "",
        "documentDate": raw.get("documentDate") or "",
        "documentNumber": raw.get("documentNumber") or "",
        "taxType": tax_type,
        "depositPct": deposit_pct,
        "depositAmt": deposit_amt,
        "items": items,
        "subTotal": sub_total,
        "taxAmount": tax_amount,
        "totalDiscount": total_discount,
        "grandTotal": grand_total,
    }
