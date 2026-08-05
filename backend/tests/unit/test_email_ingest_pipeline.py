"""
Unit tests for services/email_ingest_service.py's `_process_attachment` pipeline
and the `_claim` dedupe ledger.

Every collaborator (extraction, GL config, Carmen posting, credit consume/refund,
task creation) is monkeypatched at the name it is imported under in
email_ingest_service — the same style as test_carmen_proxy.py's `_patch_service`.
Only `_claim`/`_finish` (the ledger read/write) and the pure JV math in cc_jv.py
run for real, against a hand-built fake AsyncSession that stores/returns the
actual EmailDocument ORM instances in memory (no schema, no real DB).

Filenames use `.jpg` throughout so `ensure_pdf_openable` (a no-op for non-PDF
files) never needs mocking — it's covered directly in test_pdf_utils.py.
"""

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.config import AccountingConfigResponse
from app.models.schemas.ocr import ExtractedDetailRow
from app.services import email_ingest_service as ingest
from app.services.carmen_service import CarmenAPIError

TENANT_ID = str(uuid4())


# ── Fake AsyncSession ──────────────────────────────────────────────────────────


class _FakeDB:
    """In-memory stand-in for AsyncSession: real object identity through
    add()/get(), configurable commit() failure for the dedupe path."""

    def __init__(self, fail_commit_on_call: int | None = None):
        self.added: list = []
        self._fail_commit_on_call = fail_commit_on_call
        self._commit_calls = 0
        self.rollback = AsyncMock()

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self._commit_calls += 1
        if self._commit_calls == self._fail_commit_on_call:
            raise IntegrityError("dup", {}, Exception("unique violation"))

    async def get(self, model, ident):
        return next((o for o in self.added if getattr(o, "id", None) == ident), None)


def _session_factory(fake_db: _FakeDB):
    @asynccontextmanager
    async def _factory():
        yield fake_db

    return _factory


# ── Fixtures ────────────────────────────────────────────────────────────────────

MAPPINGS = {
    "commission": {"dept": "GEN", "acc": "5100"},
    "tax": {"dept": "GEN", "acc": "1150"},
    "net": {"dept": "GEN", "acc": "1010"},
    "Visa": {"dept": "GEN", "acc": "1130V"},
}


def _extracted(**overrides) -> ExtractedCreditCardData:
    defaults = dict(
        doc_no="INV-001",
        doc_date="15/01/2026",
        bank_company_name="Krungthai Card",
        bank_name="KTC",
        company_name="Test Hotel",
        doc_name="Fee invoice",
        raw_text="",
        tax_ids=["1234567890123"],
        is_duplicate=False,
        details=[
            ExtractedDetailRow(
                transaction="Visa",
                pay_amt="1000.00",
                commis_amt="30.00",
                tax_amt="2.10",
                total="967.90",
            )
        ],
    )
    defaults.update(overrides)
    return ExtractedCreditCardData(**defaults)


def _config(**overrides) -> AccountingConfigResponse:
    fields = {"mappings": MAPPINGS, "file_prefix": "PRE", "file_source": "SRC"}
    fields.update(overrides)
    return AccountingConfigResponse(**fields)


