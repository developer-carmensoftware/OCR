"""Encrypt what was written before its column was encrypted (2026-10-29).

Every new write is encrypted by the column type (`models/encrypted_json.py`); this is for
the rows already there when that shipped. Called once per environment, after the deploy,
through `POST /api/v1/admin/encryption/backfill` — never on startup and never from a
script, for two reasons found the hard way:

* It has to use the **deployed** server's `SESSION_ENCRYPTION_KEY`. Backends run from a
  laptop or a test worktree against the same dev database sometimes hold another key (the
  CI dummy one), and a row they encrypted would read as empty everywhere else.
* It has to run **after** the deploy. Until then the old code is serving, and it cannot read
  a token.

The UPDATE re-checks that a value is still plaintext, so a row `_finish` cleared, or another
call encrypted, in the meantime is left alone. Idempotent: a second call finds nothing.

`rotate_tokens` is the other half of a key rotation (docs/KEY_ROTATION.md): every token the
primary key cannot open, re-encrypted under it — the columns above plus the secrets stored
as bare tokens (session and BU credentials, PDF passwords).
"""

from __future__ import annotations

import uuid
from typing import Any

from cryptography.fernet import InvalidToken
from sqlalchemy import Text, and_, cast, func, inspect, or_, select, type_coerce, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import BillingDocument
from app.models.business import BugReport, CorrectionFeedback, OcrSession
from app.models.email_automation import EmailDocument, EmailIngestSettings
from app.models.encrypted_json import TOKEN_PREFIX, EncryptedJSON
from app.models.identity import Tenant
from app.models.pms import PmsEvent
from app.utils import crypto

# Every column the app encrypts. A new one is added here, and the backfill covers it.
COLUMNS = (
    EmailDocument.review_payload,
    EmailDocument.error_message,
    PmsEvent.review_payload,
    CorrectionFeedback.original_value,
    CorrectionFeedback.corrected_value,
    BugReport.screenshot_b64,
    BillingDocument.buyer_contact_name,
    BillingDocument.buyer_tel,
    BillingDocument.buyer_email,
    Tenant.contact_email,
    EmailIngestSettings.owner_emails,
)


def _plaintext(col):
    """SQL for "this value is set and is not a token". Read through `type_coerce`/`cast`:
    compared through the column's own type, the literal would be encrypted too."""
    if isinstance(col.expression.type, EncryptedJSON):
        stored, kind = cast(col, JSONB), func.jsonb_typeof(cast(col, JSONB))
        # Not SQL NULL (jsonb_typeof is NULL then) and not the JSON `null` the old `_finish`
        # left on cleared rows — those hold nothing to encrypt. A list (`owner_emails`) is
        # plaintext as much as an object without `enc` is.
        return and_(kind != "null", or_(kind != "object", ~stored.has_key("enc")))
    stored = type_coerce(col, Text)
    return and_(stored.isnot(None), ~stored.startswith(TOKEN_PREFIX))


def _tenant_col(model):
    return model.id if model is Tenant else model.tenant_id


async def encrypt_plaintext_columns(
    db: AsyncSession, *, dry_run: bool = False, tenant_ids: list[uuid.UUID] | None = None
) -> dict[str, int]:
    """`{"table.column": values found in plaintext}` — encrypted unless `dry_run`.

    `tenant_ids` narrows it to some BUs; the tenancy suite uses it, because that suite runs
    against the shared dev database and must not touch anybody else's rows.
    """
    found: dict[str, int] = {}
    for col in COLUMNS:
        model = col.class_
        pk = inspect(model).primary_key[0]  # email_ingest_settings is keyed on tenant_id
        plaintext = [_plaintext(col)]
        if tenant_ids is not None:
            plaintext.append(_tenant_col(model).in_(tenant_ids))
        ids = (await db.execute(select(pk).where(*plaintext))).scalars().all()
        found[f"{model.__tablename__}.{col.key}"] = len(ids)
        if dry_run:
            continue
        for row_id in ids:
            # Read through the column type (a plaintext value comes back as it stands), then
            # written back through it — which is what encrypts it.
            value = await db.scalar(select(col).where(pk == row_id))
            await db.execute(update(model).where(pk == row_id, *plaintext).values({col.key: value}))
        await db.commit()
    return found


