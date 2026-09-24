"""Two defects found reading the approve path while planning the multi-BU email QA run
(2026-09-24) — both real-DB reproductions, `xfail(strict=True)` so a fix flips them green
and an accidental regression flips them back to a hard failure.

DEF-1 — `approve_document`'s `FOR UPDATE` lock (`_claim_for_review`) is released when its
`async with async_session()` block closes, which is *before* `post_gljv` is awaited. Two
concurrent approvals of the same document (two reviewers in the same BU — the bell
notifies the whole BU, not one person) can both pass the lock and both post. `_finish` has
no `status == 'pending_review'` guard either, so nothing downstream catches it.

DEF-2 — `ApproveIn.extracted` is a client-supplied `dict`; `approve_document` passes
`extracted.id` straight to `_mark_submitted(extracted.id)`, which does
`db.get(CreditCard, uuid.UUID(card_id))` with **no tenant filter**. A reviewer in BU-B who
sends BU-A's card id in `extracted.id` stamps BU-A's `credit_cards.submitted_at` — BU-A's
next legitimate copy of that document is then misread as an already-posted duplicate.

Only `post_gljv` / `post_input_tax` / `es.posting_target` are patched (talking to a real
Carmen with fabricated data would be wrong regardless of which bug is under test); the
row lock, the status transition and `_mark_submitted`'s cross-tenant `db.get` are all real.
"""

import asyncio
import uuid

import pytest
from sqlalchemy import text

from app.models.schemas.ocr import ExtractedCreditCardData
from app.services import email_ingest_service as ingest

# `real_engine` and `tenants` are pytest fixtures pytest finds via conftest.py in this
# same directory — no import needed, and importing them would shadow the fixture-injected
# parameter of the same name in every test function below (ruff F811). Every test here is
# natively `async def` (`pytestmark` below), so — unlike sibling files with sync tests —
# nothing needs conftest's sync `run()` wrapper either.

pytestmark = pytest.mark.asyncio


async def _seed_pending(real_engine, tenant_id, *, marker: str) -> uuid.UUID:
    """One pending_review email_documents row, with its own ocr_task, under `tenant_id`."""
    task_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    async with real_engine.begin() as conn:
        await conn.execute(
            text(
                "insert into ocr_tasks (id, tenant_id, module_id, original_filename,"
                " status, charged_docs, created_at, updated_at)"
                " values (:id, :t, 'credit_card_ocr', :fn, 'completed', 1, now(), now())"
            ),
            {"id": task_id, "t": tenant_id, "fn": f"{marker}.pdf"},
        )
        await conn.execute(
            text(
                "insert into email_documents (id, tenant_id, task_id, message_id, attachment,"
                " status, bank_code, doc_no, review_payload, created_at, updated_at)"
                " values (:id, :t, :task, :msg, :att, 'pending_review', 'KTC', :doc,"
                " cast(:payload as jsonb), now(), now())"
            ),
            {
                "id": doc_id,
                "t": tenant_id,
                "task": task_id,
                "msg": f"<{marker}@integrity.test>",
                "att": f"{marker}.pdf",
                "doc": f"DOC-{marker}",
                "payload": f'{{"extracted": {{"doc_no": "DOC-{marker}"}}}}',
            },
        )
    return doc_id


async def _seed_unsubmitted_card(real_engine, tenant_id, *, marker: str) -> uuid.UUID:
    """A card that has NOT been posted — DEF-2's target: must stay that way."""
    task_id = uuid.uuid4()
    card_id = uuid.uuid4()
    async with real_engine.begin() as conn:
        await conn.execute(
            text(
                "insert into ocr_tasks (id, tenant_id, module_id, original_filename,"
                " status, charged_docs, created_at, updated_at)"
                " values (:id, :t, 'credit_card_ocr', :fn, 'completed', 1, now(), now())"
            ),
            {"id": task_id, "t": tenant_id, "fn": f"{marker}.pdf"},
        )
        await conn.execute(
            text(
                "insert into credit_cards (id, tenant_id, task_id, bank_code, doc_no,"
                " company_name, submitted_at, created_at, updated_at)"
                " values (:id, :t, :task, 'KTC', :doc, :co, NULL, now(), now())"
            ),
            {"id": card_id, "t": tenant_id, "task": task_id, "doc": f"DOC-{marker}", "co": marker},
        )
    return card_id


async def _card_submitted_at(real_engine, card_id):
    async with real_engine.begin() as conn:
        return await conn.scalar(
            text("select submitted_at from credit_cards where id = :i"), {"i": card_id}
        )


async def _doc_row(real_engine, doc_id):
    async with real_engine.begin() as conn:
        row = (
            (
                await conn.execute(
                    text("select status, jv_no from email_documents where id = :i"), {"i": doc_id}
                )
            )
            .mappings()
            .first()
        )
        return dict(row) if row else None