class _Patches:
    """Context manager bundling every collaborator patch _process_attachment needs."""

    def __init__(
        self,
        *,
        extracted: ExtractedCreditCardData,
        config: AccountingConfigResponse,
        carmen_result: dict | None,
        carmen_side_effect=None,
        suggested: dict | None = None,
    ):
        self.extracted = extracted
        self.config = config
        self.carmen_result = carmen_result
        self.carmen_side_effect = carmen_side_effect
        self.refund_document = AsyncMock()
        self.consume_document = AsyncMock(return_value="credit")
        self.mark_submitted = AsyncMock()
        self.suggest = AsyncMock(return_value=suggested or {})
        self.fill_missing_mappings = AsyncMock()
        self._stack = []

    def __enter__(self):
        patches = [
            patch.object(ingest, "assert_module_enabled", AsyncMock(return_value=None)),
            patch.object(ingest, "consume_document", self.consume_document),
            patch.object(ingest, "refund_document", self.refund_document),
            patch.object(ingest, "create_task", AsyncMock(return_value=MagicMock(id=uuid4()))),
            patch.object(
                ingest.ocr_service, "extract_stateless", AsyncMock(return_value=self.extracted)
            ),
            patch.object(ingest, "finalize_extraction", AsyncMock(return_value=self.extracted)),
            patch.object(ingest, "mark_task_failed", AsyncMock()),
            patch.object(ingest, "_mark_submitted", self.mark_submitted),
            patch.object(ingest, "get_accounting_config", AsyncMock(return_value=self.config)),
            patch.object(ingest, "_suggest_missing_mappings", self.suggest),
            patch.object(ingest, "fill_missing_mappings", self.fill_missing_mappings),
            patch.object(
                ingest,
                "post_gljv",
                AsyncMock(return_value=self.carmen_result, side_effect=self.carmen_side_effect),
            ),
        ]
        for p in patches:
            p.start()
            self._stack.append(p)
        return self

    def __exit__(self, *a):
        for p in reversed(self._stack):
            p.stop()


async def _run(
    fake_db,
    *,
    filename="statement.jpg",
    message_id="<msg-1@bank.co.th>",
    carmen_token="dev-tok",
    carmen_uri="https://hotel.carmenwork.com",
    **patch_kwargs,
):
    """Runs `_post_extracted` — everything from the ledger claim onwards, i.e. the
    half of the pipeline that runs once the document has named its owner.

    Returns (outcome, patches) so callers can assert on refund_document /
    consume_document calls, not just the outcome string.
    """
    with (
        patch.object(ingest, "async_session", _session_factory(fake_db)),
        _Patches(**patch_kwargs) as p,
    ):
        outcome = await ingest._post_extracted(
            extracted=p.extracted,
            tenant_id=TENANT_ID,
            message_id=message_id,
            filename=filename,
            bank_code=None,
            carmen_token=carmen_token,
            carmen_uri=carmen_uri,
        )
    return outcome, p


# ── Happy path ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_happy_path_posts_and_records_ledger():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-999"},
    )
    assert outcome == "posted"
    ledger = db.added[0]
    assert ledger.status == "posted"
    assert ledger.doc_no == "INV-001"
    assert ledger.jv_no == "JV-999"
    assert ledger.reason_code is None
    p.refund_document.assert_not_called()


@pytest.mark.asyncio
async def test_posting_stamps_submitted_at_so_the_duplicate_guard_sees_it():
    """The whole reason a re-forwarded document used to post twice.

    `is_duplicate` on the way in reads `submitted_at IS NOT NULL`; only the wizard
    ever wrote it, so this job was blind to its own postings (JV 966 + 967 for one
    SIAMPAY report, 2026-08-04).
    """
    db = _FakeDB()
    extracted = _extracted()
    extracted.id = "11111111-2222-3333-4444-555555555555"
    outcome, p = await _run(
        db,
        extracted=extracted,
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-999"},
    )
    assert outcome == "posted"
    p.mark_submitted.assert_awaited_once_with(extracted.id)


@pytest.mark.asyncio
async def test_rejected_jv_does_not_stamp_submitted_at():
    """Carmen declined, so nothing was posted — stamping would block the retry."""
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 1, "UserMessage": "Insufficient balance"},
    )
    assert outcome == "failed"
    p.mark_submitted.assert_not_awaited()


@pytest.mark.asyncio
async def test_already_submitted_document_never_reaches_carmen():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(is_duplicate=True),
        config=_config(),
        carmen_result={"Code": 0},
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "duplicate_document"
    p.mark_submitted.assert_not_awaited()
    p.refund_document.assert_awaited_once()


