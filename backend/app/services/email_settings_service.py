"""Email Automation settings — the store behind PUT/GET /api/v1/carmen/settings.

Carmen owns the screens; we own the storage and the validation. Two secrets never
leave this module: per-rule PDF passwords and the per-BU Carmen posting token —
both Fernet-encrypted at rest and never returned by any endpoint.
"""

from __future__ import annotations

import logging
import secrets
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
    if payload.carmen_token is not None:
        row.carmen_token_enc = (
            encrypt_carmen_token(payload.carmen_token, app_settings.session_encryption_key)
            if payload.carmen_token
            else None
        )
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


def posting_token(row: EmailIngestSettings) -> str:
    """The Carmen credential this BU's JVs are posted with.

    Per-BU token supplied by Carmen wins; the dev token in env is the fallback so
    the pipeline is testable before Carmen issues anything. Empty means "we cannot
    post for this BU" and the caller must park the document rather than guess.
    """
    return _decrypt(row.carmen_token_enc) or app_settings.carmen_dev_token
