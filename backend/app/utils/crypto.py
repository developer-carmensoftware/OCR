"""The keys the app encrypts at rest with — one place, so a key can be rotated.

`SESSION_ENCRYPTION_KEY` encrypts; `SESSION_ENCRYPTION_KEYS_OLD` (comma-separated, empty by
default) only decrypts. That pair is what makes rotation possible without losing data:
deploy the new key with the old one listed, re-encrypt what was written under the old one
(`POST /api/v1/admin/encryption/rotate`), then drop the old key. docs/KEY_ROTATION.md is
the runbook (decision-log #50).

Read on every call, not cached: the settings are patched in tests, and building a Fernet is
a base64 decode.
"""

from __future__ import annotations

from cryptography.fernet import Fernet, MultiFernet

from app.config import settings


def old_keys() -> list[str]:
    return [k.strip() for k in settings.session_encryption_keys_old.split(",") if k.strip()]


def primary() -> Fernet:
    """The key new tokens are written under — and the test for "already rotated"."""
    return Fernet(settings.session_encryption_key.encode())


def fernet() -> MultiFernet:
    """Encrypts with the primary key, decrypts with it or any old one."""
    return MultiFernet([primary(), *(Fernet(k.encode()) for k in old_keys())])