# ── Gates ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unmapped_bu_gets_ai_mappings_posts_and_saves_them():
    """A BU that never opened the mapping page must still post its first document.

    The guessed pairs are written back, so the second document of the same payment
    type is deterministic — that is what makes one AI guess acceptable.
    """
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(),
        config=_config(mappings={}),  # nothing mapped at all
        carmen_result={"Code": 0, "InternalMessage": "JV-1000"},
        suggested=MAPPINGS,
    )
    assert outcome == "posted"
    assert db.added[0].reason_code is None
    p.refund_document.assert_not_called()
    p.fill_missing_mappings.assert_awaited_once()
    assert p.fill_missing_mappings.await_args.args[2] == MAPPINGS


@pytest.mark.asyncio
async def test_mapping_incomplete_fails_and_refunds_when_ai_cannot_fill_it():
    """The fallback: no LLM answer, or Carmen's GL master was unreachable."""
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(),
        config=_config(mappings={}),
        carmen_result={"Code": 0},
        suggested={},  # AI produced nothing usable
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "mapping_incomplete"
    p.refund_document.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_fully_mapped_bu_never_calls_the_suggester():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-1"},
    )
    assert outcome == "posted"
    p.suggest.assert_not_awaited()
    p.fill_missing_mappings.assert_not_awaited()


@pytest.mark.asyncio
async def test_duplicate_document_fails_and_refunds():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(is_duplicate=True),
        config=_config(),
        carmen_result={"Code": 0},
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "duplicate_document"
    p.refund_document.assert_awaited_once()


# ── Carmen outcomes ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_carmen_declines_jv_fails_but_does_not_refund():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        message_id="<msg-2@bank.co.th>",
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 1, "UserMessage": "Insufficient balance"},
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "carmen_rejected"
    p.refund_document.assert_not_called()  # extraction was fine — Carmen just declined


@pytest.mark.asyncio
async def test_carmen_transport_failure_fails_but_does_not_refund():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        message_id="<msg-3@bank.co.th>",
        extracted=_extracted(),
        config=_config(),
        carmen_result=None,
        carmen_side_effect=CarmenAPIError(503, "upstream timeout"),
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "carmen_rejected"
    p.refund_document.assert_not_called()  # fate unknown — never auto-refund a maybe-posted JV


# ── Routing: the document names its own owner ─────────────────────────────────


async def _route(*, resolved, entitled=True, seen=False, extracted=None):
    """Runs `_process_attachment` up to (and not into) the posting half."""
    db = AsyncMock()
    db.get = AsyncMock(return_value=MagicMock())  # tenant row exists
    post = AsyncMock(return_value="posted")
    extract = AsyncMock(return_value=extracted if extracted is not None else _extracted())
    with (
        patch.object(ingest, "async_session", _session_factory(db)),
        patch.object(ingest, "_already_seen", AsyncMock(return_value=seen)),
        patch.object(ingest, "_open_or_fail", AsyncMock(return_value=None)),
        patch.object(ingest.ocr_service, "extract_stateless", extract),
        patch.object(ingest.es, "resolve_by_tax_ids", AsyncMock(return_value=resolved)),
        patch.object(ingest.es, "is_entitled", AsyncMock(return_value=entitled)),
        patch.object(ingest.es, "posting_target", AsyncMock(return_value=("tok", "https://h"))),
        patch.object(ingest, "_post_extracted", post),
    ):
        outcome = await ingest._process_attachment(
            message_id="<msg-route@bank.co.th>",
            sender="no-reply@ktc.co.th",
            filename="statement.jpg",
            blob=b"fake",
            rules=[],
            passwords=[],
        )
    return outcome, extract, post


@pytest.mark.asyncio
async def test_the_tax_id_on_the_document_picks_the_bu():
    outcome, _, post = await _route(resolved=MagicMock(tenant_id=uuid4()))
    assert outcome == "posted"
    assert post.await_args.kwargs["tenant_id"]


