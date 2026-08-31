"""Email Automation settings — the store behind PUT/GET /api/v1/carmen/settings.

Carmen owns the screens; we own the storage and the validation. Two secrets never
leave this module: per-rule PDF passwords and the per-BU Carmen posting token —
both Fernet-encrypted at rest and never returned by any endpoint.

Encrypted rather than hashed on purpose. A secret we only ever *verify* (our own
API key) is hashed; these two we have to *present* to someone else, so the value
has to come back out.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session import decrypt_carmen_token, encrypt_carmen_token
from app.config import settings as app_settings
from app.exceptions import ConflictError, FieldValidationError, ValidationError
from app.models.catalog import Bank
from app.models.email_automation import EmailDocument, EmailIngestSettings
from app.models.identity import Tenant
from app.services.credit_service import active_subscription

logger = logging.getLogger(__name__)


async def list_bank_codes(db: AsyncSession) -> list[dict]:
    """Bank codes a rule's `bank_code` (§2.3) may reference.

    Same `banks` table the OCR wizard already reads — one registry, not a second
    hardcoded list to keep in sync whenever a bank is added. Backs both the GET
    endpoint Carmen's dropdown reads and the "unsupported_bank" check below.
    """
    rows = (
        await db.execute(
            select(Bank.code, Bank.name)
            .where(Bank.is_active.is_(True), Bank.deleted_at.is_(None))
            .order_by(Bank.sort_order, Bank.name)
        )
    ).all()
    return [{"code": code, "name": name} for code, name in rows]


async def _active_bank_codes(db: AsyncSession) -> set[str]:
    rows = (
        await db.execute(
            select(Bank.code).where(Bank.is_active.is_(True), Bank.deleted_at.is_(None))
        )
    ).scalars()
    return set(rows)


async def _bank_tax_ids(db: AsyncSession) -> set[str]:
    """Every issuer TIN we know about — the numbers a BU may not claim as its own.

    Read from `banks.tax_id` (seeded for the ACTX input-tax record) rather than a
    second hardcoded list, so "adding a bank is an INSERT" stays true.
    """
    rows = (await db.execute(select(Bank.tax_id).where(Bank.tax_id.is_not(None)))).scalars()
    return {t.strip() for t in rows if t and t.strip()}


# ── Tax ID ────────────────────────────────────────────────────────────────────


def is_valid_thai_tax_id(value: str) -> bool:
    """13 digits with the standard mod-11 check digit.

    Rejecting a typo at write time is the whole point of §2.4 — a wrong tax ID
    silently blocks every document at 3am instead of failing loudly here.
    """
    if len(value) != 13 or not value.isdigit():
        return False
    checksum = sum(int(value[i]) * (13 - i) for i in range(12))
    return int(value[12]) == (11 - checksum % 11) % 10


# ── Tenant / routing ──────────────────────────────────────────────────────────


async def resolve_tenant(db: AsyncSession, host: str, bu: str) -> Tenant:
    """(host, bu) → tenant row. The BU must have logged into the OCR app at least once."""
    row = (
        await db.execute(
            select(Tenant).where(
                Tenant.host == host.strip().lower(),
                Tenant.bu_code == bu.strip().lower(),
                Tenant.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise ValidationError(f"Unknown business unit: {host} / {bu}")
    return row


async def resolve_by_tag(db: AsyncSession, tag: str) -> EmailIngestSettings | None:
    """The BU that owns this ingest tag — read from the envelope, before any LLM call.

    This is the routing key. It costs one indexed SELECT because the tag travels in
    the recipient address, where the tax ID it replaced could only be reached by
    running the vision model first. Everything downstream — the ledger row, the
    document credit, the `llm_usage_logs` row — therefore has a real `tenant_id`.

    **Identity only — this does not decide whether we may act.** `enabled` is checked by
    the caller (`email_ingest_service._process_message`), together with `is_entitled`,
    because "no such tag" and "known tag, switched off" need opposite answers: the first
    is mail nobody can be told about and is dropped, the second is a pause and the mail is
    handed back unread. A `None` for both cannot express that difference. Filtering here
    would also be the wrong shape for the same reason `record_gmail_code` does not.
    """
    return (
        await db.execute(select(EmailIngestSettings).where(EmailIngestSettings.ingest_tag == tag))
    ).scalar_one_or_none()


async def tags_awaiting_confirmation(db: AsyncSession, hours: int) -> set[str]:
    """Tags of BUs plausibly mid-setup right now — the gate on the 1-minute sweep.

    `gmail_confirmed_at is null` on its own is true forever for every BU that never sets
    up an auto-forward, which would mean an IMAP login every minute for the life of the
    deployment. The `updated_at` window is what makes the sweep quiescent: a BU enters it
    by saving settings and leaves it either by confirming or by going quiet, so the steady
    state is an empty set and no mailbox connection at all.

    A customer who saves settings today and gets to Gmail next week falls out of the
    window; their confirmation is picked up by the 10-minute document poll instead, which
    handles the same branch. Losing a minute of latency in that case is the price of not
    holding a mailbox connection open forever for it.

    Not filtered on `enabled` — same reason `record_gmail_code` is not: a BU redoing the
    Gmail handshake with the feature switched off still needs the forward to go live.
    """
    since = datetime.now(UTC) - timedelta(hours=hours)
    rows = await db.execute(
        select(EmailIngestSettings.ingest_tag).where(
            EmailIngestSettings.ingest_tag.is_not(None),
            EmailIngestSettings.gmail_confirmed_at.is_(None),
            EmailIngestSettings.updated_at > since,
        )
    )
    return {tag for tag in rows.scalars() if tag}


async def record_gmail_code(db: AsyncSession, tag: str, code: str) -> None:
    """Park Gmail's forwarding confirmation code where the BU's settings screen reads it.

    Not filtered on `enabled`, unlike `resolve_by_tag`: a BU re-running the Gmail setup
    while the feature is switched off is exactly the case where they need the code, and
    the tag is unique either way.

    Never raises. This runs inside a poll that is otherwise about documents, and a
    confirmation code is a convenience — failing to store one must not take down the
    poll that is also carrying real invoices.
    """
    try:
        row = (
            await db.execute(
                select(EmailIngestSettings).where(EmailIngestSettings.ingest_tag == tag)
            )
        ).scalar_one_or_none()
        if row is None:
            logger.warning("[email] Gmail confirmation code for unknown tag — dropped")
            return
        row.gmail_confirm_code = code
        row.gmail_confirm_at = datetime.now(UTC)
        await db.commit()
        logger.info("[email] Gmail confirmation code stored for tenant %s", row.tenant_id)
    except Exception as exc:
        logger.error("[email] Could not store the Gmail confirmation code: %s", exc)


async def record_gmail_confirmed(db: AsyncSession, tag: str) -> None:
    """Mark this BU's auto-forward as live — the poll followed the link and Google took it.

    Same never-raises contract as `record_gmail_code`, for the same reason: this runs
    inside a poll that is otherwise carrying invoices.
    """
    try:
        row = (
            await db.execute(
                select(EmailIngestSettings).where(EmailIngestSettings.ingest_tag == tag)
            )
        ).scalar_one_or_none()
        if row is None:
            logger.warning("[email] Forwarding confirmed for an unknown tag — not recorded")
            return
        row.gmail_confirmed_at = datetime.now(UTC)
        await db.commit()
        logger.info("[email] Forwarding confirmed for tenant %s", row.tenant_id)
    except Exception as exc:
        logger.error("[email] Could not record the forwarding confirmation: %s", exc)


async def foreign_tax_id(db: AsyncSession, tax_ids: list[str], tenant_id: Any) -> str | None:
    """A tax ID printed on this document that is registered to a *different* BU.

    Verification, not routing — the tag already said who owns the mail. This is the
    second factor: the envelope says who, the document says who, and disagreement
    parks the document rather than picking a winner.

    **Positive evidence only.** Nothing matching is not a conflict: some fee invoices
    never print the buyer's TIN, and parking those would break legitimate documents to
    catch nothing.

    Disabled rows count too — a switched-off BU's registered number still identifies
    another company. Bank TINs are refused at registration (`reserved_tax_id`), or
    every document a bank issues would trip this.

    ponytail: scans and intersects in Python, like the write-time conflict check it
    mirrors. One row per BU using the feature; make it a JSONB containment query with
    a GIN index on `tax_ids` when that stops being a handful.
    """
    wanted = {t.strip() for t in tax_ids if t and t.strip()}
    if not wanted:
        return None
    rows = (await db.execute(select(EmailIngestSettings))).scalars().all()
    for row in rows:
        if str(row.tenant_id) == str(tenant_id):
            continue
        if clash := wanted & set(row.tax_ids or []):
            return sorted(clash)[0]
    return None


def ingest_address(tag: str | None) -> str | None:
    """`<user>+<tag>@<domain>` — one per BU, from the one configured mailbox.

    `None` until a tag is allocated (i.e. until the BU successfully enables the
    feature). Returning null rather than the bare mailbox is deliberate: **nobody is
    ever shown an untagged address**, so there is nothing to copy that would arrive
    unattributable. The `disabled` / `not_configured` blockers already explain why.
    """
    if not tag:
        return None
    user, _, domain = app_settings.email_ingest_address.partition("@")
    return f"{user}+{tag}@{domain}"


async def _fresh_tag(db: AsyncSession) -> str:
    """A tag no BU holds. 8 hex, random, stored — never derived, never reissued.

    Random rather than derived from `bu_code`, for three reasons:
      - not unique. Tenant identity is `(host, bu_code)`; two customers each having a
        BU called `hq` is ordinary, and the unique index would reject the second — that
        customer simply could not enable the feature.
      - guessable is a bypass. With bare-address mail refused, the tag *is* the
        authorization to write into a BU's ledger. `hq` / `bkk01` / `head-office` is a
        short dictionary; 8 hex is not.
      - derived values drift. `tenants` is upserted on `(host, bu)`, so a BU renamed on
        Carmen's side would change a derived address while the customer's mailbox rule
        still points at the old one.

    The partial unique index is the real guard; this loop only avoids discovering a
    1-in-4-billion collision as a failed commit that would take the whole save with it.
    """
    for _ in range(5):
        tag = secrets.token_hex(4)
        taken = await db.scalar(
            select(EmailIngestSettings.tenant_id).where(EmailIngestSettings.ingest_tag == tag)
        )
        if taken is None:
            return tag
    raise ValidationError("Could not allocate an ingest address — please try again")


# ── Read / write ──────────────────────────────────────────────────────────────


async def get_settings(db: AsyncSession, tenant: Tenant) -> EmailIngestSettings | None:
    return (
        await db.execute(
            select(EmailIngestSettings).where(EmailIngestSettings.tenant_id == tenant.id)
        )
    ).scalar_one_or_none()


def to_response(row: EmailIngestSettings | None, host: str, bu: str) -> dict:
    """Contract §2.2 shape. Secrets become booleans; nothing sensitive is echoed."""
    if row is None:
        return {
            "host": host,
            "bu": bu,
            "enabled": False,
            # Null until the BU successfully enables the feature and a tag is issued.
            "ingest_address": None,
            "owner_emails": [],
            "tax_ids": [],
            "rules": [],
            "gmail_confirmed_at": None,
            "gmail_confirm": None,
            "status": {"ready": False, "blockers": ["not_configured"]},
        }
    rules = list(row.rules or [])
    blockers = []
    if not row.tax_ids:
        blockers.append("no_tax_id")
    if not any(r.get("is_active", True) for r in rules):
        blockers.append("no_rule")
    if not row.enabled:
        blockers.append("disabled")
    return {
        "host": host,
        "bu": bu,
        "enabled": bool(row.enabled),
        "ingest_address": ingest_address(row.ingest_tag),
        "owner_emails": list(row.owner_emails or []),
        "tax_ids": list(row.tax_ids or []),
        "rules": [
            {
                "bank_code": r.get("bank_code"),
                "bank_sender_email": r.get("bank_sender_email"),
                "filename_patterns": list(r.get("filename_patterns") or []),
                "has_password": bool(r.get("pdf_password_enc")),
                "is_active": r.get("is_active", True),
            }
            for r in rules
        ],
        # The handshake completing on its own — normally the only one of these two that
        # is ever set, since Google no longer prints a code (see the model).
        "gmail_confirmed_at": (
            row.gmail_confirmed_at.isoformat() if row.gmail_confirmed_at else None
        ),
        # Present only while a code is waiting to be used. Not a secret — it authorises
        # nothing on its own, and the person who needs it is the one already looking at
        # this screen.
        "gmail_confirm": (
            {
                "code": row.gmail_confirm_code,
                "at": row.gmail_confirm_at.isoformat() if row.gmail_confirm_at else None,
            }
            if row.gmail_confirm_code
            else None
        ),
        "status": {"ready": not blockers, "blockers": blockers},
    }


# ── Readiness (contract §2.2 `status`) ────────────────────────────────────────


async def is_entitled(db: AsyncSession, tenant: Tenant) -> bool:
    """Does this BU have a live monthly package? (§2.2 `entitled`)

    `active_subscription` documents itself as the single source of truth for that
    question and is already window-aware, so this is a naming shim, not a rule.
    """
    return await active_subscription(db, str(tenant.id)) is not None


async def document_counts(db: AsyncSession, row: EmailIngestSettings) -> dict:
    """The counters in the `status` block."""
    total, last = (
        await db.execute(
            select(func.count(EmailDocument.id), func.max(EmailDocument.created_at)).where(
                EmailDocument.tenant_id == row.tenant_id
            )
        )
    ).one()
    return {
        "documents_total": total or 0,
        "last_received_at": last.isoformat() if last else None,
    }


async def build_settings_response(
    db: AsyncSession, tenant: Tenant, row: EmailIngestSettings | None
) -> dict:
    """The §2.2 body — assembled here so GET and PUT cannot drift apart.

    `to_response` covers what the BU configured; the blocker added here is a
    condition it cannot see and one that otherwise surfaces as silence — an unpaid
    BU that ingests anyway.

    A missing GL mapping is deliberately *not* a blocker: the ingest job AI-fills
    what the BU never mapped and saves the result, so a BU that has never opened the
    mapping page still posts (CARMEN_INTEGRATION.md §4).

    The identity echoed back is the **tenant's**, not the caller's. The request may
    name it as `host` or as `uri` and in any casing; one tenant reports one identity
    either way, which is what makes a second input spelling cost nothing here.
    """
    body = to_response(row, tenant.host, tenant.bu_code)
    body["entitled"] = await is_entitled(db, tenant)

    if row is None:
        return body  # not_configured — nothing else is meaningful yet

    status = body["status"]
    status.update(await document_counts(db, row))
    if not body["entitled"]:
        status["blockers"].append("not_entitled")
    status["ready"] = not status["blockers"]
    return body


def _looks_like_email(value: str) -> bool:
    """Enough to catch a typo, not an RFC 5322 parser.

    Deliberately loose. A rejected address here is a real address the customer cannot
    register, which costs more than a wrong one does: a wrong one only ever refuses the
    customer's own mail, visibly, in their own document history.
    """
    local, sep, domain = value.partition("@")
    return bool(sep and local and "." in domain and not domain.endswith(".") and " " not in value)


async def save_settings(db: AsyncSession, tenant: Tenant, payload: Any) -> EmailIngestSettings:
    """Replace the BU's settings wholesale (contract §2.3 — full list, not a delta)."""
    errors: list[dict] = []

    owner_emails = [e.strip().lower() for e in (payload.owner_emails or []) if e and e.strip()]
    for i, addr in enumerate(owner_emails):
        if not _looks_like_email(addr):
            errors.append(
                {
                    "field": f"owner_emails[{i}]",
                    "code": "invalid_email",
                    "message": "That does not look like an email address",
                }
            )

    tax_ids = [t.strip() for t in (payload.tax_ids or [])]
    # The bank's own TIN is printed on the very invoice the user is reading to find
    # theirs, one line away. Registering it would match every document that bank ever
    # issues, for every customer — and would trip the post-extraction conflict check
    # (`foreign_tax_id`) on all of them.
    reserved = await _bank_tax_ids(db) if tax_ids else set()
    for i, tid in enumerate(tax_ids):
        if not is_valid_thai_tax_id(tid):
            errors.append(
                {
                    "field": f"tax_ids[{i}]",
                    "code": "invalid_checksum",
                    "message": "Tax ID must be 13 digits with a valid check digit",
                }
            )
        elif tid in reserved:
            errors.append(
                {
                    "field": f"tax_ids[{i}]",
                    "code": "reserved_tax_id",
                    "message": (
                        f"{tid} is the bank's own tax ID, not your company's — "
                        "it is printed on the same invoice"
                    ),
                }
            )
    rules = payload.rules or []
    if rules:
        supported = await _active_bank_codes(db)
        seen_banks: dict[str | None, int] = {}
        for i, rule in enumerate(rules):
            if not _clean_patterns(rule):
                errors.append(
                    {
                        "field": f"rules[{i}].filename_patterns",
                        "code": "required",
                        "message": (
                            "At least one filename pattern is required — an attachment "
                            "matching none is never processed. Use '.pdf' to accept "
                            "every PDF from this bank."
                        ),
                    }
                )
            if rule.bank_code and rule.bank_code not in supported:
                errors.append(
                    {
                        "field": f"rules[{i}].bank_code",
                        "code": "unsupported_bank",
                        "message": f"Unsupported bank code: {rule.bank_code}",
                    }
                )
            if rule.bank_code in seen_banks:
                errors.append(
                    {
                        "field": f"rules[{i}].bank_code",
                        "code": "duplicate_bank",
                        "message": (
                            f"Bank code '{rule.bank_code}' is already used by another rule"
                            if rule.bank_code
                            else "Only one 'Other' rule (bank_code: null) is allowed"
                        ),
                    }
                )
            else:
                seen_banks[rule.bank_code] = i
    if payload.enabled and not tax_ids:
        errors.append(
            {
                "field": "tax_ids",
                "code": "required",
                "message": "At least one tax ID is required before enabling Email Automation",
            }
        )
    # The feature is sold, not free (§2.2). Refusing at write time is what keeps a
    # BU from being switched on and then quietly ingesting on someone else's dime.
    if payload.enabled and not await is_entitled(db, tenant):
        errors.append(
            {
                "field": "enabled",
                "code": "not_entitled",
                "message": "An active monthly package is required to enable Email Automation",
            }
        )
    if errors:
        raise FieldValidationError(errors)

    # A tax ID belongs to exactly one BU system-wide (§2.4) — a second claim is
    # almost always a copy-paste mistake, and it would route another company's
    # document into these books.
    if tax_ids:
        others = (
            await db.execute(
                select(EmailIngestSettings).where(EmailIngestSettings.tenant_id != tenant.id)
            )
        ).scalars()
        for other in others:
            clash = set(tax_ids) & set(other.tax_ids or [])
            if clash:
                raise ConflictError(
                    f"Tax ID {sorted(clash)[0]} is already registered to another BU"
                )

    row = await get_settings(db, tenant)
    if row is None:
        row = EmailIngestSettings(tenant_id=tenant.id)
        db.add(row)

    # Allocated here and only here: after the `is_entitled` gate above, so "only paying
    # customers get an address" needs no logic of its own, and only when there is none —
    # a tag is never reissued across disable → re-enable or a lapsed package, because the
    # customer's mailbox rule points at it and a new one makes their documents vanish
    # with no error anywhere.
    if payload.enabled and not row.ingest_tag:
        row.ingest_tag = await _fresh_tag(db)

    existing = {(r.get("bank_code") or ""): r for r in (row.rules or [])}
    # The off→on edge only. Mail older than this is skipped rather than replayed (see
    # `_process_message`), so re-saving unrelated settings while already on must not move
    # it — that would discard mail the poll simply had not reached yet. A fresh row is
    # `enabled=False`, so the first-ever enable stamps it too.
    if payload.enabled and not row.enabled:
        row.enabled_at = datetime.now(UTC)
    row.enabled = bool(payload.enabled)
    row.owner_emails = owner_emails
    row.tax_ids = tax_ids
    row.rules = [_merge_rule(r, existing.get(r.bank_code or "")) for r in rules]
    await db.commit()
    await db.refresh(row)
    return row