# ── Key rotation ──────────────────────────────────────────────────────────────

# Secrets kept as bare Fernet tokens in plain TEXT columns, outside the column types above.
SECRET_COLUMNS = (OcrSession.carmen_token_encrypted, EmailIngestSettings.carmen_token_enc)

_CURRENT, _UNREADABLE = "current", "unreadable"


def _rotate(token: str) -> str:
    """`token` re-encrypted under the primary key — or `_CURRENT` if it already is one, or
    `_UNREADABLE` if no key we hold opens it (then it is left as it is, and counted)."""
    try:
        crypto.primary().decrypt(token.encode())
        return _CURRENT
    except InvalidToken:
        pass
    try:
        return crypto.fernet().rotate(token.encode()).decode()
    except InvalidToken:
        return _UNREADABLE


def _rewrite(kind: str, value: Any) -> tuple[Any, int]:
    """The stored value with its stale tokens rotated (None if none was stale), and how many
    tokens no key could open. `kind`: "text" (a bare token), "json" (`{"enc": …}`), or
    "rules" (`email_ingest_settings.rules`, each rule's `pdf_password_enc`)."""
    if kind == "rules":
        rules, changed, unreadable = [], False, 0
        for rule in value if isinstance(value, list) else []:
            token = rule.get("pdf_password_enc") if isinstance(rule, dict) else None
            new, bad = _rewrite("text", token)
            unreadable += bad
            changed |= new is not None
            rules.append({**rule, "pdf_password_enc": new} if new is not None else rule)
        return (rules if changed else None), unreadable
    if kind == "json":
        if not (isinstance(value, dict) and isinstance(value.get("enc"), str)):
            return None, 0  # plaintext from before encryption: the backfill's job, not this
        new, bad = _rewrite("text", value["enc"])
        return ({**value, "enc": new} if new is not None else None), bad
    if not (isinstance(value, str) and value.startswith(TOKEN_PREFIX)):
        return None, 0
    rotated = _rotate(value)
    if rotated == _UNREADABLE:
        return None, 1
    return (None if rotated == _CURRENT else rotated), 0


async def rotate_tokens(
    db: AsyncSession, *, dry_run: bool = False, tenant_ids: list[uuid.UUID] | None = None
) -> dict[str, dict[str, int]]:
    """`{"table.column": {"stale": n, "unreadable": m}}` — every token the primary key cannot
    open, re-encrypted under it unless `dry_run`. Done when every `stale` reads 0.

    Values are read and written raw (`type_coerce`/`cast`), so the column types do not
    encrypt a token a second time; each write is compare-and-set on the value it read.
    `unreadable` is a token no key we hold opens — left alone, since nothing can recover it.
    """
    targets = [
        *((c, "json" if isinstance(c.expression.type, EncryptedJSON) else "text") for c in COLUMNS),
        *((c, "text") for c in SECRET_COLUMNS),
        (EmailIngestSettings.rules, "rules"),
    ]
    report: dict[str, dict[str, int]] = {}
    for col, kind in targets:
        model = col.class_
        pk = inspect(model).primary_key[0]
        coerce = Text if kind == "text" else JSONB
        raw = type_coerce(col, Text) if kind == "text" else cast(col, JSONB)
        where = [raw.isnot(None)]
        if tenant_ids is not None:
            where.append(_tenant_col(model).in_(tenant_ids))
        stale = unreadable = 0
        for row_id, value in (await db.execute(select(pk, raw).where(*where))).all():
            new, bad = _rewrite(kind, value)
            unreadable += bad
            if new is None:
                continue
            stale += 1
            if not dry_run:
                await db.execute(
                    update(model)
                    .where(pk == row_id, raw == type_coerce(value, coerce))
                    .values({col.key: type_coerce(new, coerce)})
                )
        if not dry_run:
            await db.commit()
        report[f"{model.__tablename__}.{col.key}"] = {"stale": stale, "unreadable": unreadable}
    return report
