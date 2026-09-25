"""The approve/reject path against the real dev DB — regressions for two defects the
2026-09-24 multi-BU QA run found (docs/email-automation/qa/2026-09-24-multi-bu-report.md).

DEF-1 — `_claim_for_review` used to take `SELECT … FOR UPDATE` in a session that closed
before `post_gljv` was awaited, so two concurrent approvals of one document (two reviewers
in one BU — the bell notifies the whole BU) both posted a JV. Fixed with a claim that lives
in the row (`email_documents.posting_started_at`): a compare-and-set taken before Carmen is
called, given back on every path that does not finish, and expiring after
`POSTING_CLAIM_TTL` so a dead process cannot strand the document.

DEF-2 — `approve_document` passed the client-supplied `extracted.id` to `_mark_submitted`,
which loaded the card with no tenant filter, so a reviewer in BU-B could stamp BU-A's card.
Fixed by stamping through the ledger row's own `task_id` with the tenant in the WHERE clause.

Only `post_gljv` / `post_input_tax` / `es.posting_target` are patched (talking to a real
Carmen with fabricated data would be wrong regardless of what is under test); the claim, the
status transitions and `_mark_submitted`'s lookup are the real code on the real database.
"""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import text

from app.exceptions import ConflictError, ValidationError
from app.models.schemas.ocr import ExtractedCreditCardData
from app.services import email_ingest_service as ingest

# `real_engine` and `tenants` are pytest fixtures pytest finds via conftest.py in this
# same directory — no import needed, and importing them would shadow the fixture-injected
# parameter of the same name in every test function below (ruff F811). Every test here is
# natively `async def` (`pytestmark` below), so — unlike sibling files with sync tests —
# nothing needs conftest's sync `run()` wrapper either.

pytestmark = pytest.mark.asyncio

ROWS = [{"dept": "GEN", "acc": "1010", "desc": "x", "debit": 0, "credit": 100.0}]


