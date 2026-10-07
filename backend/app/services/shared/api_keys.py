"""Keys we issue to external systems — today only Carmen's PMS webhook (CA-93).

The plaintext is shown once, at creation; we keep its sha256. A random 256-bit key needs
no salt or slow hash (those defend secrets a person chose), and a plain digest lets the
lookup hit `uq_api_key_hash_active` directly instead of scanning every key.

A key carries its tenant: the caller never names a BU, so a key cannot write into one it
was not issued for. Revoking it is how a BU is switched off — there is no second switch.
"""

import hashlib
import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models.admin import APIKey
from app.models.identity import Tenant

PREFIX = "cpk_"
PMS_SCOPE = "pms:events"
# A rotation needs two live keys at once (new one issued, old one still in Carmen); a third
# is a key nobody can say Carmen is using. Every key issue() makes is a PMS key today.
MAX_ACTIVE_PER_TENANT = 2


def hash_key(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode()).hexdigest()


def generate() -> tuple[str, str, str]:
    """(plaintext, display prefix, hash). The prefix is what the admin page shows."""
    plaintext = PREFIX + secrets.token_urlsafe(32)
    return plaintext, plaintext[:12], hash_key(plaintext)


async def issue(db: AsyncSession, tenant_id: UUID, name: str, actor: str) -> tuple[APIKey, str]:
    """Create a PMS key for a live tenant. Returns the row and the only copy of the plaintext."""
    tenant = await db.scalar(
        select(Tenant.id).where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
    )
    if tenant is None:
        raise NotFoundError("Tenant not found")
    # ponytail: count-then-insert; two creates in the same instant can make a third key.
    # Keys are created by hand, a few times per BU; lock the tenant row if that changes.
    active = await db.scalar(
        select(func.count())
        .select_from(APIKey)
        .where(APIKey.tenant_id == tenant_id, APIKey.revoked_at.is_(None))
    )
    if (active or 0) >= MAX_ACTIVE_PER_TENANT:
        raise ConflictError(
            f"This business unit already has {MAX_ACTIVE_PER_TENANT} active keys. "
            "Revoke one before creating another."
        )
    plaintext, prefix, digest = generate()
    key = APIKey(
        name=name,
        key_prefix=prefix,
        key_hash=digest,
        tenant_id=tenant_id,
        scopes=[PMS_SCOPE],
        created_by=actor,
        updated_by=actor,
    )
    db.add(key)
    await db.flush()
    return key, plaintext


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
    """A key as both key screens show it (admin and the BU's own `#/pms`). Never the hash."""
    tenant = tenants.get(str(key.tenant_id), {})
    return {
        "id": str(key.id),
        "tenant_id": str(key.tenant_id) if key.tenant_id else None,
        "tenant_name": f"{tenant['name']} ({tenant['bu_code']})" if tenant else None,
        "bu_code": tenant.get("bu_code"),
        "tenant_host": tenant.get("host"),
        "name": key.name,
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
