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
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session import decrypt_carmen_token, encrypt_carmen_token
from app.config import settings as app_settings
from app.exceptions import ConflictError, FieldValidationError, ValidationError
from app.models.email_automation import EmailIngestSettings
from app.models.identity import Tenant

logger = logging.getLogger(__name__)

SUPPORTED_BANK_CODES = {"BBL", "KBANK", "SCB", "BAY", "KTC", "GHL", "PAYPAL", "SIAMPAY"}


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


# ── Tenant / tag ──────────────────────────────────────────────────────────────


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


def ingest_address(tag: str) -> str:
    """`ocr+<tag>@domain` — subaddressing, so one mailbox serves every tenant."""
    user, _, domain = app_settings.email_ingest_address.partition("@")
    return f"{user}+{tag}@{domain}"


async def _new_tag(db: AsyncSession) -> str:
    for _ in range(5):
        tag = secrets.token_hex(4)
        taken = await db.execute(
            select(EmailIngestSettings.tenant_id).where(EmailIngestSettings.ingest_tag == tag)
        )
        if taken.scalar_one_or_none() is None:
            return tag
    raise ConflictError("Could not allocate an ingest tag")


# ── Read / write ──────────────────────────────────────────────────────────────


async def get_settings(db: AsyncSession, tenant: Tenant) -> EmailIngestSettings | None:
    return (
        await db.execute(
            select(EmailIngestSettings).where(EmailIngestSettings.tenant_id == tenant.id)
        )
    ).scalar_one_or_none()


async def get_by_tag(db: AsyncSession, tag: str) -> EmailIngestSettings | None:
    return (
        await db.execute(select(EmailIngestSettings).where(EmailIngestSettings.ingest_tag == tag))
    ).scalar_one_or_none()


def to_response(row: EmailIngestSettings | None, host: str, bu: str) -> dict:
    """Contract §2.2 shape. Secrets become booleans; nothing sensitive is echoed."""
    if row is None:
        return {
            "host": host,
            "bu": bu,
            "enabled": False,
            "ingest_address": None,
            "tax_ids": [],
            "rules": [],
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
        "ingest_address": ingest_address(str(row.ingest_tag)),
        "tax_ids": list(row.tax_ids or []),
        "rules": [
            {
                "bank_code": r.get("bank_code"),
                "bank_sender_email": r.get("bank_sender_email"),
                "filename_pattern": r.get("filename_pattern"),
                "has_password": bool(r.get("pdf_password_enc")),
                "is_active": r.get("is_active", True),
            }
            for r in rules
        ],
        "status": {"ready": not blockers, "blockers": blockers},
    }


async def save_settings(db: AsyncSession, tenant: Tenant, payload: Any) -> EmailIngestSettings:
    """Replace the BU's settings wholesale (contract §2.3 — full list, not a delta)."""
    errors: list[dict] = []

    tax_ids = [t.strip() for t in (payload.tax_ids or [])]
    for i, tid in enumerate(tax_ids):
        if not is_valid_thai_tax_id(tid):
            errors.append(
                {
                    "field": f"tax_ids[{i}]",
                    "code": "invalid_checksum",
                    "message": "Tax ID must be 13 digits with a valid check digit",
                }
            )
    for i, rule in enumerate(payload.rules or []):
        if rule.bank_code and rule.bank_code not in SUPPORTED_BANK_CODES:
            errors.append(
                {
                    "field": f"rules[{i}].bank_code",
                    "code": "unsupported_bank",
                    "message": f"Unsupported bank code: {rule.bank_code}",
                }
            )
    if payload.enabled and not tax_ids:
        errors.append(
            {
                "field": "tax_ids",
                "code": "required",
                "message": "At least one tax ID is required before enabling Email Automation",
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
        row = EmailIngestSettings(tenant_id=tenant.id, ingest_tag=await _new_tag(db))
        db.add(row)

    existing = {(r.get("bank_code") or ""): r for r in (row.rules or [])}
    row.enabled = bool(payload.enabled)
    row.tax_ids = tax_ids
    row.rules = [_merge_rule(r, existing.get(r.bank_code or "")) for r in (payload.rules or [])]
    await db.commit()
    await db.refresh(row)
    return row


def _merge_rule(incoming: Any, previous: dict | None) -> dict:
    """omit pdf_password = keep the stored one, "" = clear it (§2.3)."""
    rule = {
        "bank_code": incoming.bank_code,
        "bank_sender_email": incoming.bank_sender_email,
        "filename_pattern": incoming.filename_pattern,
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
    """Every active rule's PDF password.

    The issuing bank is often unknown when a protected file is opened (a manual
    forward carries no bank identity), so we try them all — they are the
    customer's own passwords and there is a handful at most (§2.3).
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
        # `_validate_uri`), so this rebuilds it — except for a non-443 port, which no
        # Carmen deployment uses. Carmen sends carmen_uri with the token anyway.
        uri = f"https://{tenant_host}" if tenant_host else ""
    return token or "", uri


# ── The posting credential (contract §2.6) ────────────────────────────────────


def fingerprint(token: str) -> str:
    """First 8 hex of sha256 — names a credential in support without revealing it."""
    return hashlib.sha256(token.encode()).hexdigest()[:8]


async def verify_token(token: str, carmen_uri: str) -> None:
    """Prove the credential works, now, before we promise the customer automation.

    Carmen's token has no expiry and no introspection endpoint, so an ordinary
    authenticated GET is the only liveness signal available. Called at save time
    (the customer finds out on their own screen) and from the daily health check
    (we find out before the customer does).
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
    `routers/auth._validate_uri` — we are about to make a server-side request to
    it carrying a credential, so this function never accepts a raw caller value.
    """
    await verify_token(token, carmen_uri)

    row = await get_settings(db, tenant)
    if row is None:
        row = EmailIngestSettings(tenant_id=tenant.id, ingest_tag=await _new_tag(db))
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


async def sweep_token_health(db: AsyncSession) -> dict:
    """Re-prove every stored credential against Carmen.

    The token never expires, so nothing tells us it has been revoked on Carmen's
    side — without this the first symptom is a customer's document failing to post
    at 3am. Clearing `verified_at` on failure is deliberate: the credential may
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
