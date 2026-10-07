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

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
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


async def issue(db: AsyncSession, tenant_id: UUID, name: str, actor: str) -> tuple[APIKey, str]:
    """Create a PMS key for a live tenant. Returns the row and the only copy of the plaintext."""
    tenant = await db.scalar(
        select(Tenant.id).where(Tenant.id == tenant_id, Tenant.deleted_at.is_(None))
    )
    if tenant is None:
        raise NotFoundError("Tenant not found")
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
