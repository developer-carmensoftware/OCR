"""Credit-card input-tax (ACTX) builder — server-side twin of
frontend/src/components/credit-card/InputTaxReconciliation.tsx.

A statement produces two Carmen documents, not one: the GLJV, then an input-tax
record claiming the VAT the bank charged. The wizard does the second on step 4
with a human looking at it; email automation has no step 4, so the same arithmetic
lives here.

Kept deliberately in step with InputTaxReconciliation.tsx. `test_cc_input_tax.py`
pins the arithmetic and the date/prefix derivation.
"""

from __future__ import annotations

import calendar
import logging
from datetime import UTC, datetime
from typing import Any

from app.models.schemas import ExtractedDetailRow
from app.services.cc_jv import _num, _r2

logger = logging.getLogger(__name__)

# What the frontend calls `resolveTaxProfileForRate`: a profile matches when its
# declared rate is the document's, within a hair.
_RATE_TOLERANCE = 0.01


def _profiles(raw: Any) -> list[dict]:
    """Carmen's tax-profile list → [{code, desc, rate}].

    Same normalisation as `fetchTaxProfiles` in frontend/src/lib/api/carmen.ts,
    including dropping inactive profiles — filing against a retired one is the kind
    of thing nobody notices until the VAT return.
    """
    rows = raw.get("Data") if isinstance(raw, dict) else raw
    out = []
    for p in rows or []:
        if not isinstance(p, dict) or p.get("Active") is False:
            continue
        code = str(p.get("Code") or "")
        if not code:
            continue
        try:
            rate = float(p["TaxRate"]) if p.get("TaxRate") is not None else None
        except (TypeError, ValueError):
            rate = None
        out.append({"code": code, "desc": str(p.get("Description") or ""), "rate": rate})
    return out


def resolve_tax_profile(rate: float, profiles: list[dict]) -> dict | None:
    """The profile whose declared rate is this document's, or None."""
    for p in profiles:
        if p["rate"] is not None and abs(p["rate"] - rate) < _RATE_TOLERANCE:
            return p
    return None


def _iso_parts(doc_date: str | None) -> tuple[str, str] | None:
    """'DD/MM/YYYY' (CE or BE) → (YYYY, MM). None when unusable."""
    if not doc_date:
        return None
    try:
        day, month, year = doc_date.split("/")
        y = int(year)
        if y > 2400:  # Buddhist era
            y -= 543
        datetime(y, int(month), int(day), tzinfo=UTC)  # validates the whole date
        return f"{y:04d}", f"{int(month):02d}"
    except (ValueError, TypeError):
        return None


def build_input_tax_payload(
    details: list[ExtractedDetailRow],
    *,
    doc_no: str | None,
    doc_date: str | None,
    bank: Any,
    branch: str | None,
    description: str | None,
    tax_profiles_raw: Any,
) -> tuple[dict | None, str | None]:
    """(payload, reason it was skipped) — exactly one of the two is ever set.

    A partial record is never returned. A wrong tax period files the claim in the
    wrong month and a guessed rate misstates it; both are things someone has to go
    and correct in Carmen, which is worse than the record that was never created.

    The reason is returned rather than only logged because a skip that nobody sees
    is a VAT claim quietly lost — the caller puts it on the ledger. `None, None`
    means there was genuinely nothing to claim, which needs no announcement.
    """
    net = _r2(sum(_num(d.commis_amt) for d in details))
    tax = _r2(sum(_num(d.tax_amt) for d in details))
    if tax <= 0 or net <= 0:
        return None, None  # no VAT on this document — nothing was lost

    parts = _iso_parts(doc_date)
    if parts is None:
        return None, f"input tax skipped: document date {doc_date!r} has no readable day"
    year, month = parts

    legal_name = getattr(bank, "legal_name", None) if bank is not None else None
    if not legal_name:
        code = getattr(bank, "code", None) or "?"
        return None, f"input tax skipped: bank {code} has no registered identity on file"

    # The profile's canonical rate is what we post, but the document's own VAT amount
    # is what we claim: a slightly-off extracted figure must not silently become
    # "7% of net" in the books. Unmatched rate ⇒ the document is not standard-rated,
    # so there is no profile to file it under.
    ratio = round(tax / net * 100, 2)
    profile = resolve_tax_profile(ratio, _profiles(tax_profiles_raw))
    if profile is None:
        return None, f"input tax skipped: no active tax profile at {ratio:.2f}%"

    last_day = calendar.monthrange(int(year), int(month))[1]
    day, mon, yr = (doc_date or "//").split("/")

    payload = {
        "Prefix": f"vat{year}{month}",
        "Source": "ACTX",
        "FrDate": f"{year}-{month}-01",
        "ToDate": f"{year}-{month}-{last_day:02d}",
        "InvhTInvNo": doc_no or "",
        "InvhTInvDt": f"{year}-{mon.zfill(2)}-{day.zfill(2)}T00:00:00.000Z",
        "InvhDesc": f"{description} - {doc_date}" if description else "",
        "VnName": legal_name,
        "TaxProfileCode": profile["code"],
        "BfTaxAmt": f"{net:.2f}",
        "TaxRate": profile["rate"],
        "TaxAmt": tax,
        "TotalAmt": f"{_r2(net + tax):.2f}",
        "TaxId": getattr(bank, "tax_id", None) or "",
        "BranchNo": branch or "",
        "Address": getattr(bank, "address", None) or "",
        # ponytail: the wizard hardcodes "admin" here. Marking the machine-posted
        # ones the way build_gljv_payload does needs Carmen to confirm the field is
        # free-form first — same open question as UserModified on the JV.
        "UserModified": "OCR-EMAIL",
        "TaxProfileDesc": profile["desc"],
        "VnCode": "",
    }
    return payload, None