@pytest.mark.asyncio
async def test_a_document_belonging_to_nobody_is_dropped_without_charging_anyone():
    """We paid for the extraction; that is the accepted price of one shared address.

    What must not happen is a stranger's document costing a *customer* anything —
    no ledger row, no credit, no JV.
    """
    outcome, _, post = await _route(resolved=None)
    assert outcome == "unrouted"
    post.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_lapsed_package_stops_the_document_after_routing():
    """Settings are not rewritten when a subscription ends, so `enabled` stays true.

    The gate has to be here as well as on the toggle, or a customer keeps ingesting
    after their package lapses.
    """
    outcome, _, post = await _route(resolved=MagicMock(tenant_id=uuid4()), entitled=False)
    assert outcome == "skipped"
    post.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_message_seen_before_is_never_extracted_again():
    """Dedupe moved ahead of extraction — otherwise a redelivery costs an LLM call."""
    outcome, extract, post = await _route(resolved=MagicMock(tenant_id=uuid4()), seen=True)
    assert outcome == "skipped"
    extract.assert_not_awaited()
    post.assert_not_awaited()


@pytest.mark.asyncio
async def test_the_document_is_extracted_exactly_once():
    """Routing needs the content, so extraction runs before the owner is known —
    and must not be repeated once it is."""
    _, extract, post = await _route(resolved=MagicMock(tenant_id=uuid4()))
    extract.assert_awaited_once()
    # the posting half receives the already-extracted document, not the bytes
    assert "blob" not in post.await_args.kwargs
    assert post.await_args.kwargs["extracted"] is extract.return_value


# ── run_ingest ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_ingest_reads_the_rule_and_password_pool_once_per_poll():
    messages = [
        {
            "message_id": "<msg-a@bank.co.th>",
            "subject": "statement",
            "from": "no-reply@ktc.co.th",
            "attachments": [("a.jpg", b"fake"), ("b.jpg", b"fake")],
        },
        {
            "message_id": "<msg-b@bank.co.th>",
            "subject": "no attachment",
            "from": "someone@hotelgroup.com",
            "attachments": [],
        },
    ]
    pool = AsyncMock(return_value=([{"bank_code": "KTC"}], ["pw"]))
    process = AsyncMock(side_effect=["posted", "unrouted"])
    with (
        patch.object(ingest.settings, "imap_host", "imap.example.com"),
        patch.object(ingest, "_fetch_unseen", lambda limit: messages),
        patch.object(ingest, "async_session", _session_factory(AsyncMock())),
        patch.object(ingest.es, "ingest_pool", pool),
        patch.object(ingest, "_process_attachment", process),
    ):
        summary = await ingest.run_ingest(limit=5)

    pool.assert_awaited_once()  # not once per attachment
    assert summary == {"messages": 2, "posted": 1, "failed": 0, "skipped": 1, "unrouted": 1}
    assert process.await_args.kwargs["passwords"] == ["pw"]


# ── Ledger dedupe (_claim in isolation) ────────────────────────────────────────


@pytest.mark.asyncio
async def test_claim_dedupes_on_integrity_error_second_attempt():
    db = _FakeDB(fail_commit_on_call=2)
    first = await ingest._claim(db, TENANT_ID, "<msg-4@bank.co.th>", "statement.jpg")
    assert first is not None
    second = await ingest._claim(db, TENANT_ID, "<msg-4@bank.co.th>", "statement.jpg")
    assert second is None
    db.rollback.assert_awaited_once()


# ── Deferred LLM cost (the bug a live run found on 2026-08-05) ────────────────


