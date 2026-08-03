"""Credit-card JV builder — server-side twin of frontend/src/lib/ccJv.ts.

The wizard builds its JV in the browser because a human is reviewing it there.
Email automation has no browser, so the same two steps live here: detail rows +
accounting config → JV rows → the Carmen `gljv` body.

Kept deliberately in step with ccJv.ts + useOcrSubmission.ts. If the consolidated
layout changes there, change it here — test_cc_jv.py pins the arithmetic.
"""

from __future__ import annotations

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
        pay_type = d.transaction or "UNKNOWN"
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
        pay_type = d.transaction or "UNKNOWN"
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
    description = ""
    if config.description:
        description = f"{config.description} - {doc_date}" if doc_date else config.description

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
