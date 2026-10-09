"""The person's half of a PMS day (CA-119): see what it holds, approve it, or reject it.

Mirrors `email_automation/review.py`. The approve/reject claim is a compare-and-set on
`posting_started_at`, so two reviewers pressing Approve together cannot post a day twice,
and the claim is handed back on every path that does not finish.

**Approving is what makes the AI's pick the BU's rule.** The day's new codes travel in its
`review_payload` with the AI's suggestion; Approve saves the reviewer's answer for each of
them, then posts, then re-checks this BU's other parked days, which may now be clean.
"""

import logging
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.context import current_carmen_uri
from app.database import async_session
from app.exceptions import CarmenServiceError, ConflictError, NotFoundError, ValidationError
from app.models.email_automation import EmailIngestSettings
from app.models.pms import PmsEvent, PmsSettings
from app.services.credit_card.gl_suggestion import _dept_allowed_map, _pair_ok
from app.services.pms import day as pms_day
from app.services.pms import mapping, posting
from app.services.pms.process import REVIEW_CLAIM_TTL, _target
from app.services.shared import carmen

logger = logging.getLogger(__name__)


def _money(v: Decimal) -> str:
    return f"{v.quantize(pms_day.CENT)}"


async def get_day(db: AsyncSession, tenant_id: uuid.UUID, event_pk: uuid.UUID) -> dict | None:
    """What the review modal shows for one parked day, or None when it is not waiting.

    The JV lines are not sent: they follow from `rows` and the accounts, and the screen
    recomputes them as the reviewer changes a new code's account.
    """
    row = await db.scalar(
        select(PmsEvent).where(
            PmsEvent.id == event_pk,
            PmsEvent.tenant_id == tenant_id,
            PmsEvent.status == "pending_review",
        )
    )
    if row is None or not row.review_payload:
        return None
    payload = row.review_payload
    rows = payload.get("rows") or []
    rules = await mapping.saved(db, tenant_id, payload.get("interface") or "")
    terms = pms_day.terms(rows)
    guessed = payload.get("guessed") or {}
    new_codes = []
    for key in pms_day.keys(rows):
        if key in rules:
            continue
        mine = [r for r in rows if pms_day.key_of(r) == key]
        pick = guessed.get(key) or {}
        new_codes.append(
            {
                "key": key,
                "code": pms_day.code_label(key),
                "description": mine[0]["desc"] if mine else "",
                "type": key.split("|", 1)[0],
                "amount": _money(pms_day.off_by(mine)),
                "dept": pick.get("dept"),
                "acc": pick.get("acc"),
                "confidence": pick.get("confidence"),
                "why": pick.get("why"),
            }
        )
    return {
        "id": str(row.id),
        "interface": payload.get("interface"),
        "doc_type": payload.get("doc_type"),
        "doc_date": payload.get("doc_date"),
        "reason_code": row.reason_code,
        "error_message": row.error_message,
        "terms": [{"type": t, "amount": _money(terms[t])} for t in pms_day.TERMS if t in terms],
        "off": _money(pms_day.off_by(rows)),
        "codes": sum(1 for k in pms_day.keys(rows) if k not in pms_day.RULES),
        "accounts": {k: v for k, v in rules.items() if k in set(pms_day.keys(rows))},
        "new_codes": new_codes,
        "rows": rows,
    }


async def _claim(db: AsyncSession, tenant_id: uuid.UUID, event_pk: uuid.UUID) -> Any:
    """Take the day for this approve/reject, or say why not. Commits the claim."""
    now = datetime.now(UTC)
    claimed = (
        await db.execute(
            update(PmsEvent)
            .where(
                PmsEvent.id == event_pk,
                PmsEvent.tenant_id == tenant_id,
                PmsEvent.status == "pending_review",
                or_(
                    PmsEvent.posting_started_at.is_(None),
                    PmsEvent.posting_started_at < now - REVIEW_CLAIM_TTL,
                ),
            )
            .values(posting_started_at=now)
            .returning(PmsEvent.id, PmsEvent.review_payload)
        )
    ).first()
    if claimed is not None:
        await db.commit()
        return claimed
    status = await db.scalar(
        select(PmsEvent.status).where(PmsEvent.id == event_pk, PmsEvent.tenant_id == tenant_id)
    )
    if status is None:
        raise NotFoundError("This day is not waiting for review")
    if status == "pending_review":
        raise ConflictError("Another reviewer is posting this day right now")
    raise ConflictError("Someone else has already handled this day")


