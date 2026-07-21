"""Post-process raw AP-invoice extraction from LLM into the final shape
expected by the frontend.

The LLM only extracts raw values it can read from the document; this module
performs all arithmetic — taxType detection, per-item line totals, footer
discount distribution, deposit/installment negative row, header sums, and
reconciliation against the document's stated grand total.
"""

from __future__ import annotations

from typing import Any

# How far the winning VAT reading may miss the printed footer, as a fraction of it,
# before we tell the user it was a guess. 1% is wide enough to absorb per-line rounding
# and a stray satang, narrow enough that a whole misread column (7% of the document)
# always trips it.
_TAX_FIT_TOLERANCE = 0.01

_TAX_TYPE_GUESSED_WARNING = (
    "Could not confirm whether VAT is included in the unit prices; assumed "
    "{tax_type}. Please check the line amounts against the document before submitting."
)


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


def _net_item_sum(items: list[dict]) -> float:
    """Σ of what the rows actually bill, before tax: gross less each row's own
    discount and less its share of any document-level discount.

    Both callers below decide a document-wide interpretation by comparing this
    against the printed footers, so every discount must already be reflected here
    — a discount still sitting in a "ส่วนลด %" column inflates the sum and can flip
    the answer. ``_footerDisc`` is read separately because
    ``_distribute_footer_discount`` deliberately keeps it off ``discountAmt``.
    """
    return sum(
        _r2(
            (_num(i.get("qty")) or 1.0) * _num(i.get("unitPrice"))
            - _num(i.get("discountAmt"))
            - _num(i.get("_footerDisc"))
        )
        for i in items
    )


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
    item_sum = _net_item_sum(items)  # full, pre-tax
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
) -> tuple[str, float]:
    """Decide Include / Exclude / None by checking which interpretation of the
    items' sum reconciles to the document footer.

    None VAT: triggered when the document's stated tax amount is 0 AND the
    item sum already matches the grand total (within 0.05 rounding), meaning
    no VAT was applied at all.

    Returns ``(tax_type, misfit)`` where ``misfit`` is the winning candidate's
    residual as a fraction of the reference total. This is a nearest-match vote:
    it always returns *something*, even when neither reading fits — on invoice
    66-0023 Include won while still missing the footer by 1,238 baht. The caller
    warns the user when ``misfit`` says the answer was a guess rather than a fit.
    """
    if not items:
        return "Exclude", 0.0
    item_sum = _net_item_sum(items)
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
        # No footer to reconcile against — nothing was decided, so nothing to warn about.
        return "Exclude", 0.0

    # None VAT: document explicitly shows tax = 0 and item sum ≈ grand total
    if doc_tax == 0.0 and none_diff <= max(0.05, ref * 0.001):
        return "None", none_diff / ref if ref else 0.0

    winner = "Include" if inc_diff < exc_diff else "Exclude"
    return winner, min(inc_diff, exc_diff) / ref if ref else 0.0


def _resolve_line_discount(items: list[dict]) -> None:
    """Normalise every row's discount into a whole-line ``discountAmt`` BEFORE
    any other arithmetic runs.

    The printed Amount column (``lineAmt``) is the authority: whatever it falls
    short of ``qty × unitPrice`` IS that row's discount, however the document
    expressed it — a "ส่วนลด %" column, a per-unit figure, or a per-line amount.
    ``discountPct`` is the fallback for documents with no Amount column.

    MUST run before ``_detect_tax_type``. That function sums
    ``qty × unitPrice − discountAmt``, so a discount left at 0 inflates the sum
    and can flip the VAT interpretation of the whole document: on invoice
    66-0023 a 15% discount column made the item sum read 20,607.00 instead of
    17,691.10, Include beat Exclude by being less wrong, every line was divided
    by 1.07, and the shortfall was plugged onto the last row.

    Establishes the invariant ``qty × unitPrice − discountAmt == lineAmt``, which
    is what lets the frontend's ``recalcRow`` reproduce these totals from the
    same inputs without sharing any code.
    """
    for item in items:
        qty = _num(item.get("qty")) or 1.0
        price = _num(item.get("unitPrice"))
        gross = _r2(qty * price)
        line_amt = _num(item.get("lineAmt"))
        pct = _num(item.get("discountPct"))

        if gross > 0 and line_amt:
            # An Amount ABOVE gross is a surcharge or a misread digit, never a
            # negative discount — clamp so it cannot feed back as extra revenue.
            disc = max(0.0, _r2(gross - line_amt))
        elif gross > 0 and pct > 0 and _num(item.get("discountAmt")) == 0:
            disc = _r2(gross * pct / 100)
        else:
            # Negative rows (a "-190 DISCOUNT" line) land here: gross <= 0, so
            # there is no discount to resolve — the negative price IS the discount.
            disc = _num(item.get("discountAmt"))

        item["discountAmt"] = disc
        item["discountPct"] = _r2(disc / gross * 100) if gross > 0 else pct


