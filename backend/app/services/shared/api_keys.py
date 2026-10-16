"""Keys we issue to external systems — today only Carmen's PMS webhook (CA-93).

The plaintext is shown once, at creation; we keep its sha256. A random 256-bit key needs
no salt or slow hash (those defend secrets a person chose), and a plain digest lets the
lookup hit `uq_api_key_hash_active` directly instead of scanning every key.

A key carries its tenant and its PMS: the caller never names a BU, so a key cannot write
into one it was not issued for, and a hook naming another PMS is refused (decision-log #44).
Carmen's PMS setting screen generates them (`routers/pms_carmen.py`). Revoking one is how
that PMS is switched off — there is no second switch.
"""

import hashlib
import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.admin import APIKey
from app.models.identity import Tenant

PREFIX = "cpk_"
PMS_SCOPE = "pms:events"


def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()


def generate() -> tuple[str, str, str]:
    """(plaintext, display prefix, hash). The prefix is what the admin page shows."""
    plaintext = PREFIX + secrets.token_urlsafe(32)
    return plaintext, plaintext[:12], hash_key(plaintext)


async def issue(
    db: AsyncSession, tenant_id: UUID, name: str, interface_name: str, actor: str
) -> tuple[APIKey, str]:
    """Create the PMS key of a live tenant and PMS, revoking the one it replaces.

    One live key per BU x PMS: Carmen keeps one key per PMS setting and stores what we
    return itself, so there is no copy-paste window that needed a second live key.
    `uq_api_keys_live_interface` is the backstop for two generates in the same instant.
    Returns the row and the only copy of the plaintext. The caller commits.
    """
    tenant = await db.scalar(
        select(Tenant.id).where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
    )
    if tenant is None:
        raise NotFoundError("Tenant not found")
    await revoke_live(
        db,
        tenant_id,
        interface_name,
        by=actor.removeprefix("user:")[:36],
        reason="Replaced by a new key",
    )
    plaintext, prefix, digest = generate()
    key = APIKey(
        name=name,
        key_prefix=prefix,
        key_hash=digest,
        tenant_id=tenant_id,
        interface_name=interface_name,
        scopes=[PMS_SCOPE],
        created_by=actor,
        updated_by=actor,
    )
    db.add(key)
    try:
        await db.flush()
    except IntegrityError:
        raise ConflictError("A key for this PMS was just generated. Try again.") from None
    return key, plaintext


async def live_key(db: AsyncSession, tenant_id: UUID, interface_name: str) -> APIKey | None:
    """The key this BU's hook for this PMS works with, if any."""
    return await db.scalar(
        select(APIKey).where(
            APIKey.tenant_id == tenant_id,
            APIKey.interface_name == interface_name,
            APIKey.revoked_at.is_(None),
        )
    )


async def revoke_live(
    db: AsyncSession, tenant_id: UUID, interface_name: str, *, by: str, reason: str | None
) -> bool:
    """Revoke this BU's live key for this PMS. False when there was none."""
    result = await db.execute(
        update(APIKey)
        .where(
            APIKey.tenant_id == tenant_id,
            APIKey.interface_name == interface_name,
            APIKey.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC), revoked_by=by, revoke_reason=reason)
    )
    return bool(result.rowcount)


async def authenticate(
    db: AsyncSession, plaintext: str, scope: str, ip: str | None
) -> APIKey | None:
    """The live key this plaintext belongs to, or None — never says which check failed.

    Stamps `last_used_at`/`last_used_ip`, which is how the admin page answers "is Carmen
    actually calling?". The caller's commit makes it stick.
    """
    if not plaintext:
        return None
    key = await db.scalar(
        select(APIKey)
        .join(Tenant, Tenant.id == APIKey.tenant_id)
        .where(
            APIKey.key_hash == hash_key(plaintext),
            APIKey.revoked_at.is_(None),
            Tenant.deleted_at.is_(None),
            Tenant.is_active.is_(True),
        )
    )
    now = datetime.now(UTC)
    if key is None or scope not in (key.scopes or []):
        return None
    if key.expires_at is not None and key.expires_at <= now:
        return None
    await db.execute(
        update(APIKey).where(APIKey.id == key.id).values(last_used_at=now, last_used_ip=ip)
    )
    return key


def key_row(key: APIKey, tenants: dict[str, dict[str, str]]) -> dict:
    """A key as the admin page shows it. Never the hash."""
    tenant = tenants.get(str(key.tenant_id), {})
    return {
        "id": str(key.id),
        "tenant_id": str(key.tenant_id) if key.tenant_id else None,
        "tenant_name": f"{tenant['name']} ({tenant['bu_code']})" if tenant else None,
        "bu_code": tenant.get("bu_code"),
        "tenant_host": tenant.get("host"),
        "name": key.name,
        "interface_name": key.interface_name,
        "key_prefix": key.key_prefix,
        "scopes": key.scopes or [],
        "created_at": key.created_at.isoformat() if key.created_at else None,
        "last_used_at": key.last_used_at.isoformat() if key.last_used_at else None,
        "last_used_ip": key.last_used_ip,
        "revoked_at": key.revoked_at.isoformat() if key.revoked_at else None,
        "revoke_reason": key.revoke_reason,
    }


async def revoke(
    db: AsyncSession,
    key_id: UUID,
    *,
    by: str,
    reason: str | None,
    tenant_id: UUID | str | None = None,
) -> bool:
    """Stamp a live key revoked. `tenant_id` confines it to one BU's keys. False = no live
    key matched (unknown, already revoked, or another BU's), which the caller answers 404."""
    stmt = update(APIKey).where(APIKey.id == key_id, APIKey.revoked_at.is_(None))
    if tenant_id is not None:
        stmt = stmt.where(APIKey.tenant_id == tenant_id)
    result = await db.execute(
        stmt.values(revoked_at=datetime.now(UTC), revoked_by=by, revoke_reason=reason)
    )
    return bool(result.rowcount)
