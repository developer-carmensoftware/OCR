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
"""

from __future__ import annotations

import uuid

from sqlalchemy import Text, and_, cast, func, select, type_coerce, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import BugReport, CorrectionFeedback
from app.models.email_automation import EmailDocument
from app.models.encrypted_json import TOKEN_PREFIX, EncryptedJSON
from app.models.pms import PmsEvent

# Every column the app encrypts. A new one is added here, and the backfill covers it.
COLUMNS = (
    EmailDocument.review_payload,
    PmsEvent.review_payload,
    CorrectionFeedback.original_value,
    CorrectionFeedback.corrected_value,
    BugReport.screenshot_b64,
)


def _plaintext(col):
    """SQL for "this value is set and is not a token". Read through `type_coerce`/`cast`:
    compared through the column's own type, the literal would be encrypted too."""
    if isinstance(col.expression.type, EncryptedJSON):
        stored = cast(col, JSONB)
        # An object, so not SQL NULL and not the JSON `null` the old `_finish` left on
        # cleared rows — those hold nothing to encrypt.
        return and_(func.jsonb_typeof(stored) == "object", ~stored.has_key("enc"))
    stored = type_coerce(col, Text)
    return and_(stored.isnot(None), ~stored.startswith(TOKEN_PREFIX))


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
        plaintext = [_plaintext(col)]
        if tenant_ids is not None:
            plaintext.append(model.tenant_id.in_(tenant_ids))
        ids = (await db.execute(select(model.id).where(*plaintext))).scalars().all()
        found[f"{model.__tablename__}.{col.key}"] = len(ids)
        if dry_run:
            continue
        for row_id in ids:
            # Read through the column type (a plaintext value comes back as it stands), then
            # written back through it — which is what encrypts it.
            value = await db.scalar(select(col).where(model.id == row_id))
            await db.execute(
                update(model).where(model.id == row_id, *plaintext).values({col.key: value})
            )
        await db.commit()
    return found