def _distribute_footer_discount(items: list[dict], doc_disc: float) -> None:
    """Record each item's share of a footer-level discount on ``_footerDisc``,
    proportional to its invoice amount, largest row absorbing the remainder.

    Deliberately kept OFF ``discountAmt``: ``_compute_line_totals`` needs to tell
    a row's own (already reflected in the Amount column) discount apart from the
    document-level one. Folding both into one field is what made a document
    carrying BOTH a discount column and a footer discount deduct the row's
    discount twice.
    """
    if doc_disc <= 0 or not items:
        return
    # Fall back to the Amount column when a row has no qty/unitPrice, and floor at
    # 0 so negative rows (a discount line, a deposit row) take no share — a negative
    # share would INCREASE that row while shrinking everyone else's base.
    bases = [
        max(0.0, _r2(_num(i.get("qty")) * _num(i.get("unitPrice"))) or _num(i.get("lineAmt")))
        for i in items
    ]
    total = sum(bases)
    if total <= 0:
        return
    # Absorb the rounding remainder on the largest row, not blindly items[-1] —
    # the last row is often the zero-base or negative one we just skipped.
    absorber = max(range(len(items)), key=lambda i: bases[i])
    running = 0.0
    for idx, item in enumerate(items):
        if idx == absorber or bases[idx] <= 0:
            continue
        share = _r2(doc_disc * bases[idx] / total)
        item["_footerDisc"] = share
        running += share
    items[absorber]["_footerDisc"] = _r2(doc_disc - running)


