"""F-7 against the real dev DB — the near-duplicate lookup's query, not just its matching rule
(docs/email-automation/qa/2026-09-24-multi-bu-report.md, Round 2).

A KBank receipt printed `041125E00023869` was once posted as `041125E00023869767`. Both
duplicate checks compare doc_no exactly, so a correct reading of the same receipt would have
posted a second JV. `_possibly_posted` finds a posted document of *this* BU on the *same date*
whose number overlaps. The unit tests cover the matching rule; this covers what the query may
look at — above all, never another BU's documents.
"""

import uuid

import pytest
from sqlalchemy import text

from app.services import email_ingest_service as ingest

# `real_engine` / `tenants` come from conftest.py in this directory — see the note in
# test_email_approve_integrity.py on why they are not imported.

pytestmark = pytest.mark.asyncio

POSTED = "041125E00023869767"  # what was posted, misread
READ = "041125E00023869"  # what is printed


async def test_near_duplicate_lookup_is_scoped_to_the_tenant_and_the_date(real_engine, tenants):
    task = uuid.uuid4()
    async with real_engine.begin() as conn:
        await conn.execute(
            text(
                "insert into ocr_tasks (id, tenant_id, module_id, original_filename,"
                " status, charged_docs, created_at, updated_at)"
                " values (:id, :t, 'credit_card_ocr', 'f7.pdf', 'completed', 1, now(), now())"
            ),
            {"id": task, "t": tenants.a},
        )
        await conn.execute(
            text(
                "insert into credit_cards (id, tenant_id, task_id, bank_code, doc_no, doc_date,"
                " submitted_at, created_at, updated_at)"
                " values (:id, :t, :task, 'KBANK', :doc, date '2025-11-04', now(), now(), now())"
            ),
            {"id": uuid.uuid4(), "t": tenants.a, "task": task, "doc": POSTED},
        )
    try:
        # the F-7 case: same BU, same date, the printed number inside the posted one
        assert await ingest._possibly_posted(str(tenants.a), READ, "04/11/2025") == POSTED
        # another BU's posted document is never this BU's duplicate
        assert await ingest._possibly_posted(str(tenants.b), READ, "04/11/2025") is None
        # a different date is a different statement
        assert await ingest._possibly_posted(str(tenants.a), READ, "05/11/2025") is None
    finally:
        async with real_engine.begin() as conn:
            await conn.execute(text("delete from credit_cards where task_id = :t"), {"t": task})
            await conn.execute(text("delete from ocr_tasks where id = :t"), {"t": task})
