"""
Session utilities — JWT issuance/verification + Fernet token encryption.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt


@dataclass
class SessionInfo:
    """Decoded, decrypted session passed to route handlers via Depends."""
    session_id: str
    carmen_token: str   # plaintext — decrypted from DB
    user_id: str
    username: str
    bu: str
    tenant: str = ""
    carmen_uri: str = ""  # origin URI of the customer's Carmen instance


# ── JWT ──────────────────────────────────────────────────────────────────────

_ALGORITHM = "HS256"


def create_session_jwt(
    session_id: str,
    bu: str,
    user_id: str,
    username: str,
    tenant: str,
    secret: str,
    ttl_hours: int = 8,
    carmen_uri: str = "",
) -> str:
    now = datetime.utcnow()
    payload = {
        "sid": session_id,
        "bu": bu,
        "user_id": user_id,
        "username": username,
        "tenant": tenant,
        "carmen_uri": carmen_uri,
        "iat": now,
        "exp": now + timedelta(hours=ttl_hours),
    }
    return jwt.encode(payload, secret, algorithm=_ALGORITHM)


def decode_session_jwt(token: str, secret: str) -> dict:
    """Raises ValueError on invalid/expired token."""
    try:
        return jwt.decode(token, secret, algorithms=[_ALGORITHM])
    except JWTError as exc:
        raise ValueError(str(exc)) from exc


# ── Fernet encryption ─────────────────────────────────────────────────────────

def encrypt_carmen_token(plaintext: str, key: str) -> str:
    """Encrypt the Carmen token for storage in DB."""
    f = Fernet(key.encode())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_carmen_token(ciphertext: str, key: str) -> str:
    """Decrypt the Carmen token retrieved from DB. Raises ValueError if tampered."""
    try:
        f = Fernet(key.encode())
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Carmen token decryption failed — key mismatch or tampered data") from exc


# ── Token parsing ─────────────────────────────────────────────────────────────

def extract_user_id_from_token(carmen_token: str) -> str:
    """
    Carmen token format: <session_hash>|<user_uuid>
    Returns the user UUID portion, or the full token if format doesn't match.
    """
    parts = carmen_token.split("|", 1)
    return parts[1] if len(parts) == 2 else carmen_token
