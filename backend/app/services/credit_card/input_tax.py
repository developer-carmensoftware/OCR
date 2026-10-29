"""Credit-card input-tax (ACTX) builder — server-side twin of
frontend/src/components/credit-card/InputTaxReconciliation.tsx.

A statement produces two Carmen documents, not one: the GLJV, then an input-tax
record claiming the VAT the bank charged. The wizard does the second on step 4
with a human looking at it; email automation has no step 4, so the same arithmetic
lives here.

Kept deliberately in step with InputTaxReconciliation.tsx. `test_cc_input_tax.py`
pins the arithmetic and the date/prefix derivation.

`file_input_tax_for_card` is the third caller: a posted JV whose record never followed —
the wizard's step 4 died or was skipped, an email reviewer unticked the box, or the filing
was refused — filed afterwards from the activity table out of the two sums stamped on the
card with the JV (CA-111). `mark_input_tax_keyed` is the other way to settle it.
"""

from __future__ import annotations

import calendar
import logging
import uuid
from datetime import UTC, date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import CarmenServiceError, ConflictError, NotFoundError, ValidationError
from app.models.business import CreditCard
from app.models.catalog import Bank
from app.models.email_automation import EmailDocument
from app.models.schemas import ExtractedDetailRow
from app.services.credit_card.accounting_config import description_for, get_accounting_config
from app.services.credit_card.jv import num, r2, render_description
from app.services.shared import carmen

logger = logging.getLogger(__name__)

# What the frontend calls `resolveTaxProfileForRate`: a profile matches when its
# declared rate is the document's, within a hair.
_RATE_TOLERANCE = 0.01

# A tax invoice that states no branch was issued by the head office, and the Revenue
# Department's code for that is "00000" — so this is the printed convention, not a guess
# standing in for a fact nobody read. Which is why branch is not a refusal the way the
# vendor's name and tax ID are: those have no correct default, and this one does.
_HEAD_OFFICE = "00000"

# Input tax not claimed in the month the tax invoice names may be claimed in a later month,
# up to six after it (Revenue Code s.82/3) — the window a late filing can choose from.
_CLAIM_MONTHS = 6
# The month a claim is filed in is Thailand's. Same value as `activity.ICT`, copied rather
# than imported: activity.py imports this module.
_ICT = timezone(timedelta(hours=7))


def _now() -> datetime:
    """The clock the claim window is measured against — patched in tests."""
    return datetime.now(UTC)


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


def input_tax_sums(details: list[ExtractedDetailRow]) -> tuple[float, float]:
    """(Σ commission before VAT, Σ VAT) — the record's base and tax, and the two sums
    stamped on the card so it can still be filed after the extraction is gone."""
    return r2(sum(num(d.commis_amt) for d in details)), r2(sum(num(d.tax_amt) for d in details))