def _clean_patterns(incoming: Any) -> list[str]:
    """The rule's filename patterns, stripped, blanks dropped. Empty = invalid."""
    return [p.strip() for p in (incoming.filename_patterns or []) if p and p.strip()]


def _merge_rule(incoming: Any, previous: dict | None) -> dict:
    """omit pdf_password = keep the stored one, "" = clear it (§2.3)."""
    rule = {
        "bank_code": incoming.bank_code,
        "bank_sender_email": incoming.bank_sender_email,
        "filename_patterns": _clean_patterns(incoming),
        "is_active": incoming.is_active,
        "pdf_password_enc": (previous or {}).get("pdf_password_enc"),
    }
    if incoming.pdf_password is not None:
        rule["pdf_password_enc"] = (
            encrypt_carmen_token(incoming.pdf_password, app_settings.session_encryption_key)
            if incoming.pdf_password
            else None
        )
    return rule


# ── Secrets, read back only inside the ingest pipeline ────────────────────────


def _decrypt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return decrypt_carmen_token(value, app_settings.session_encryption_key)
    except ValueError:
        logger.error("[email] Stored secret could not be decrypted — key rotated?")
        return None


def rule_passwords(row: EmailIngestSettings) -> list[str]:
    """This BU's own active-rule PDF passwords.

    One BU's, never pooled across tenants — the tag names the owner before the file is
    opened, so there is no longer any reason to try a stranger's password on a
    stranger's file. Still every rule's rather than only the matched one's: the bank
    may be ambiguous when two rules name the filename, and these are all the same
    customer's passwords with a handful at most (§2.3).
    """
    out = []
    for rule in row.rules or []:
        if not rule.get("is_active", True):
            continue
        pwd = _decrypt(rule.get("pdf_password_enc"))
        if pwd and pwd not in out:
            out.append(pwd)
    return out


