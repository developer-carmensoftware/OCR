"""The two secrets a BU hands us, and the only place they are read back.

Per-rule PDF passwords (written by `ingest_settings.save_settings`) and the per-BU
Carmen posting token (contract §2.6) — both Fernet-encrypted at rest and never
returned by any endpoint.

Encrypted rather than hashed on purpose. A secret we only ever *verify* (our own
API key) is hashed; these two we have to *present* to someone else, so the value
has to come back out.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.session import decrypt_carmen_token, encrypt_carmen_token
from app.config import settings as app_settings
from app.exceptions import FieldValidationError
from app.models.email_automation import EmailIngestSettings
from app.models.identity import Tenant
from app.services.email_automation.ingest_settings import get_settings

logger = logging.getLogger(__name__)


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
    from app.services.shared.carmen import CarmenAPIError, get_departments

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