async def _seed_pending(
    real_engine, tenant_id, *, marker: str, claimed_at=None, with_card: bool = False
) -> uuid.UUID:
    """One pending_review email_documents row, with its own ocr_task (and, optionally, the
    credit_cards header that task produced), under `tenant_id`."""
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
        if with_card:
            await conn.execute(
                text(
                    "insert into credit_cards (id, tenant_id, task_id, bank_code, doc_no,"
                    " company_name, submitted_at, created_at, updated_at)"
                    " values (:id, :t, :task, 'KTC', :doc, :co, NULL, now(), now())"
                ),
                {
                    "id": uuid.uuid4(),
                    "t": tenant_id,
                    "task": task_id,
                    "doc": f"DOC-{marker}",
                    "co": marker,
                },
            )
        await conn.execute(
            text(
                "insert into email_documents (id, tenant_id, task_id, message_id, attachment,"
                " status, bank_code, doc_no, review_payload, posting_started_at,"
                " created_at, updated_at)"
                " values (:id, :t, :task, :msg, :att, 'pending_review', 'KTC', :doc,"
                " cast(:payload as jsonb), :claimed, now(), now())"
            ),
            {
                "id": doc_id,
                "t": tenant_id,
                "task": task_id,
                "msg": f"<{marker}@integrity.test>",
                "att": f"{marker}.pdf",
                "doc": f"DOC-{marker}",
                "payload": f'{{"extracted": {{"doc_no": "DOC-{marker}"}}}}',
                "claimed": claimed_at,
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


async def _own_card_submitted_at(real_engine, doc_id):
    """submitted_at of the card belonging to this ledger row's own task."""
    async with real_engine.begin() as conn:
        return await conn.scalar(
            text(
                "select c.submitted_at from credit_cards c"
                " join email_documents d on d.task_id = c.task_id where d.id = :i"
            ),
            {"i": doc_id},
        )


async def _doc_row(real_engine, doc_id):
    async with real_engine.begin() as conn:
        row = (
            (
                await conn.execute(
                    text(
                        "select status, jv_no, posting_started_at"
                        " from email_documents where id = :i"
                    ),
                    {"i": doc_id},
                )
            )
            .mappings()
            .first()
        )
        return dict(row) if row else None


def _approve_env(*, post_delay: float = 0.0, result=None):
    """Patch only the Carmen-talking boundary; everything else (claim, status, DB writes)
    is the real service code running against the real dev DB."""
    calls = {"n": 0}

    async def _post(payload, token):
        calls["n"] += 1
        if post_delay:
            await asyncio.sleep(post_delay)
        return result or {"Code": 0, "InternalMessage": f"INTEGRITY-JV-{calls['n']}"}

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


def _approve(doc_id, tenant_id, marker, **kw):
    return ingest.approve_document(
        doc_id,
        tenant_id=str(tenant_id),
        reviewer="reviewer",
        reviewer_name="Reviewer",
        extracted=_extracted(doc_no=f"DOC-{marker}", **kw),
        rows=ROWS,
        post_input_tax_record=False,
    )


# ── DEF-1 — one document, one JV ──────────────────────────────────────────────


async def test_two_concurrent_approvals_post_exactly_once(real_engine, tenants):
    """Patches are entered ONCE, bracketing both concurrent calls, not once per call.

    `unittest.mock.patch.object` instances keep their "original value to restore" as
    instance state (`temp_original`); entering the *same* patch object a second time
    before the first has exited overwrites that bookkeeping with whatever is currently
    installed (the mock itself), so whichever call exits second would restore the
    attribute to the mock rather than the real function — permanently mocking
    `post_gljv` for every test that runs after this one in the same session.
    """
    marker = f"def1-{uuid.uuid4().hex[:8]}"
    doc_id = await _seed_pending(real_engine, tenants.a, marker=marker)
    calls, patches = _approve_env(post_delay=0.4)

    with patches[0], patches[1], patches[2]:
        results = await asyncio.gather(
            _approve(doc_id, tenants.a, marker),
            _approve(doc_id, tenants.a, marker),
            return_exceptions=True,
        )
    posted_ok = [r for r in results if isinstance(r, dict)]
    refused = [r for r in results if isinstance(r, Exception)]

    assert calls["n"] == 1, f"post_gljv called {calls['n']} times — {posted_ok=} {refused=}"
    assert len(refused) == 1 and isinstance(refused[0], ConflictError), refused
    row = await _doc_row(real_engine, doc_id)
    assert row["status"] == "posted"
    assert row["posting_started_at"] is None


async def test_a_reject_racing_an_approve_cannot_land(real_engine, tenants):
    """A reject arriving while the JV is going into Carmen must not mark the row rejected."""
    marker = f"def1r-{uuid.uuid4().hex[:8]}"
    doc_id = await _seed_pending(real_engine, tenants.a, marker=marker)
    calls, patches = _approve_env(post_delay=0.4)

    async def _reject_mid_post():
        await asyncio.sleep(0.1)  # the approve has claimed the row and is inside post_gljv
        return await ingest.reject_document(doc_id, tenant_id=str(tenants.a), reviewer="r2")

    with patches[0], patches[1], patches[2]:
        approved, rejected = await asyncio.gather(
            _approve(doc_id, tenants.a, marker), _reject_mid_post(), return_exceptions=True
        )

    assert isinstance(approved, dict), approved
    assert isinstance(rejected, ConflictError), rejected
    assert calls["n"] == 1
    assert (await _doc_row(real_engine, doc_id))["status"] == "posted"


async def test_a_carmen_rejection_gives_the_claim_back(real_engine, tenants):
    """Carmen refused the JV (closed period, unknown dept): the reviewer fixes it and
    presses Approve again straight away — not five minutes later."""
    marker = f"def1c-{uuid.uuid4().hex[:8]}"
    doc_id = await _seed_pending(real_engine, tenants.a, marker=marker)

    _, refused = _approve_env(result={"Code": -1, "UserMessage": "Period is closed"})
    with refused[0], refused[1], refused[2], pytest.raises(ValidationError):
        await _approve(doc_id, tenants.a, marker)
    row = await _doc_row(real_engine, doc_id)
    assert row["status"] == "pending_review"
    assert row["posting_started_at"] is None

    calls, ok = _approve_env()
    with ok[0], ok[1], ok[2]:
        await _approve(doc_id, tenants.a, marker)
    assert calls["n"] == 1
    assert (await _doc_row(real_engine, doc_id))["status"] == "posted"


async def test_a_claim_left_by_a_dead_process_expires(real_engine, tenants):
    marker = f"def1e-{uuid.uuid4().hex[:8]}"
    stale = datetime.now(UTC) - ingest.POSTING_CLAIM_TTL - timedelta(seconds=5)
    doc_id = await _seed_pending(real_engine, tenants.a, marker=marker, claimed_at=stale)

    calls, patches = _approve_env()
    with patches[0], patches[1], patches[2]:
        await _approve(doc_id, tenants.a, marker)
    assert calls["n"] == 1
    assert (await _doc_row(real_engine, doc_id))["status"] == "posted"


async def test_a_live_claim_turns_a_second_approve_away(real_engine, tenants):
    marker = f"def1l-{uuid.uuid4().hex[:8]}"
    doc_id = await _seed_pending(
        real_engine, tenants.a, marker=marker, claimed_at=datetime.now(UTC)
    )

    calls, patches = _approve_env()
    with patches[0], patches[1], patches[2], pytest.raises(ConflictError):
        await _approve(doc_id, tenants.a, marker)
    assert calls["n"] == 0
    assert (await _doc_row(real_engine, doc_id))["status"] == "pending_review"


# ── DEF-2 — the card that gets stamped is this BU's own ───────────────────────


async def test_approve_cannot_stamp_another_tenants_card(real_engine, tenants):
    marker = f"def2-{uuid.uuid4().hex[:8]}"
    victim_card_id = await _seed_unsubmitted_card(real_engine, tenants.a, marker=f"victim-{marker}")
    doc_id = await _seed_pending(real_engine, tenants.b, marker=f"attacker-{marker}")

    assert await _card_submitted_at(real_engine, victim_card_id) is None

    _, patches = _approve_env()
    with patches[0], patches[1], patches[2]:
        # The attack: BU-B's own review screen sends BU-A's card id. Nothing about this
        # payload is malformed — `extracted.id` is an ordinary client-supplied field.
        await _approve(doc_id, tenants.b, f"attacker-{marker}", id=str(victim_card_id))

    assert await _card_submitted_at(real_engine, victim_card_id) is None


async def test_approve_stamps_the_documents_own_card(real_engine, tenants):
    """The positive half: the duplicate guard must still see what this BU posted."""
    marker = f"def2own-{uuid.uuid4().hex[:8]}"
    doc_id = await _seed_pending(real_engine, tenants.a, marker=marker, with_card=True)
    assert await _own_card_submitted_at(real_engine, doc_id) is None

    _, patches = _approve_env()
    with patches[0], patches[1], patches[2]:
        await _approve(doc_id, tenants.a, marker)

    assert await _own_card_submitted_at(real_engine, doc_id) is not None