def claim_periods(doc_date: date | None, now: datetime) -> list[str]:
    """The months ("YYYY-MM", oldest first) a claim for this document may still be filed in.

    From the document's own month to six after it, but never past the current Thai month —
    a period that has not started cannot be filed into. A document dated in the future has
    only its own month. Empty when the window has closed, or when there is no date to
    measure it from.
    """
    if doc_date is None:
        return []
    today = now.astimezone(_ICT)
    first = doc_date.year * 12 + doc_date.month - 1
    current = today.year * 12 + today.month - 1
    if current > first + _CLAIM_MONTHS:
        return []
    last = max(first, min(first + _CLAIM_MONTHS, current))
    return [f"{m // 12:04d}-{m % 12 + 1:02d}" for m in range(first, last + 1)]


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
    period: tuple[str, str] | None = None,
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

    `period` (YYYY, MM) is the one exception to "the period is the document's": a claim
    filed late (`file_input_tax_for_card`) may land in a later month of the claim window.
    It moves only the period — the tax invoice date stays the document's.
    """
    net, tax = input_tax_sums(details)
    if tax <= 0 or net <= 0:
        return None, None  # no VAT on this document — nothing was lost

    # The month the claim is filed in is the document's own, and deliberately not a field:
    # it is a fact about the statement, and the document date two fields up is where a
    # misread one is corrected. Filing late is the exception, and the caller checks it.
    parts = _iso_parts(doc_date)
    if parts is None:
        return None, f"Input tax not recorded: document date {doc_date!r} has no readable day"
    doc_year = parts[0]
    year, month = period or parts

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
        "InvhTInvDt": f"{doc_year}-{mon.zfill(2)}-{day.zfill(2)}T00:00:00.000Z",
        # The JV's own rendering, so the two records from one statement read the same —
        # this used to append the date itself and post any `{Tag}` raw.
        "InvhDesc": render_description(
            description, doc_date=doc_date, doc_no=doc_no, bank_name=getattr(bank, "code", None)
        ),
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


def owes_input_tax(card: Any) -> bool:
    """A posted JV that carried VAT and whose input-tax record never followed.

    The queue's "input tax not recorded" note and the wizard's restore prompt both ask
    this, so it is said once. A card posted before `tax_amt` was stamped owes nothing we
    can name.
    """
    return bool(
        card.submitted_at is not None and (card.tax_amt or 0) > 0 and card.input_tax_at is None
    )


async def _live_card(
    db: AsyncSession, tenant_id: uuid.UUID, card_id: uuid.UUID, *, lock: bool = False
) -> Any:
    """This BU's card unless deleted, else `NotFoundError`. One rule for which card a BU may
    act on, shared by the GET that answers "owed" and the POST that files it, so the two can
    never disagree. `lock` holds it FOR UPDATE until the session closes."""
    stmt = select(CreditCard).where(
        CreditCard.id == card_id,
        CreditCard.tenant_id == tenant_id,
        CreditCard.deleted_at.is_(None),
    )
    card = (await db.execute(stmt.with_for_update() if lock else stmt)).scalar_one_or_none()
    if card is None:
        raise NotFoundError("Document not found")
    return card


def _assert_owed(card: Any) -> None:
    """The refusals every way of resolving a card's input tax shares — filing it, or marking
    it keyed by hand. Each is a 409: nothing is wrong with the request, there is just nothing
    left to resolve."""
    if card.submitted_at is None:
        raise ConflictError("This document's JV has not been posted to Carmen")
    if card.input_tax_at is not None:
        raise ConflictError("The input tax for this document has already been recorded")
    if card.tax_amt is None:
        # Posted before the sums were stored — there is nothing to build the record from.
        raise ConflictError("This document predates input-tax tracking; key it in Carmen")


async def _resolve(
    db: AsyncSession, tenant_id: uuid.UUID, card: Any, user_id: str | None, *, keyed: bool
) -> None:
    """Stamp the card resolved and commit.

    Also clears the note on the posted email row this card came from, if any: on a posted
    row `error_message` only ever holds "Input tax not recorded …", and leaving it would keep
    saying so beside a record that is now there. No-op for a manual scan, which has no row.
    """
    card.input_tax_at = datetime.now(UTC)
    card.input_tax_by = user_id
    card.input_tax_keyed = keyed
    await db.execute(
        update(EmailDocument)
        .where(
            EmailDocument.tenant_id == tenant_id,
            EmailDocument.task_id == card.task_id,
            EmailDocument.status == "posted",
        )
        .values(error_message=None)
    )
    await db.commit()


async def file_input_tax_for_card(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    card_id: uuid.UUID,
    carmen_token: str,
    *,
    user_id: str | None = None,
    overrides: Any = None,
) -> None:
    """File the ACTX a posted card still owes — a manual scan or an email document — and
    stamp it resolved.

    The card is locked FOR UPDATE through the Carmen call, as `proxy_gljv` does, so two
    presses serialize and the second is refused rather than filing twice.

    The amounts come from the card, never from a browser: the two sums were stamped with the
    JV. `overrides` (`LateInputTaxIn`) carries what the late dialog lets a person correct —
    vendor, tax ID, profile, branch, the same as the approve panel — and the period, which
    must be one `claim_periods` still offers. A reason `build_input_tax_payload` refuses on
    is raised as it stands — it opens "Input tax not recorded" and names what is missing.
    """
    card = await _live_card(db, tenant_id, card_id, lock=True)
    _assert_owed(card)

    periods = claim_periods(card.doc_date, _now())
    if card.doc_date is not None and not periods:
        raise ValidationError("Past the 6-month input-tax claim window — key it in Carmen")
    period = getattr(overrides, "period", None) or (periods[0] if periods else None)
    if period is not None and period not in periods:
        raise ValidationError(f"Tax period {period} is outside this document's claim window")

    bank_code: str | None = card.bank_code  # type: ignore[assignment]
    config = await get_accounting_config(db, str(tenant_id), bank_code)
    bank = await db.get(Bank, bank_code) if bank_code else None
    try:
        profiles = await carmen.get_tax_profiles(carmen_token)
    except carmen.CarmenAPIError as e:
        raise CarmenServiceError(f"Carmen tax profiles: {e.detail}") from e

    payload, skipped = build_input_tax_payload(
        [ExtractedDetailRow(commis_amt=str(card.commis_amt or 0), tax_amt=str(card.tax_amt))],
        doc_no=card.doc_no,  # type: ignore[arg-type]
        doc_date=card.doc_date.strftime("%d/%m/%Y") if card.doc_date else None,
        bank=bank,
        branch=_clean(getattr(overrides, "branch_no", None)) or card.branch_no or config.branch,  # type: ignore[arg-type]
        description=description_for(config, bank_code),
        tax_profiles_raw=profiles,
        vendor_name=getattr(overrides, "vendor_name", None),
        tax_id=getattr(overrides, "tax_id", None),
        profile_code=getattr(overrides, "profile_code", None),
        period=tuple(period.split("-")) if period else None,  # type: ignore[arg-type]
    )
    if payload is None:
        raise ValidationError(skipped or "There is no VAT on this document to record")

    try:
        res = await carmen.post_input_tax(payload, carmen_token)
    except carmen.CarmenAPIError as e:
        raise CarmenServiceError(f"Carmen Input Tax: {e.detail}") from e
    res = res or {}
    if res.get("Code") != 0:
        reason = res.get("UserMessage") or res.get("InternalMessage") or f"Code {res.get('Code')}"
        raise ValidationError(f"Carmen: {reason}")

    await _resolve(db, tenant_id, card, user_id, keyed=False)


async def mark_input_tax_keyed(
    db: AsyncSession, tenant_id: uuid.UUID, card_id: uuid.UUID, user_id: str | None
) -> None:
    """Record that somebody keyed this card's input tax into Carmen by hand.

    No Carmen call, because there is nothing to ask: Carmen has no search on its input-tax
    register, so this is a person's word, kept as `input_tax_keyed` beside who said it. No
    claim-window check either — keying it by hand is exactly what is left once the window
    has closed.
    """
    card = await _live_card(db, tenant_id, card_id, lock=True)
    _assert_owed(card)
    await _resolve(db, tenant_id, card, user_id, keyed=True)


async def input_tax_preview(db: AsyncSession, tenant_id: uuid.UUID, card_id: uuid.UUID) -> dict:
    """Whether this BU's live card still owes its input-tax record, and — when it does — what
    the late-filing dialog shows (`InputTaxOwedOut`).

    `{"owed": False}` on its own otherwise, without the lookups below: the wizard's
    draft-restore check calls this too and needs only that. `NotFoundError` when the card is
    another BU's or deleted, which for that check means the same as "nothing owed".

    The vendor is the bank's registry entry, the one `file_input_tax_for_card` posts when
    nobody overrides it — so what the dialog shows is what would post.
    """
    card = await _live_card(db, tenant_id, card_id)
    if not owes_input_tax(card):
        return {"owed": False}
    bank_code: str | None = card.bank_code  # type: ignore[assignment]
    config = await get_accounting_config(db, str(tenant_id), bank_code)
    bank = await db.get(Bank, bank_code) if bank_code else None
    periods = claim_periods(card.doc_date, _now())
    return {
        "owed": True,
        "doc_no": card.doc_no,
        "doc_date": card.doc_date.strftime("%d/%m/%Y") if card.doc_date else None,
        "bank_code": bank_code,
        "branch_no": card.branch_no or config.branch,
        "commis_amt": float(card.commis_amt or 0),
        "tax_amt": float(card.tax_amt or 0),
        "vendor_name": _clean(getattr(bank, "legal_name", None)) or None,
        "tax_id": _clean(getattr(bank, "tax_id", None)) or None,
        "periods": periods,
        "expired": card.doc_date is not None and not periods,
    }
