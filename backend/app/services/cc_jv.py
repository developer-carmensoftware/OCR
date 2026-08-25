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
"""

from __future__ import annotations

import re
import unicodedata
from datetime import UTC, datetime
from typing import Any

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

# Same three fixed field types the accounting-config service uses; everything else
# in `mappings` is a payment type (splitMappings in useAccountingConfig.ts).
_FIXED_TYPES = ("commission", "tax", "net")


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


def _num(value: str | None) -> float:
    """'10,342.12' → 10342.12. Anything unparseable is 0, as parseNum does."""
    if not value:
        return 0.0
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return 0.0


def _r2(x: float) -> float:
    return round(x + 0.0, 2)


def build_jv_rows(details: list[ExtractedDetailRow], mappings: dict[str, Any]) -> list[dict]:
    """Consolidated layout — the only one any bank uses (GROUP_DEBIT_BY_TRANSACTION=false).

    Credit legs stay one per payment type; the debit side collapses to the three
    canonical buckets, summed. Σdebit == Σcredit as long as every line satisfies
    pay = commission + tax + net, which the extractor guarantees.
    """
    fixed = {k: mappings.get(k, {}) for k in _FIXED_TYPES}
    payment = {k: v for k, v in mappings.items() if k not in _FIXED_TYPES}

    def leg(cfg: dict, desc: str, debit: float, credit: float) -> dict:
        return {
            "dept": (cfg or {}).get("dept", "") or "",
            "acc": (cfg or {}).get("acc", "") or "",
            "desc": desc,
            "debit": debit,
            "credit": credit,
        }

    rows: list[dict] = []
    for d in details:
        amt = _num(d.pay_amt)
        if not amt:
            continue
        # The canonical key is also the description: it is the wording the BU
        # curated, so a misread does not reach their books as a typo.
        pay_type = canonical_payment_type(d.transaction or "UNKNOWN", payment)
        rows.append(leg(payment.get(pay_type, {}), pay_type, 0.0, amt))
    if not rows:
        return rows  # degenerate document — nothing to post

    total = lambda field: _r2(sum(_num(getattr(d, field)) for d in details))  # noqa: E731
    rows.append(leg(fixed["commission"], "Credit card commission", total("commis_amt"), 0.0))
    rows.append(leg(fixed["tax"], "Input Tax", total("tax_amt"), 0.0))
    rows.append(leg(fixed["net"], "Bank Account", total("total"), 0.0))
    return rows


def unmapped_payment_types(
    details: list[ExtractedDetailRow], mappings: dict[str, Any]
) -> list[str]:
    """Payment types on the document that the BU has never mapped to a GL account.

    An LLM-guessed mapping must never post by itself (CARMEN_INTEGRATION.md §4), so
    a non-empty result here parks the document instead of posting it.
    """
    missing = []
    for d in details:
        if not _num(d.pay_amt):
            continue
        pay_type = canonical_payment_type(d.transaction or "UNKNOWN", mappings)
        cfg = mappings.get(pay_type) or {}
        if not (cfg.get("dept") and cfg.get("acc")) and pay_type not in missing:
            missing.append(pay_type)
    for key in _FIXED_TYPES:
        cfg = mappings.get(key) or {}
        if not (cfg.get("dept") and cfg.get("acc")):
            missing.append(key)
    return missing


def build_gljv_payload(
    rows: list[dict],
    *,
    doc_date: str | None,
    bank_code: str | None,
    config: Any,
) -> dict:
    """JV rows + accounting config → the exact body useOcrSubmission.ts posts."""
    from app.services.accounting_config_service import description_for

    # Per-bank wording when the BU set one, else the BU's single description — the
    # input-tax record built from the same statement resolves it the same way, so
    # the two documents never disagree about what they are.
    base = description_for(config, bank_code)
    description = ""
    if base:
        description = f"{base} - {doc_date}" if doc_date else base

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
                "CrAmount": _r2(r["credit"]),
                "CrBase": _r2(r["credit"]),
                "DrAmount": _r2(r["debit"]),
                "DrBase": _r2(r["debit"]),
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