async def posting_target(db: AsyncSession, row: EmailIngestSettings) -> tuple[str, str]:
    """(token, carmen_uri) for this BU's JV posting.

    The URI matters as much as the token: the ingest job runs with no request
    context, so nothing has populated `current_carmen_uri` the way a logged-in
    session would. Empty token means "we cannot post for this BU" and the caller
    must park the document rather than guess.
    """
    token = _decrypt(row.carmen_token_enc)
    if not token and app_settings.app_debug:
        # The dev token keeps the pipeline testable before Carmen issues anything.
        # Never in production: posting every BU with one shared credential is
        # exactly the blast radius the per-BU token exists to avoid.
        token = app_settings.carmen_dev_token

    uri = str(row.carmen_uri or "")
    if not uri:
        tenant_host = await db.scalar(select(Tenant.host).where(Tenant.id == row.tenant_id))
        # ponytail: tenants.host is the normalised origin minus scheme (routers/auth.py
        # `validate_uri`), so this rebuilds it — except for a non-443 port, which no
        # Carmen deployment uses. Carmen sends carmen_uri with the token anyway.
        uri = f"https://{tenant_host}" if tenant_host else ""
    return token or "", uri


# ── The posting credential (contract §2.6) ────────────────────────────────────


def fingerprint(token: str) -> str:
    """First 8 hex of sha256 — names a credential in support without revealing it."""
    return hashlib.sha256(token.encode()).hexdigest()[:8]


