"""Credit-card JV builder — server-side twin of frontend/src/lib/ccJv.ts.

The wizard builds its JV in the browser because a human is reviewing it there.
Email automation has no browser, so the same two steps live here: detail rows +
accounting config → JV rows → the Carmen `gljv` body.

Kept deliberately in step with ccJv.ts + useOcrSubmission.ts. If the consolidated
layout changes there, change it here — test_cc_jv.py pins the arithmetic, and
`contracts/cc-jv.contract.json` pins this body so the two can no longer drift
silently: each side is asserted against that one file, so changing a field here
reddens THIS suite (and changing ccJv.ts reddens the frontend one). The fix is to
change both implementations, not to edit the contract to match one of them.

Also the settlement-report builder for Detailed Credit Card AR Reconciliation
(formerly app/services/ar_reconcile_jv.py, folded in here 2026-09-22). Decision #28
(docs/email-automation/06-decision-log.md) made a settlement JV's debit side identical
to a fee invoice's — both read the BU's commission/tax/net mapping, from the same
dict — which left the two builders differing in exactly two places: where the debit
figures come from (`total_row`, a single anchor row a settlement report prints, vs
summed across every `details` row — a document-layout fact, not a feature) and how the
credit side groups (`group_key`'s Detail/Summary split — a user option). Everything
else — the payload shape, the balance check, the description template — was already
one implementation reached from two call sites. `build_jv_rows`'s `total_row=` and
`grouping=` keyword arguments are that fact and that option, spelled out; their
defaults reproduce the original fee-invoice behaviour exactly, which is what lets
`test_contract_fixture` below keep pinning the browser twin unchanged.

The browser twin (ccJv.ts) covers only the default branch. A settlement report has no
wizard path — email ingest is its only poster (decision #4) — so nothing on the
frontend ever needs the `grouping` branch to exist, and ccJv.ts stays exactly as it
was before this merge.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from app.constants import PostType
from app.models.schemas import ExtractedDetailRow

# Bank code → Carmen GL source. Mirrors BANK_SOURCE_MAP in frontend/src/constants/banks.ts.
BANK_SOURCE_MAP: dict[str, str] = {
    "BBL": "ACBB",
    "KBANK": "ACKB",
    "SCB": "ACSC",
    "BAY": "ACBY",
    "KTC": "ACKC",
    "GHL": "ACGH",
    "PAYPAL": "ACPP",
    "SIAMPAY": "ACSP",
}

# Same three fixed field types the accounting-config service uses; everything else in
# `mappings` is a payment type (splitMappings in useAccountingConfig.ts) — including,
# since the settlement-report merge, a settlement report's own credit-side keys. They
# all live in the same dict now (bu_accounting_mapping_entries), distinguished only by
# an informational `source` column the JV builder never reads.
_FIXED_TYPES = ("commission", "tax", "net")

# Rounding floor for the double-entry check a settlement JV runs (`is_balanced`). NFR
# §9.4 says tolerance 0.00, and this is how that is spelled once floats are involved:
# anything at or under half a satang is the representation, anything above it is a
# real imbalance.
BALANCE_EPSILON = 0.005


def _fold(text: str) -> str:
    """Drop the differences the extractor invents, keep the ones that carry meaning.

    Thai vowel and tone marks are separate combining code points, so a model that
    misses one produces a string that is visually near-identical but compares
    unequal ('ค่าบริการ' vs 'คาบริการ'). Those marks, spacing and case are folded
    away; letters and DIGITS are not — this BU really has both
    '04-4100-03 SiamPay …' and '04-4100-04 SiamPay …', which are different payment
    types one character apart, and no amount of OCR noise may merge them.
    """
    text = unicodedata.normalize("NFC", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip().casefold()


def canonical_payment_type(pay_type: str, mappings: dict[str, Any]) -> str:
    """The saved mapping key `pay_type` refers to, or `pay_type` unchanged.

    An exact hit always wins. Only when there is none do we retry on the folded
    form, so a dropped vowel mark does not park a document whose payment type the
    BU mapped months ago. Ambiguity is never resolved by guessing: if the folded
    form matches more than one saved key the original is returned and the document
    parks, which is the safe direction to fail on a money path.
    """
    if pay_type in mappings:
        return pay_type
    folded = _fold(pay_type)
    hits = [k for k in mappings if k not in _FIXED_TYPES and _fold(k) == folded]
    return hits[0] if len(hits) == 1 else pay_type


def num(value: str | None) -> float:
    """'10,342.12' → 10342.12. Anything unparseable is 0, as parseNum does."""
    if not value:
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return 0.0


def r2(x: float) -> float:
    return round(x + 0.0, 2)


def group_key(payment_type: str, post_type: str) -> str:
    """The mapping key a printed settlement-report payment type resolves to.

    Detail keeps the label as printed. Summary takes its first token, which is how KBANK
    writes the scheme: `VS INTER UP PREM` → `VS`, `MC INTER UP PREM` → `MC`, `JCB PREM`
    → `JCB`. A scheme nobody has seen before (`AMEX PREM` → `AMEX`) therefore becomes its
    own unmapped key and parks the document rather than quietly joining another group.

    The one algorithm every settlement layout uses today — `banks.settlement_grouping`
    marks *whether* a bank has one, not *which* rule, so there is nothing here to
    dispatch on until a second bank needs a different fold.
    """
    label = (payment_type or "").strip()
    if post_type != PostType.SUMMARY:
        return label
    return label.split(" ", 1)[0] if label else label


def build_jv_rows(
    details: list[ExtractedDetailRow],
    mappings: dict[str, Any],
    *,
    total_row: ExtractedDetailRow | None = None,
    grouping: Callable[[str], str] | None = None,
    doc_no: str | None = None,
) -> list[dict]:
    """Three fixed debit legs (commission / input tax / bank account) + one credit leg
    per payment type or group.

    Two independent branches, selected by whether a `grouping` function is given:

    **Fee invoice (`grouping=None`, the consolidated layout — the only one any bank
    uses, GROUP_DEBIT_BY_TRANSACTION=false):** one credit leg per detail row, matched
    to a saved mapping key via `canonical_payment_type` (fold-tolerant); the three
    debit legs sum `commis_amt` / `tax_amt` / `total` across every row. Σdebit ==
    Σcredit as long as every line satisfies pay = commission + tax + net, which the
    extractor guarantees.

    **Settlement report (`grouping` given, e.g. `lambda label: group_key(label,
    post_type)`):** one credit leg per *grouped* scheme (Detail keeps each printed
    label, Summary folds them — see `group_key`), looked up by plain dict key with no
    fold-matching (a settlement report's vocabulary is small and BU-curated, unlike a
    fee invoice's free-text transaction description). The three debit legs read
    `total_row`'s COMM AMT / VAT AMT / NET AMT instead of summing `details` — a
    settlement report's per-payment-type rows print those three columns as dashes
    (`_normalize_ar_settlement` in credit_card_service.py is where the anchor is read
    and kept as `extracted.total_row`). `total_row=None` (the anchor was missing or
    unreadable) posts zero on all three; `_normalize_ar_settlement` already warned, so
    the document is parked before this matters, but the arithmetic itself never
    guesses a figure that was not printed. A group whose total is negative (a refund
    or chargeback settling on the same report, FRD §8 case 5) swaps sides and posts
    its absolute value, so the entry stays a reclassification in the right direction
    instead of a negative credit Carmen would reject. `doc_no`, when given, prefixes
    every credit leg's description (`Tax Inv.# <doc_no> - <label>`) — the tax invoice
    number the settlement report and its (former) sibling fee invoice share.

    Every leg carries a `key` — the group it posts under, empty on all three debit
    legs since none of them is a printed payment type. The review screen joins printed
    lines back to legs on this rather than re-deriving the grouping or slicing the
    `Tax Inv.# … - ` prefix back off `desc` (`ARReviewPane.tsx`).
    """
    fixed = {k: mappings.get(k, {}) for k in _FIXED_TYPES}

    def leg(cfg: dict | None, desc: str, debit: float, credit: float, key: str = "") -> dict:
        return {
            "dept": (cfg or {}).get("dept", "") or "",
            "acc": (cfg or {}).get("acc", "") or "",
            "desc": desc,
            "debit": debit,
            "credit": credit,
            "key": key,
        }

    if grouping is None:
        payment = {k: v for k, v in mappings.items() if k not in _FIXED_TYPES}
        rows: list[dict] = []
        for d in details:
            amt = num(d.pay_amt)
            if not amt:
                continue
            # The canonical key is also the description: it is the wording the BU
            # curated, so a misread does not reach their books as a typo.
            pay_type = canonical_payment_type(d.transaction or "UNKNOWN", payment)
            rows.append(leg(payment.get(pay_type, {}), pay_type, 0.0, amt))
        if not rows:
            return rows  # degenerate document — nothing to post

        total = lambda field: r2(sum(num(getattr(d, field)) for d in details))  # noqa: E731
        rows.append(leg(fixed["commission"], "Credit card commission", total("commis_amt"), 0.0))
        rows.append(leg(fixed["tax"], "Input Tax", total("tax_amt"), 0.0))
        rows.append(leg(fixed["net"], "Bank Account", total("total"), 0.0))
        return rows

    tax_inv = (doc_no or "").strip()
    prefix = f"Tax Inv.# {tax_inv} - " if tax_inv else ""

    grouped: dict[str, float] = {}
    for d in details:
        amt = num(d.pay_amt)
        if not amt:
            continue
        key = grouping(d.transaction or "UNKNOWN")
        grouped[key] = grouped.get(key, 0.0) + amt
    if not grouped:
        return []

    def anchor_amt(field: str) -> float:
        # ponytail: posted straight into "debit" with no sign flip for a negative
        # figure — matches the fee-invoice branch's own commission/tax/net legs above,
        # which have the same gap today. A settlement day negative enough to print a
        # negative COMM/VAT/NET would need the same fix in both branches at once; out
        # of scope here.
        return r2(num(getattr(total_row, field, None))) if total_row is not None else 0.0

    # Credit legs first, the three fixed debit legs last — same order as the fee-invoice branch.
    rows = []
    for key, raw in grouped.items():
        cfg = mappings.get(key) or {}
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
    rows += [
        leg(fixed["commission"], "Credit card commission", anchor_amt("commis_amt"), 0.0),
        leg(fixed["tax"], "Input Tax", anchor_amt("tax_amt"), 0.0),
        leg(fixed["net"], "Bank Account", anchor_amt("total"), 0.0),
    ]
    return rows


def unmapped_payment_types(
    details: list[ExtractedDetailRow],
    mappings: dict[str, Any],
    *,
    grouping: Callable[[str], str] | None = None,
) -> list[str]:
    """Payment types or groups on the document that the BU has never mapped to a GL
    account, plus the three fixed buckets, checked unconditionally.

    An LLM-guessed mapping must never post by itself (CARMEN_INTEGRATION.md §4), so a
    non-empty result here parks the document instead of posting it — the same rule for
    both branches below, which is why one function covers them (merged from
    `unmapped_ar_types` in the pre-2026-09-22 `ar_reconcile_jv.py`).

    `grouping=None` (fee invoice) resolves each row through `canonical_payment_type`'s
    fold-tolerant match; a `grouping` function (settlement report) resolves it through
    plain dict lookup on the grouped key instead — see `build_jv_rows`'s docstring for
    why the two differ. The three fixed keys are a structural requirement of every JV
    this builder produces, not something that only matters when a row happens to be
    non-zero, so both branches check them the same way.
    """
    missing: list[str] = []
    for d in details:
        if not num(d.pay_amt):
            continue
        label = d.transaction or "UNKNOWN"
        pay_type = grouping(label) if grouping else canonical_payment_type(label, mappings)
        cfg = mappings.get(pay_type) or {}
        if not (cfg.get("dept") and cfg.get("acc")) and pay_type not in missing:
            missing.append(pay_type)
    for key in _FIXED_TYPES:
        cfg = mappings.get(key) or {}
        if not (cfg.get("dept") and cfg.get("acc")):
            missing.append(key)
    return missing


def is_balanced(rows: list[dict]) -> bool:
    """Σ debit vs Σ credit.

    For a settlement report this is a real check, not a tautology: since decision #28
    (2026-09-18) the debit side comes from `total_row` — the report's own anchor row —
    while the credit side comes from grouping the report's per-payment-type rows, two
    independent readings of the same page that can genuinely disagree. Before that, the
    debit leg was derived from the sum of the very credit rows it was compared against,
    which could never return False for this builder's own output. `_review_flags`'
    `ar_unbalanced` and `approve_document`'s own gate both read this now.
    """
    debit = sum(r["debit"] for r in rows)
    credit = sum(r["credit"] for r in rows)
    return abs(debit - credit) <= BALANCE_EPSILON


_TEMPLATE_TAGS = ("{Settlement_Date}", "{Tax_Invoice_No}", "{Bank_Name}")


def _has_template_tags(s: str) -> bool:
    return any(tag in s for tag in _TEMPLATE_TAGS)


def render_jv_description(
    template: str,
    *,
    settlement_date: str | None,
    tax_invoice_no: str | None,
    bank_name: str | None,
) -> str:
    """Fill a JV description template's three tags. An unset tag renders empty, not as
    itself. Low-level: callers that have a saved description string rather than a
    known-good template should go through `render_description` below, which decides
    whether this function even applies."""
    out = template or ""
    for tag, value in zip(_TEMPLATE_TAGS, (settlement_date, tax_invoice_no, bank_name)):
        out = out.replace(tag, value or "")
    return " ".join(out.split())


def render_description(
    base: str | None,
    *,
    doc_date: str | None,
    doc_no: str | None,
    bank_name: str | None,
) -> str:
    """The one decision point both the fee-invoice default and the settlement JV share
    (folded into one mechanism 2026-09-22 — previously the fee-invoice path only ever
    did the plain-concatenation branch below, and settlement only ever did the
    template branch, as two separate functions).

    A saved value containing one of the three template tags is treated as a full
    template (`render_jv_description`) and the date is not additionally appended — the
    tag is the BU's own opt-in to control exactly where it lands. A plain value with no
    tag keeps the original fee-invoice behaviour verbatim: `base - doc_date`. This is
    what makes the merge backward-compatible — every saved description that predates
    the tags renders identically to before.
    """
    if not base:
        return ""
    if _has_template_tags(base):
        return render_jv_description(
            base, settlement_date=doc_date, tax_invoice_no=doc_no, bank_name=bank_name
        )
    return f"{base} - {doc_date}" if doc_date else base


def resolve_jv_description(
    config: Any,
    bank_code: str | None,
    *,
    doc_date: str | None,
    doc_no: str | None,
) -> str:
    """`render_description` starting from the BU's saved per-bank/BU-wide wording
    (`description_for`) rather than a caller-supplied string — what
    `build_gljv_payload` falls back to, and what a settlement JV resolves to now that
    it reads the same field the fee-invoice path always has (Ticket D, 2026-09-22)."""
    from app.services.credit_card.accounting_config import description_for

    return render_description(
        description_for(config, bank_code), doc_date=doc_date, doc_no=doc_no, bank_name=bank_code
    )


def build_gljv_payload(
    rows: list[dict],
    *,
    doc_date: str | None,
    bank_code: str | None,
    config: Any,
    doc_no: str | None = None,
    description: str | None = None,
) -> dict:
    """JV rows + accounting config → the exact body useOcrSubmission.ts posts.

    `description` overrides the config-derived wording — a caller that already rendered
    its own (e.g. `credit_card.ar_reconcile.jv_for_document`, whose result the review screen
    displays and must match exactly) passes it here rather than letting this function
    re-derive it. Every other caller leaves it `None` and gets `resolve_jv_description`.
    """
    if description is None:
        description = resolve_jv_description(config, bank_code, doc_date=doc_date, doc_no=doc_no)

    return {
        "JvhSeq": -1,
        "JvhDate": _jvh_date(doc_date),
        "Prefix": config.file_prefix or "",
        "JvhNo": "Auto",
        # Source follows the scanned bank (single authority), config only as fallback.
        "JvhSource": (BANK_SOURCE_MAP.get(bank_code or "") or config.file_source or ""),
        "Status": "Draft",
        "Description": description,
        "Detail": [
            {
                "JvhSeq": -1,
                "JvdSeq": -1,
                "DeptCode": r["dept"],
                "AccCode": r["acc"],
                "Description": r["desc"],
                "CurCode": "THB",
                "CurRate": 1,
                "CrAmount": r2(r["credit"]),
                "CrBase": r2(r["credit"]),
                "DrAmount": r2(r["debit"]),
                "DrBase": r2(r["debit"]),
                "DimList": {},
            }
            # Display-only zero legs (a gateway invoice's net=0) never reach Carmen.
            for r in rows
            if r["debit"] or r["credit"]
        ],
        "DimHList": {"Dim": []},
        # ponytail: marks the JV as machine-posted so accounting can tell it from a
        # wizard submit (CARMEN_INTEGRATION.md §4 point 3). Carmen may want a
        # different field — one string to change if so.
        "UserModified": "OCR-EMAIL",
    }


def _jvh_date(doc_date: str | None) -> str:
    """'DD/MM/YYYY' (CE or BE) → ISO-8601. Falls back to now, as the wizard does."""
    if doc_date:
        try:
            day, month, year = doc_date.split("/")
            y = int(year)
            if y > 2400:  # Buddhist era
                y -= 543
            return datetime(y, int(month), int(day), tzinfo=UTC).isoformat()
        except (ValueError, TypeError):
            pass
    return datetime.now(UTC).isoformat()
