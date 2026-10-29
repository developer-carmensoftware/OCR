"""Columns whose value is encrypted at rest (Fernet, `SESSION_ENCRYPTION_KEY`).

For what a person's document leaves behind in the database:
- `EncryptedJSON`: `email_documents.review_payload` and `pms_events.review_payload`, the
  two columns that hold a whole document while a person owes it a decision;
- `EncryptedText`: `correction_feedback.original_value` / `.corrected_value` (what a user
  corrected on a scan) and `bug_reports.screenshot_b64`.

Everything the app reads and writes goes through the column type (ORM attributes,
`update().values()`, `insert().on_conflict_do_update(set_=…)`, `select(col)`,
`.returning(col)`), so no call site knows the value is encrypted. The one thing that does
not: comparing the column to a literal in SQL, which would encrypt the literal too.

`EncryptedJSON` stores `{"enc": "<Fernet token>"}` in the same JSONB column, plus any
`clear` keys copied out in plain text for SQL to filter on. `EncryptedText` stores the bare
token. Neither needs a migration: a value that is not a token is a row from before, read
as it stands, so existing rows and a rolling deploy both keep working.
`POST /api/v1/admin/encryption/backfill` (`services/shared/payload_encryption.py`)
rewrites those rows once the new code is deployed.

Same key as the session tokens, BU credentials and PDF passwords. A token it cannot
decrypt (a rotated key) is logged and read as None, as `credential._decrypt` does — the
row then reads as empty rather than taking the request down with it.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import JSON, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator

from app.config import settings

logger = logging.getLogger(__name__)

# How every Fernet token starts: version byte 0x80, then a big-endian timestamp whose top
# bytes stay zero until 2106. What tells an `EncryptedText` token from a row from before.
TOKEN_PREFIX = "gAAAAA"


def _fernet() -> Fernet:
    return Fernet(settings.session_encryption_key.encode())


def _decrypt(token: str) -> bytes | None:
    try:
        return _fernet().decrypt(token.encode())
    except (InvalidToken, ValueError):
        logger.error("Encrypted column could not be decrypted — SESSION_ENCRYPTION_KEY rotated?")
        return None


def read_stored(value: Any) -> Any:
    """A stored `EncryptedJSON` value as the app sees it: decrypted when it is a token, as it
    stands when it is a row from before encryption. Also what scripts reading the column with
    raw SQL use (`scripts/qa/*`), which get it as a dict or as JSON text depending on the
    driver."""
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, dict) or "enc" not in value:
        return value
    plain = _decrypt(value["enc"])
    return None if plain is None else json.loads(plain)


def read_text(value: Any) -> Any:
    """`read_stored` for an `EncryptedText` value."""
    if not isinstance(value, str) or not value.startswith(TOKEN_PREFIX):
        return value
    plain = _decrypt(value)
    return None if plain is None else plain.decode()


class _Encrypted(TypeDecorator):
    impl = Text
    cache_ok = True

    def compare_values(self, x: Any, y: Any) -> bool:
        # What the ORM asks to decide whether an assignment changed anything. None is
        # ambiguous here — a token this key cannot open reads as None too — so two Nones are
        # never "equal" and assigning None always writes NULL. Otherwise `_finish` clearing
        # such a row looked like no change and left the ciphertext behind (E2E, 2026-10-29).
        return x is not None and x == y


class EncryptedJSON(_Encrypted):
    """JSONB on Postgres, JSON elsewhere; the value inside is a Fernet token.

    `clear` names top-level keys kept readable beside the token — only for values that are
    not sensitive and that SQL has to filter on (`doc_type`, which says which of two
    layouts a document is, not anything printed on it).
    """

    impl = JSON

    def __init__(self, clear: tuple[str, ...] = ()):
        super().__init__()
        self.clear = clear

    def load_dialect_impl(self, dialect):
        # `none_as_null`: a cleared payload is SQL NULL. The plain JSON type stored Python
        # None as the JSON value `null`, so `_finish` "cleared" 77 dev rows to something
        # `IS NOT NULL` still matched (found 2026-10-29).
        impl = JSONB if dialect.name == "postgresql" else JSON
        return dialect.type_descriptor(impl(none_as_null=True))

    def process_bind_param(self, value: Any, dialect) -> Any:
        if value is None:
            return None
        stored: dict[str, Any] = {"enc": _fernet().encrypt(json.dumps(value).encode()).decode()}
        if isinstance(value, dict):
            stored.update({k: value[k] for k in self.clear if k in value})
        return stored

    def process_result_value(self, value: Any, dialect) -> Any:
        return read_stored(value)


class EncryptedText(_Encrypted):
    """TEXT holding a bare Fernet token."""

    def process_bind_param(self, value: Any, dialect) -> Any:
        return None if value is None else _fernet().encrypt(str(value).encode()).decode()

    def process_result_value(self, value: Any, dialect) -> Any:
        return read_text(value)
