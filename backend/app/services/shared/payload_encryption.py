"""Encrypt the review payloads written before the columns were encrypted (2026-10-29).

Every new write is encrypted by the column type (`models/encrypted_json.py`); this is for
the rows already waiting when that shipped. Called once per environment, after the deploy,
through `POST /api/v1/admin/review-payloads/encrypt` — never on startup and never from a
script, for two reasons found the hard way:

* It has to use the **deployed** server's `SESSION_ENCRYPTION_KEY`. Backends run from a
  laptop or a test worktree against the same dev database sometimes hold another key (the
  CI dummy one), and a row they encrypted would read as empty everywhere else.
* It has to run **after** the deploy. Until then the old code is serving, and it cannot read
  `{"enc": …}`.

The UPDATE re-checks that a row is still plaintext and still set, so a document `_finish`
cleared, or another call encrypted, in the meantime is left alone. Idempotent: a second
call finds nothing.
"""

from __future__ import annotations

import uuid

from sqlalchemy import cast, func, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_automation import EmailDocument
from app.models.pms import PmsEvent


async def encrypt_plaintext_review_payloads(
    db: AsyncSession, *, dry_run: bool = False, tenant_ids: list[uuid.UUID] | None = None
) -> dict[str, int]:
    """`{table: rows found in plaintext}` — encrypted unless `dry_run`.

    `tenant_ids` narrows it to some BUs; the tenancy suite uses it, because that suite runs
    against the shared dev database and must not touch anybody else's rows.
    """
    found: dict[str, int] = {}
    for model in (EmailDocument, PmsEvent):
        stored = cast(model.review_payload, JSONB)
        plaintext = [
            # An object, so not SQL NULL and not the JSON `null` the old `_finish` left on
            # cleared rows — those hold nothing to encrypt.
            func.jsonb_typeof(stored) == "object",
            ~stored.has_key("enc"),
        ]
        if tenant_ids is not None:
            plaintext.append(model.tenant_id.in_(tenant_ids))
        ids = (await db.execute(select(model.id).where(*plaintext))).scalars().all()
        found[model.__tablename__] = len(ids)
        if dry_run:
            continue
        for row_id in ids:
            # Read through the column type (a plaintext row comes back as it stands), then
            # written back through it — which is what encrypts it.
            value = await db.scalar(select(model.review_payload).where(model.id == row_id))
            await db.execute(
                update(model).where(model.id == row_id, *plaintext).values(review_payload=value)
            )
        await db.commit()
    return found