async def _release(event_pk: uuid.UUID) -> None:
    """Give a claimed day back. Never raises — worst case the claim expires."""
    try:
        async with async_session() as db:
            await db.execute(
                update(PmsEvent)
                .where(PmsEvent.id == event_pk, PmsEvent.status == "pending_review")
                .values(posting_started_at=None)
            )
            await db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("[pms] Could not release the review claim on %s", event_pk)


def _check_picks(picks: dict[str, dict], accounts: list[dict], departments: list[dict]) -> None:
    """Refuse a pick Carmen's chart of accounts does not have, naming the code."""
    valid_acc = {a["code"] for a in accounts}
    valid_dept = {d["code"] for d in departments}
    allowed = _dept_allowed_map(departments)
    for key, p in picks.items():
        label = pms_day.code_label(key)
        if p["dept"] not in valid_dept:
            raise ValidationError(f"{label}: {p['dept']} is not a department in Carmen")
        if p["acc"] not in valid_acc:
            raise ValidationError(f"{label}: {p['acc']} is not an account in Carmen")
        if not _pair_ok(p["dept"], p["acc"], allowed):
            raise ValidationError(
                f"{label}: department {p['dept']} does not allow account {p['acc']}"
            )


async def approve(
    tenant_id: uuid.UUID,
    event_pk: uuid.UUID,
    picks: dict[str, dict],
    *,
    reviewer: str,
    reviewer_name: str | None,
) -> dict:
    """Save the new codes' accounts, post the day, and re-check the BU's other parked days.

    `picks` is `{key: {"dept", "acc"}}` for the day's new codes; a key the BU already has a
    rule for is ignored (rules are changed on the mapping screen, not by one day's review).
    Refuses — leaving the day parked — when a new code has no account, the day does not
    balance, no JV prefix is set, or Carmen says no.
    """
    async with async_session() as db:
        claimed = await _claim(db, tenant_id, event_pk)
    posted = False
    uri_ctx = None
    try:
        payload = claimed.review_payload or {}
        rows = payload.get("rows") or []
        interface = payload.get("interface") or ""
        async with async_session() as db:
            rules = await mapping.saved(db, tenant_id, interface)
            settings_row = await db.get(PmsSettings, tenant_id)
            token, uri = await _target(db, tenant_id)

        if not (settings_row and settings_row.jv_prefix):
            raise ValidationError("Pick a JV prefix on the PMS settings page before posting")
        if not token or not uri:
            raise ValidationError(
                "No Carmen access is stored for this business unit. Open PMS settings from Carmen's menu."
            )
        if pms_day.off_by(rows):
            raise ValidationError(
                "This day doesn't balance. Fix it in Comanche; the day comes back when it's resent."
            )

        guessed = payload.get("guessed") or {}
        new_keys = [k for k in pms_day.keys(rows) if k not in rules]
        chosen: dict[str, dict] = {}
        for key in new_keys:
            p = picks.get(key) or {}
            if not pms_day.usable(p):
                raise ValidationError("Pick an account for every new code")
            ai = guessed.get(key) or {}
            same = p["dept"] == ai.get("dept") and p["acc"] == ai.get("acc")
            chosen[key] = {"dept": p["dept"], "acc": p["acc"], "source": "ai" if same else "user"}

        uri_ctx = current_carmen_uri.set(uri)
        if chosen:
            accounts, departments = await mapping.masters(token)
            _check_picks(chosen, accounts, departments)
            async with async_session() as db:
                await mapping.save(db, tenant_id, interface, chosen)
                await db.commit()

        doc_date = date.fromisoformat(payload["doc_date"])
        body = posting.build_payload(
            pms_day.jv_lines(rows, {**rules, **chosen}),
            doc_date=doc_date,
            prefix=settings_row.jv_prefix,
            text=posting.description(interface, payload.get("doc_type") or "", doc_date),
        )
        try:
            jv_no = await posting.post_day(body, token)
        except posting.PostRefused as exc:
            raise ValidationError(f"Carmen did not accept the JV: {exc}") from exc
        except carmen.CarmenAPIError as exc:
            raise CarmenServiceError(
                f"{exc.detail} Check in Carmen whether the JV posted before trying again."
            ) from exc
        posted = True

        async with async_session() as db:
            await db.execute(
                update(PmsEvent)
                .where(PmsEvent.id == event_pk)
                .values(
                    status="posted",
                    jv_no=jv_no,
                    review_payload=None,
                    reason_code=None,
                    error_message=None,
                    posting_started_at=None,
                    reviewed_by=reviewer[:36],
                    reviewed_by_name=(reviewer_name or "")[:100] or None,
                    reviewed_at=datetime.now(UTC),
                )
            )
            await db.commit()
        if chosen:
            await recheck(tenant_id, interface)
        return {"jv_no": jv_no}
    finally:
        if uri_ctx is not None:
            current_carmen_uri.reset(uri_ctx)
        if not posted:
            await _release(event_pk)