def _compute_line_totals(item: dict, tax_type: str) -> None:
    """Fill lineSubTotal / taxAmt / lineTotal for one row.

    ``unitPrice`` is left exactly as the document printed it — the net-per-unit
    price Carmen needs is derived at payload-build time on the frontend, from the
    line amount rather than from this field.

    Amount-column semantics are no longer guessed. ``_resolve_line_discount`` has
    already made ``lineAmt`` net of the row's OWN discount, and
    ``_distribute_footer_discount`` records the document-level share separately on
    ``_footerDisc``, so this only has to subtract the footer share. That split is
    what lets a document carrying BOTH a discount column and a footer discount
    come out right; the old document-wide ``has_footer_disc`` flag deducted the
    row's own discount a second time on every such invoice.

    Per-item VAT exemption: if LLM explicitly set taxPct=0 for a row (e.g. เบี้ยปรับผิดนัด),
    treat that item as "None" regardless of the document-level tax_type.
    """
    qty = _num(item.get("qty")) or 1.0
    price = _num(item.get("unitPrice"))
    disc = _num(item.get("discountAmt"))
    disc_pct = _num(item.get("discountPct"))
    footer_share = _num(item.pop("_footerDisc", 0.0))
    tax_pct = _num(item.get("taxPct"))
    # If LLM explicitly set taxPct=0 for this row, honour it as VAT-exempt (None).
    # Only fall back to 7 when the field was missing/zero AND the doc is taxable.
    item_exempt = "taxPct" in item and tax_pct == 0.0
    effective_tax_type = "None" if item_exempt else tax_type
    if effective_tax_type != "None" and tax_pct == 0.0:
        tax_pct = 7.0
    line_amt_doc = _num(item.get("lineAmt"))

    invoice_amt = _r2(qty * price)
    # lineAmt is already net of this row's own discount; only the document-level
    # share is still outstanding.
    after_disc = _r2((line_amt_doc if line_amt_doc else _r2(invoice_amt - disc)) - footer_share)

    # Restate the discount as the whole-line gap between the printed unit price and
    # what the row actually bills — footer share included. This is the invariant the
    # frontend's recalcRow relies on: qty × unitPrice − discountAmt == after_disc.
    if invoice_amt > 0:
        disc = _r2(invoice_amt - after_disc)
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
    # Use the first non-zero rate across items, not items[0] alone — a leading exempt/None row
    # (taxPct 0) must not drag the deposit row's rate to 0. Mirrors _detect_tax_type.
    tax_pct = next((r for r in (_num(i.get("taxPct")) for i in items) if r > 0), 0.0)
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
    from app.utils.date_parsing import format_doc_date, parse_doc_date

    raw = raw or {}
    items_raw = list(raw.get("items") or [])
    doc_sub = _num(raw.get("docSubTotal"))
    doc_tax = _num(raw.get("docTaxAmount"))
    doc_disc = _num(raw.get("docDiscount"))
    doc_grand = _num(raw.get("docGrandTotal"))
    deposit_pct = _num(raw.get("depositPct"))
    deposit_label = (raw.get("depositLabel") or "").strip()

    items = [dict(i) for i in items_raw if i is not None]

    # Order matters: discount must be resolved before ANY sum is taken. Both
    # _deposit_applies and _detect_tax_type sum qty × unitPrice − discountAmt, so a
    # discount still sitting in a % column inflates that sum and can flip the
    # document's VAT interpretation. See _resolve_line_discount.
    _resolve_line_discount(items)
    _distribute_footer_discount(items, doc_disc)
    # If "มัดจำ X%" is only an informational payment-term note (footer total =
    # full amount), neutralise the deposit so tax-type detection and the deposit
    # row below don't wrongly scale the document down.
    if not _deposit_applies(items, deposit_pct, doc_sub, doc_grand):
        deposit_pct = 0.0
    tax_type, tax_misfit = _detect_tax_type(items, deposit_pct, doc_sub, doc_grand, doc_tax)
    warnings: list[str] = []
    # Neither Include nor Exclude reconciled to the footer, so the winner is a guess.
    # Say so: a wrong guess rescales every line by the VAT rate and the plug below
    # hides the evidence in the last row, which is exactly how invoice 66-0023 shipped
    # a correct grand total over six wrong line amounts.
    if tax_misfit > _TAX_FIT_TOLERANCE:
        warnings.append(_TAX_TYPE_GUESSED_WARNING.format(tax_type=tax_type))
    for item in items:
        _compute_line_totals(item, tax_type)

    # Keep a row that bills nothing but carries a discount (a 100%-discounted free
    # item): dropping it here used to lose both the line and its discount from the
    # totalDiscount sum below, which then tripped the frontend's reconciliation.
    items = [i for i in items if _num(i.get("lineTotal")) != 0 or _num(i.get("discountAmt")) != 0]

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
    # grand to differ from doc_grand by <=0.02, absorb into the last regular
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
            # The penny went into tax, so restate the header tax from the items to keep
            # sum(item.taxAmt) == tax_amount and sub + tax == grand. Otherwise the frontend
            # would see a phantom tax diff and force the user onto the Adjust button.
            # Re-summed rather than shifted by `diff`: when tax_amount was already snapped
            # to doc_tax above, adding diff on top corrects a second time and lands the
            # header a satang below the grand total (invoice 66-0023 did exactly this).
            tax_amount = _r2(sum(_num(i["taxAmt"]) for i in items))

    deposit_amt = _r2(grand_total) if deposit_pct > 0 else 0.0

    raw_date = raw.get("documentDate")
    parsed_date = parse_doc_date(raw_date)
    norm_date = format_doc_date(parsed_date) if parsed_date else raw_date

    return {
        "vendorName": raw.get("vendorName") or "",
        "vendorTaxId": raw.get("vendorTaxId") or "",
        "vendorBranch": raw.get("vendorBranch") or "",
        "documentName": raw.get("documentName") or "",
        "documentDate": norm_date or "",
        "documentNumber": raw.get("documentNumber") or "",
        "taxType": tax_type,
        "depositPct": deposit_pct,
        "depositAmt": deposit_amt,
        "items": items,
        "subTotal": sub_total,
        "taxAmount": tax_amount,
        "totalDiscount": total_discount,
        "grandTotal": grand_total,
        "warnings": warnings,
    }
