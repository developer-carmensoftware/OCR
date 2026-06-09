"""
Session utilities — JWT issuance/verification + Fernet token encryption.

JWT payload (v3 schema — tenant is (host, bu) pair, no separate BU id):
  sid         — OcrSession UUID
  tid         — tenants.id (UUID resolved at login time)
  cuid        — Carmen ERP user UUID (external)
  username    — display name
  bu          — raw bu code (for display in frontend, not used for DB filtering)
  carmen_uri  — Carmen instance origin (for proxy calls)
  iat / exp   — standard claims
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class SessionInfo:
    """Resolved session passed to route handlers via Depends(get_current_session)."""

    session_id: str
    carmen_token: str  # plaintext — decrypted from DB
    carmen_user_id: str  # Carmen ERP user UUID
    username: str
    tenant_id: str  # FK → tenants.id (one row per host+bu pair)
    carmen_uri: str = ""
    bu: str = ""  # raw bu code from JWT (display only; tenant_id already encodes it)


# ── JWT ──────────────────────────────────────────────────────────────────────

_ALGORITHM = "HS256"


def create_session_jwt(
    session_id: str,
    tenant_id: str,
    carmen_user_id: str,
    username: str,
    secret: str,
    ttl_hours: float = 8,
    carmen_uri: str = "",
    bu: str = "",
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sid": session_id,
        "tid": tenant_id,
        "cuid": carmen_user_id,
        "username": username,
        "bu": bu,
        "carmen_uri": carmen_uri,
        "iat": now,
        "exp": now + timedelta(hours=ttl_hours),
    }
    encoded = jwt.encode(payload, secret, algorithm=_ALGORITHM)
    return encoded


def decode_session_jwt(token: str, secret: str) -> dict:
    """Raises ValueError on invalid/expired token."""
    try:
        decoded = jwt.decode(token, secret, algorithms=[_ALGORITHM])
        return decoded if isinstance(decoded, dict) else {}
    except JWTError as exc:
        raise ValueError(str(exc)) from exc


# ── Fernet encryption ─────────────────────────────────────────────────────────


def encrypt_carmen_token(plaintext: str, key: str) -> str:
    f = Fernet(key.encode())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_carmen_token(ciphertext: str, key: str) -> str:
    try:
        f = Fernet(key.encode())
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Carmen token decryption failed — key mismatch or tampered data") from exc


# ── Token parsing ─────────────────────────────────────────────────────────────


def extract_user_id_from_token(carmen_token: str) -> str:
    """Carmen token format: <hash>|<user_uuid> — returns the UUID portion."""
    parts = carmen_token.split("|", 1)
    return parts[1] if len(parts) == 2 else carmen_token


async def revoke_session_by_id(db: AsyncSession, session_id: str) -> bool:
    """Deactivate an OcrSession row by ID. Returns True if found and revoked."""
    from app.models.orm import OcrSession  # late import avoids circular dependency

    result = await db.execute(select(OcrSession).where(OcrSession.id == session_id))
    session = result.scalar_one_or_none()
    if session:
        session.is_active = False  # type: ignore[assignment]
        await db.commit()
        logger.info("Session revoked: %s", session_id)
        return True
    return False