def _approve_env(*, post_delay: float = 0.0):
    """Patch only the Carmen-talking boundary; everything else (lock, status, DB writes)
    is the real service code running against the real dev DB."""
    calls = {"n": 0}

    async def _post(payload, token):
        calls["n"] += 1
        if post_delay:
            await asyncio.sleep(post_delay)
        return {"Code": 0, "InternalMessage": f"INTEGRITY-JV-{calls['n']}"}

    from unittest.mock import AsyncMock, patch

    return calls, [
        patch.object(
            ingest.es, "posting_target", AsyncMock(return_value=("tok", "https://fake.invalid"))
        ),
        patch.object(ingest, "post_gljv", _post),
        patch.object(ingest, "_post_input_tax", AsyncMock(return_value=None)),
    ]


def _extracted(**over):
    base = dict(doc_no="DOC-x", doc_date="01/01/2026", details=[])
    base.update(over)
    return ExtractedCreditCardData(**base)


# ── DEF-1 — concurrent approve double-posts ───────────────────────────────────


@pytest.mark.xfail(
    strict=True,
    reason="DEF-1: the review lock is released before post_gljv is "
    "awaited, so two concurrent approvals of one document "
    "both post. Fix: hold the row locked (or re-check status "
    "under a fresh lock) across the Carmen call.",
)
async def test_two_concurrent_approvals_post_exactly_once(real_engine, tenants):
    """Patches are entered ONCE, bracketing both concurrent calls, not once per call.

    `unittest.mock.patch.object` instances keep their "original value to restore" as
    instance state (`temp_original`); entering the *same* patch object a second time
    before the first has exited overwrites that bookkeeping with whatever is currently
    installed (the mock itself), so whichever call exits second would restore the
    attribute to the mock rather than the real function — permanently mocking
    `post_gljv` for every test that runs after this one in the same session. Two
    *separate* `_approve_env()` calls would dodge that, but would also patch
    `posting_target`/`post_input_tax` twice redundantly for no reason; entering the
    shared patches exactly once outside the concurrent calls is both correct and simpler.
    """
    marker = f"def1-{uuid.uuid4().hex[:8]}"
    doc_id = await _seed_pending(real_engine, tenants.a, marker=marker)
    calls, patches = _approve_env(post_delay=0.4)

    async def _approve():
        return await ingest.approve_document(
            doc_id,
            tenant_id=str(tenants.a),
            reviewer="reviewer-1",
            reviewer_name="Reviewer One",
            extracted=_extracted(doc_no=f"DOC-{marker}"),
            rows=[{"dept": "GEN", "acc": "1010", "desc": "x", "debit": 0, "credit": 100.0}],
            post_input_tax_record=False,
        )

    with patches[0], patches[1], patches[2]:
        results = await asyncio.gather(_approve(), _approve(), return_exceptions=True)
    posted_ok = [r for r in results if isinstance(r, dict)]
    refused = [r for r in results if isinstance(r, Exception)]

    row = await _doc_row(real_engine, doc_id)
    # The property that must hold: exactly one of the two calls actually posted a JV, and
    # the second was refused (ConflictError/NotFoundError) rather than also going through.
    assert calls["n"] == 1, (
        f"post_gljv called {calls['n']} times (expected 1) — {posted_ok=} {refused=}"
    )
    assert row["status"] == "posted"


# ── DEF-2 — cross-tenant write via a client-supplied extracted.id ────────────


@pytest.mark.xfail(
    strict=True,
    reason="DEF-2: approve_document._mark_submitted(extracted.id) "
    "does db.get(CreditCard, id) with no tenant filter, so a "
    "reviewer in one BU can stamp submitted_at on another "
    "BU's card by naming its id in the request body. Fix: "
    "filter _mark_submitted's lookup by tenant_id.",
)
async def test_approve_cannot_stamp_another_tenants_card(real_engine, tenants):
    marker = f"def2-{uuid.uuid4().hex[:8]}"
    victim_card_id = await _seed_unsubmitted_card(real_engine, tenants.a, marker=f"victim-{marker}")
    doc_id = await _seed_pending(real_engine, tenants.b, marker=f"attacker-{marker}")

    before = await _card_submitted_at(real_engine, victim_card_id)
    assert before is None

    calls, patches = _approve_env()
    with patches[0], patches[1], patches[2]:
        await ingest.approve_document(
            doc_id,
            tenant_id=str(tenants.b),
            reviewer="reviewer-b",
            reviewer_name="Reviewer B",
            # The attack: BU-B's own review screen sends BU-A's card id here. Nothing about
            # this payload is malformed — `extracted.id` is an ordinary client-supplied field.
            extracted=_extracted(id=str(victim_card_id), doc_no=f"DOC-attacker-{marker}"),
            rows=[{"dept": "GEN", "acc": "1010", "desc": "x", "debit": 0, "credit": 100.0}],
            post_input_tax_record=False,
        )

    after = await _card_submitted_at(real_engine, victim_card_id)
    assert after is None, (
        f"BU-B's approve stamped submitted_at on BU-A's card ({before!r} -> {after!r}) "
        "— a cross-tenant write with no tenant filter"
    )