@pytest.mark.asyncio
async def test_extraction_cost_is_parked_then_written_with_the_tenant_that_owned_it():
    """`llm_usage_logs.tenant_id` is NOT NULL, and email ingest extracts before it
    knows whose document it is.

    Without parking, that insert raises inside log_llm_usage's own
    except-and-continue and the cost disappears — a live run logged zero rows.
    """
    from app.context import current_tenant_id, pending_llm_usage
    from app.services import llm_usage_logger as lu

    written = []
    ctx = pending_llm_usage.set([])
    try:
        with patch.object(lu, "async_session", _session_factory(_FakeDB())):
            # no tenant yet — must not reach the DB
            await lu.log_llm_usage("m", 10, 5, 15, module_id="credit_card_ocr")
            assert len(pending_llm_usage.get()) == 1

            tctx = current_tenant_id.set(TENANT_ID)
            try:
                with patch.object(
                    lu, "log_llm_usage", AsyncMock(side_effect=lambda **kw: written.append(kw))
                ):
                    n = await lu.flush_pending_usage(task_id="task-1")
            finally:
                current_tenant_id.reset(tctx)
    finally:
        pending_llm_usage.reset(ctx)

    assert n == 1
    assert written[0]["task_id"] == "task-1"
    assert written[0]["model"] == "m"
    assert pending_llm_usage.get() is None  # buffer left clean for the next document


@pytest.mark.asyncio
async def test_a_normal_request_is_unaffected_by_the_parking_buffer():
    """No buffer set (every wizard call) → straight to the DB as before."""
    from app.context import current_tenant_id
    from app.services import llm_usage_logger as lu

    db = _FakeDB()
    tctx = current_tenant_id.set(TENANT_ID)
    try:
        with patch.object(lu, "async_session", _session_factory(db)):
            await lu.log_llm_usage("m", 10, 5, 15, module_id="credit_card_ocr")
    finally:
        current_tenant_id.reset(tctx)
    assert len(db.added) == 1
    assert str(db.added[0].tenant_id) == TENANT_ID


# ── Input tax: the statement's second Carmen document ─────────────────────────


@pytest.mark.asyncio
async def test_input_tax_is_posted_after_the_jv():
    """The wizard's step 4. Email automation has no step 4, so the job does it."""
    db = _FakeDB()
    post_tax = AsyncMock(return_value=None)
    with patch.object(ingest, "_post_input_tax", post_tax):
        outcome, _ = await _run(
            db,
            extracted=_extracted(),
            config=_config(),
            carmen_result={"Code": 0, "InternalMessage": "JV-999"},
        )
    assert outcome == "posted"
    post_tax.assert_awaited_once()
    assert db.added[0].error_message is None


@pytest.mark.asyncio
async def test_a_failed_input_tax_never_unposts_the_jv_or_refunds():
    """The JV is already in Carmen's books and there is no rollback.

    Marking the document failed would refund a credit for work that was done and
    hide a real JV behind a 'failed' row; the note on the ledger is what tells a
    human to add the input tax by hand.
    """
    db = _FakeDB()
    note = "JV posted; input tax not recorded: Carmen said no"
    with patch.object(ingest, "_post_input_tax", AsyncMock(return_value=note)):
        outcome, p = await _run(
            db,
            extracted=_extracted(),
            config=_config(),
            carmen_result={"Code": 0, "InternalMessage": "JV-999"},
        )
    assert outcome == "posted"
    assert db.added[0].status == "posted"
    assert db.added[0].jv_no == "JV-999"
    assert db.added[0].error_message == note
    p.refund_document.assert_not_called()


@pytest.mark.asyncio
async def test_a_rejected_jv_never_reaches_the_input_tax_step():
    """No JV, no VAT to claim against it."""
    db = _FakeDB()
    post_tax = AsyncMock(return_value=None)
    with patch.object(ingest, "_post_input_tax", post_tax):
        outcome, _ = await _run(
            db,
            extracted=_extracted(),
            config=_config(),
            carmen_result={"Code": 1, "UserMessage": "Insufficient balance"},
        )
    assert outcome == "failed"
    post_tax.assert_not_awaited()