async def reject(
    tenant_id: uuid.UUID,
    event_pk: uuid.UUID,
    reason: str | None,
    *,
    reviewer: str,
    reviewer_name: str | None,
) -> None:
    """Retire the day without a JV. Carmen re-sending it brings it back (`routers/pms.py`)."""
    async with async_session() as db:
        await _claim(db, tenant_id, event_pk)
        await db.execute(
            update(PmsEvent)
            .where(PmsEvent.id == event_pk)
            .values(
                status="rejected",
                reason_code="rejected_by_reviewer",
                error_message=(reason or "").strip()[:500] or None,
                review_payload=None,
                posting_started_at=None,
                reviewed_by=reviewer[:36],
                reviewed_by_name=(reviewer_name or "")[:100] or None,
                reviewed_at=datetime.now(UTC),
            )
        )
        await db.commit()


async def recheck(tenant_id: uuid.UUID, interface: str) -> int:
    """Recompute the flags of this BU's other parked days against the rules as they are now.

    A code approved on one day stops being "AI suggested" on every other day that has it.
    Costs no Carmen call: the rows are in each day's payload. Returns how many changed.
    Never raises — the approve it follows has already posted.
    """
    try:
        async with async_session() as db:
            rules = await mapping.saved(db, tenant_id, interface)
            parked = (
                (
                    await db.execute(
                        select(PmsEvent).where(
                            PmsEvent.tenant_id == tenant_id,
                            PmsEvent.status == "pending_review",
                        )
                    )
                )
                .scalars()
                .all()
            )
            changed = 0
            for row in parked:
                payload = dict(row.review_payload or {})
                if payload.get("interface") != interface:
                    continue
                rows, guessed = payload.get("rows") or [], payload.get("guessed") or {}
                fresh = {
                    "flags": pms_day.flags(rows, rules, guessed),
                    **pms_day.open_keys(rows, rules, guessed),
                }
                if any(payload.get(k) != v for k, v in fresh.items()):
                    # Replaced, not mutated: SQLAlchemy does not see in-place JSON edits.
                    row.review_payload = {**payload, **fresh}
                    changed += 1
            await db.commit()
            return changed
    except Exception:  # noqa: BLE001
        logger.exception("[pms] Could not re-check parked days for %s", tenant_id)
        return 0


async def get_settings(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """This BU's posting settings, and whether a Carmen credential is stored at all."""
    row = await db.get(PmsSettings, tenant_id)
    ingest = await db.get(EmailIngestSettings, tenant_id)
    return {
        "jv_prefix": row.jv_prefix if row else None,
        "auto_post": bool(row and row.auto_post),
        "has_credential": bool(ingest and ingest.carmen_token_enc),
    }


async def save_settings(
    db: AsyncSession, tenant_id: uuid.UUID, *, jv_prefix: str | None, auto_post: bool
) -> dict:
    """Replace this BU's posting settings. The caller commits."""
    row = await db.get(PmsSettings, tenant_id)
    if row is None:
        row = PmsSettings(tenant_id=tenant_id)
        db.add(row)
    row.jv_prefix = (jv_prefix or "").strip() or None
    row.auto_post = auto_post
    await db.flush()
    return await get_settings(db, tenant_id)