async def verify_token(token: str, carmen_uri: str) -> None:
    """Prove the credential works, now, before we promise the customer automation.

    Carmen offers no introspection endpoint, so an ordinary authenticated GET is the only
    liveness signal available. Called at save time (the customer finds out on their own
    screen) and from the daily health check (we find out before the customer does).

    "Carmen's token has no expiry" is what this file used to say. It is not true: on
    2026-08-28 a token that posted successfully at 09:21 UTC was refused at 09:35, with
    nothing changed on our side. Treat liveness as something that lapses at any moment,
    which is why `mark_token_unverified` exists for the posts that discover it first.
    """
    from app.context import current_carmen_uri
    from app.services.carmen_service import CarmenAPIError, get_departments

    ctx = current_carmen_uri.set(carmen_uri)
    try:
        await get_departments(token)
    except CarmenAPIError as exc:
        raise FieldValidationError(
            [
                {
                    "field": "token",
                    "code": "token_rejected",
                    "message": f"Carmen rejected this token (HTTP {exc.status_code})",
                }
            ]
        ) from exc
    finally:
        current_carmen_uri.reset(ctx)


async def set_token(
    db: AsyncSession, tenant: Tenant, token: str, carmen_uri: str, actor: str
) -> EmailIngestSettings:
    """Store the posting credential. Rejects one Carmen will not accept.

    `carmen_uri` must already have been through the SSRF validation in
    `routers/auth.validate_uri` — we are about to make a server-side request to
    it carrying a credential, so this function never accepts a raw caller value.
    """
    await verify_token(token, carmen_uri)

    row = await get_settings(db, tenant)
    if row is None:
        row = EmailIngestSettings(tenant_id=tenant.id)
        db.add(row)
    row.carmen_token_enc = encrypt_carmen_token(token, app_settings.session_encryption_key)
    row.carmen_uri = carmen_uri
    row.carmen_token_fp = fingerprint(token)
    row.carmen_token_verified_at = datetime.now(UTC)
    row.updated_by = actor[:100]
    await db.commit()
    await db.refresh(row)
    return row


