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
from app.services.cc_jv import num, r2

logger = logging.getLogger(__name__)

# What the frontend calls `resolveTaxProfileForRate`: a profile matches when its
# declared rate is the document's, within a hair.
_RATE_TOLERANCE = 0.01

# A tax invoice that states no branch was issued by the head office, and the Revenue
# Department's code for that is "00000" — so this is the printed convention, not a guess
# standing in for a fact nobody read. Which is why branch is not a refusal the way the
# vendor's name and tax ID are: those have no correct default, and this one does.
_HEAD_OFFICE = "00000"


def _clean(value: Any) -> str:
    """A trimmed string, or `''` — the only two things worth testing for.

    Every identity field on this record reaches Carmen verbatim, and Carmen treats a field
    of spaces as the empty field it rejects the record for. Whitespace is therefore absence,
    both for the refusals below and for the values that get posted.
    """
    return str(value).strip() if value is not None else ""


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
    vendor_name: str | None = None,
    tax_id: str | None = None,
    profile_code: str | None = None,
) -> tuple[dict | None, str | None]:
    """(payload, reason it was skipped) — exactly one of the two is ever set.

    A partial record is never returned. A wrong tax period files the claim in the
    wrong month and a guessed rate misstates it; both are things someone has to go
    and correct in Carmen, which is worse than the record that was never created.

    The reason is returned rather than only logged because a skip that nobody sees
    is a VAT claim quietly lost — the caller puts it on the ledger. `None, None`
    means there was genuinely nothing to claim, which needs no announcement.

    The reason opens "Input tax not recorded" because it goes on screen unedited, in the
    same cell as `_post_input_tax`'s own failure note — see that docstring for why the two
    share one prefix rather than each inventing its own.

    The last three arguments are the review screen's corrections, and they are what
    turns two of those skips into a record: a bank with no registered identity and a
    document at a rate no profile declares are both dead ends for the machine and one
    field for a human. Deliberately narrow — the amounts still come from `details`, the
    period still comes from the document date, and a named profile's rate and wording are
    still read back from Carmen's own list. A browser may say *which* profile; it may
    never define one.
    """
    net = r2(sum(num(d.commis_amt) for d in details))
    tax = r2(sum(num(d.tax_amt) for d in details))
    if tax <= 0 or net <= 0:
        return None, None  # no VAT on this document — nothing was lost

    # The month the claim is filed in is the document's own, and deliberately not a field:
    # it is a fact about the statement, and the document date two fields up is where a
    # misread one is corrected.
    parts = _iso_parts(doc_date)
    if parts is None:
        return None, f"Input tax not recorded: document date {doc_date!r} has no readable day"
    year, month = parts

    # Both halves of the vendor's identity, and both are refusals. Carmen accepts a record
    # with `TaxId: ""` and rejects it silently afterwards, which is the failure mode this
    # module exists to avoid — see the incident note in InputTaxReconciliation.tsx, whose
    # Submit button has blocked on the same pair since. `""` here was the one field left
    # that could still reach Carmen empty.
    # Stripped before it is tested, or a typed space passes the guard and reaches Carmen as
    # the empty field the guard exists to stop. The review screen's own check trims for the
    # same reason; this is the one both paths cross.
    legal_name = _clean(vendor_name) or _clean(
        getattr(bank, "legal_name", None) if bank is not None else None
    )
    vendor_tax_id = _clean(tax_id) or _clean(getattr(bank, "tax_id", None))
    if not legal_name or not vendor_tax_id:
        code = getattr(bank, "code", None) or "?"
        what = "name" if not legal_name else "tax ID"
        return None, f"Input tax not recorded: bank {code} has no registered {what} on file"

    # The profile's canonical rate is what we post, but the document's own VAT amount
    # is what we claim: a slightly-off extracted figure must not silently become
    # "7% of net" in the books. Unmatched rate ⇒ the document is not standard-rated,
    # so there is no profile to file it under — unless a reviewer names one, which is
    # the answer to exactly that question.
    ratio = round(tax / net * 100, 2)
    profiles = _profiles(tax_profiles_raw)
    if profile_code:
        profile = next((p for p in profiles if p["code"] == profile_code), None)
        if profile is None:
            return None, f"Input tax not recorded: no active tax profile {profile_code!r}"
    else:
        profile = resolve_tax_profile(ratio, profiles)
        if profile is None:
            return None, f"Input tax not recorded: no active tax profile at {ratio:.2f}%"
    # Carmen lists a profile without a declared rate now and then. Resolution by rate can
    # never return one; a named one can, and the document's own ratio is the only honest
    # figure left to post.
    rate = profile["rate"] if profile["rate"] is not None else ratio

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
        "TaxRate": rate,
        "TaxAmt": tax,
        "TotalAmt": f"{r2(net + tax):.2f}",
        "TaxId": vendor_tax_id,
        "BranchNo": _clean(branch) or _HEAD_OFFICE,
        "Address": getattr(bank, "address", None) or "",
        # ponytail: the wizard hardcodes "admin" here. Marking the machine-posted
        # ones the way build_gljv_payload does needs Carmen to confirm the field is
        # free-form first — same open question as UserModified on the JV.
        "UserModified": "OCR-EMAIL",
        "TaxProfileDesc": profile["desc"],
        "VnCode": "",
    }
    return payload, None