async def clear_token(db: AsyncSession, tenant: Tenant, actor: str) -> None:
    """Drop our copy. Carmen must invalidate its own — ours is not the authority."""
    row = await get_settings(db, tenant)
    if row is None:
        return
    row.carmen_token_enc = None
    row.carmen_token_fp = None
    row.carmen_token_verified_at = None
    row.updated_by = actor[:100]
    await db.commit()


async def mark_token_unverified(db: AsyncSession, tenant_id: Any) -> None:
    """A real post just proved this BU's credential dead — say so where it gets fixed.

    Writes the same `verified_at = null` the health sweep writes, for the same reason:
    the token may well come back, so we record "unproven" rather than deleting something
    we cannot re-obtain. Without this, an expired token is visible only as a failed row
    in the document ledger, while `#/admin/email` and the customer's own settings screen
    keep showing a credential last verified days ago — which is what made a dead token
    take three burnt credits to notice on 2026-08-28.
    """
    row = (
        await db.execute(
            select(EmailIngestSettings).where(
                EmailIngestSettings.tenant_id == uuid.UUID(str(tenant_id))
            )
        )
    ).scalar_one_or_none()
    if row is None or row.carmen_token_verified_at is None:
        return
    row.carmen_token_verified_at = None
    await db.commit()
    logger.warning(
        "[email] Carmen token %s for tenant %s was rejected on a real post",
        row.carmen_token_fp,
        tenant_id,
    )


async def sweep_token_health(db: AsyncSession) -> dict:
    """Re-prove every stored credential against Carmen.

    Nothing tells us a token has expired or been revoked on Carmen's side — without this
    the first symptom is a customer's document failing to post at 3am, which is exactly
    what happened on 2026-08-28 while this sweep had an endpoint and no schedule (it now
    runs daily; see `20260828000000_email_token_health_cron.sql`). Clearing `verified_at`
    on failure is deliberate: the credential may
    well come back (a transient Carmen outage looks the same as a revocation), so
    we record "unproven" rather than deleting something we cannot re-obtain.
    """
    rows = (
        (await db.execute(select(EmailIngestSettings).where(EmailIngestSettings.enabled.is_(True))))
        .scalars()
        .all()
    )
    result = {"checked": 0, "ok": 0, "failed": 0}
    for row in rows:
        token, uri = await posting_target(db, row)
        if not token or not uri:
            continue
        result["checked"] += 1
        try:
            await verify_token(token, uri)
        except FieldValidationError:
            row.carmen_token_verified_at = None
            result["failed"] += 1
            logger.warning(
                "[email] Carmen token %s for tenant %s no longer works",
                row.carmen_token_fp,
                row.tenant_id,
            )
        else:
            row.carmen_token_verified_at = datetime.now(UTC)
            result["ok"] += 1
    await db.commit()
    return result


def token_status(row: EmailIngestSettings | None) -> dict:
    """Everything about the credential that is safe to show. Never the value."""
    return {
        "configured": bool(row is not None and row.carmen_token_enc),
        "fingerprint": (row.carmen_token_fp if row is not None else None),
        "carmen_uri": (row.carmen_uri if row is not None else None),
        "verified_at": (
            row.carmen_token_verified_at.isoformat()
            if row is not None and row.carmen_token_verified_at is not None
            else None
        ),
    }
