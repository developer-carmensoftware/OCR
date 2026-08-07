"""
Unit tests for services/email_ingest_service.py's `_process_attachment` pipeline
and the `_claim` dedupe ledger.

Every collaborator (extraction, GL config, Carmen posting, credit consume/refund,
task creation) is monkeypatched at the name it is imported under in
email_ingest_service — the same style as test_carmen_proxy.py's `_patch_service`.
Only `_claim`/`_finish` (the ledger read/write) and the pure JV math in cc_jv.py
run for real, against a hand-built fake AsyncSession that stores/returns the
actual EmailDocument ORM instances in memory (no schema, no real DB).

`_open_or_fail` is mocked because the blobs are `b"fake"`, which the magic-byte
check correctly refuses; the gate itself is tested separately below.
"""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
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
        conflict: str | None = None,
        tax_note: str | None = None,
        extract_side_effect=None,
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
        self.extract = AsyncMock(return_value=extracted, side_effect=extract_side_effect)
        self.open_or_fail = AsyncMock(return_value=None)
        self.foreign_tax_id = AsyncMock(return_value=conflict)
        self.post_input_tax = AsyncMock(return_value=tax_note)
        self._stack = []

    def __enter__(self):
        patches = [
            patch.object(ingest, "assert_module_enabled", AsyncMock(return_value=None)),
            patch.object(ingest, "consume_document", self.consume_document),
            patch.object(ingest, "refund_document", self.refund_document),
            patch.object(ingest, "create_task", AsyncMock(return_value=MagicMock(id=uuid4()))),
            patch.object(ingest.ocr_service, "extract_stateless", self.extract),
            patch.object(ingest, "_open_or_fail", self.open_or_fail),
            patch.object(ingest.es, "foreign_tax_id", self.foreign_tax_id),
            patch.object(ingest, "_post_input_tax", self.post_input_tax),
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


# One "Other" rule that claims any .jpg — the gate is exercised on its own below.
RULES = [{"bank_code": None, "filename_patterns": [".jpg"], "is_active": True}]


async def _run(
    fake_db,
    *,
    filename="statement.jpg",
    message_id="<msg-1@bank.co.th>",
    sender="no-reply@ktc.co.th",
    rules=None,
    carmen_token="dev-tok",
    carmen_uri="https://hotel.carmenwork.com",
    **patch_kwargs,
):
    """Runs `_process_attachment` — the whole per-attachment pipeline for a tenant the
    envelope already identified: claim, gate, charge, extract, verify, post.

    Returns (outcome, patches) so callers can assert on refund_document /
    consume_document / extract calls, not just the outcome string.
    """
    with (
        patch.object(ingest, "async_session", _session_factory(fake_db)),
        _Patches(**patch_kwargs) as p,
    ):
        outcome = await ingest._process_attachment(
            tenant_id=TENANT_ID,
            message_id=message_id,
            sender=sender,
            filename=filename,
            blob=b"fake",
            rules=RULES if rules is None else rules,
            passwords=[],
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


# ── Gate: an attachment no rule claims is never extracted ─────────────────────


@pytest.mark.asyncio
async def test_a_filename_no_rule_claims_is_never_sent_to_the_llm():
    """The whole point of the gate, and of tag-first ordering.

    Before, a non-match merely meant "no bank hint" and the attachment was extracted
    with the generic prompt — so every signature logo in a forwarded chain was its own
    LLM call. Now it stops, costs nothing, and is still diagnosable: the tag already
    named the tenant, so the miss lands in *that BU's* ledger instead of vanishing.
    """
    db = _FakeDB()
    outcome, p = await _run(
        db,
        filename="signature-logo.jpg",
        rules=[{"bank_code": "KTC", "filename_patterns": ["MDR"], "is_active": True}],
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0},
    )
    assert outcome == "skipped"
    assert db.added[0].status == "skipped"
    assert db.added[0].reason_code == "no_rule_match"
    p.extract.assert_not_awaited()
    p.consume_document.assert_not_awaited()
    p.refund_document.assert_not_called()


@pytest.mark.asyncio
async def test_a_sender_hit_does_not_buy_a_filename_miss_an_llm_call():
    """Mail from KTC's address carrying a file only the BBL rule names must stop."""
    db = _FakeDB()
    outcome, p = await _run(
        db,
        filename="statement.jpg",
        sender="no-reply@ktc.co.th",
        rules=[
            {
                "bank_code": "KTC",
                "bank_sender_email": "no-reply@ktc.co.th",
                "filename_patterns": ["MDR"],
                "is_active": True,
            },
            {"bank_code": "BBL", "filename_patterns": ["statement"], "is_active": True},
        ],
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0},
    )
    assert outcome == "skipped"
    assert db.added[0].reason_code == "no_rule_match"
    p.extract.assert_not_awaited()


@pytest.mark.asyncio
async def test_one_matching_rule_names_the_bank_for_the_prompt():
    db = _FakeDB()
    _, p = await _run(
        db,
        filename="MDR-aug.jpg",
        rules=[{"bank_code": "KTC", "filename_patterns": ["MDR"], "is_active": True}],
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-1"},
    )
    assert p.extract.await_args.kwargs["bank_code"] == "KTC"


@pytest.mark.asyncio
async def test_overlapping_rules_leave_the_bank_to_the_document():
    """Two rules naming the same filename is a config overlap. Guessing the prompt is
    worse than the generic one — detect_bank_code reads the document instead."""
    db = _FakeDB()
    _, p = await _run(
        db,
        filename="report.jpg",
        rules=[
            {"bank_code": "KTC", "filename_patterns": ["report"], "is_active": True},
            {"bank_code": "GHL", "filename_patterns": ["report"], "is_active": True},
        ],
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-1"},
    )
    assert p.extract.await_args.kwargs["bank_code"] is None


# ── The second factor: the tax ID verifies, it no longer routes ───────────────


@pytest.mark.asyncio
async def test_a_document_whose_tax_id_belongs_to_another_bu_is_parked():
    """The envelope said who owns the mail; the document says someone else.

    Two signals that disagree stop the post rather than picking a winner — money in the
    wrong company's ledger is the one outcome unattended posting cannot recover from.
    """
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0},
        conflict="0994000165676",
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "tax_id_mismatch"
    p.refund_document.assert_awaited_once()


@pytest.mark.asyncio
async def test_a_document_printing_no_matching_tax_id_still_posts():
    """Positive evidence only. Some fee invoices never print the buyer's TIN, and
    parking those would break legitimate documents to catch nothing."""
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(tax_ids=[]),
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-1"},
    )
    assert outcome == "posted"
    p.foreign_tax_id.assert_awaited_once()


# ── Dedupe: one atomic claim, before anything is opened or extracted ──────────


@pytest.mark.asyncio
async def test_an_attachment_already_handled_is_never_extracted_again():
    """A redelivered mail must not cost an LLM call.

    With the tenant known up front the claim can use `uq_email_documents_message`
    directly — the pre-extraction full-table scan it replaces existed only because the
    tenant was not.
    """
    db = _FakeDB(fail_commit_on_call=1)
    outcome, p = await _run(db, extracted=_extracted(), config=_config(), carmen_result={"Code": 0})
    assert outcome == "skipped"
    p.extract.assert_not_awaited()
    p.consume_document.assert_not_awaited()


@pytest.mark.asyncio
async def test_claim_dedupes_on_integrity_error_second_attempt():
    db = _FakeDB(fail_commit_on_call=2)
    first = await ingest._claim(db, TENANT_ID, "<msg-4@bank.co.th>", "statement.jpg")
    assert first is not None
    second = await ingest._claim(db, TENANT_ID, "<msg-4@bank.co.th>", "statement.jpg")
    assert second is None
    db.rollback.assert_awaited_once()


# ── Routing: the envelope names the owner, before any money is spent ──────────

ADDRESS = "AIAGENT@carmensoftware.com"
TAGGED = "Delivered-To: AIAGENT+a1b2c3d4@carmensoftware.com"


def _settings_row(**overrides):
    defaults = dict(tenant_id=uuid4(), rules=[], tax_ids=[], ingest_tag="a1b2c3d4")
    defaults.update(overrides)
    return MagicMock(**defaults)


async def _route(
    *,
    resolved,
    entitled=True,
    recipients=(TAGGED,),
    attachments=None,
    sender="no-reply@ktc.co.th",
    subject="statement",
    record=None,
):
    """Runs `_process_message` — up to (and not into) the per-attachment half."""
    db = AsyncMock()
    db.get = AsyncMock(return_value=MagicMock())  # tenant row exists
    process = AsyncMock(return_value="posted")
    extract = AsyncMock(return_value=_extracted())
    with (
        patch.object(ingest.settings, "email_ingest_address", ADDRESS),
        patch.object(ingest, "async_session", _session_factory(db)),
        patch.object(ingest.es, "resolve_by_tag", AsyncMock(return_value=resolved)),
        patch.object(ingest.es, "is_entitled", AsyncMock(return_value=entitled)),
        patch.object(ingest.es, "rule_passwords", MagicMock(return_value=["pw"])),
        patch.object(ingest.es, "posting_target", AsyncMock(return_value=("tok", "https://h"))),
        patch.object(ingest.es, "record_gmail_code", record or AsyncMock()),
        patch.object(ingest.ocr_service, "extract_stateless", extract),
        patch.object(ingest, "_process_attachment", process),
    ):
        outcomes = await ingest._process_message(
            {
                "message_id": "<msg-route@bank.co.th>",
                "subject": subject,
                "from": sender,
                "recipients": list(recipients),
                "attachments": (
                    [("statement.jpg", b"fake")] if attachments is None else list(attachments)
                ),
            }
        )
    return outcomes, extract, process


@pytest.mark.asyncio
async def test_the_tag_on_the_envelope_picks_the_bu():
    row = _settings_row()
    outcomes, _, process = await _route(resolved=row)
    assert outcomes == ["posted"]
    assert process.await_args.kwargs["tenant_id"] == str(row.tenant_id)
    # This BU's own passwords, not every customer's — the tag named the owner before
    # the file was opened, so there is nothing left to pool across tenants.
    assert process.await_args.kwargs["passwords"] == ["pw"]


@pytest.mark.asyncio
async def test_an_unknown_tag_costs_nothing():
    """The assertion the whole change exists for."""
    outcomes, extract, process = await _route(resolved=None)
    assert outcomes == ["unrouted"]
    extract.assert_not_awaited()
    process.assert_not_awaited()


@pytest.mark.asyncio
async def test_mail_to_the_bare_address_costs_nothing():
    """Refused outright. Nobody is ever shown an untagged address, so accepting it
    would only keep the pay-then-ask-who path permanently open."""
    outcomes, extract, process = await _route(
        resolved=_settings_row(), recipients=("Delivered-To: AIAGENT@carmensoftware.com",)
    )
    assert outcomes == ["unrouted"]
    extract.assert_not_awaited()
    process.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_message_with_no_attachment_never_reaches_the_database():
    outcomes, extract, process = await _route(resolved=_settings_row(), attachments=[])
    assert outcomes == ["skipped"]
    extract.assert_not_awaited()
    process.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_lapsed_package_stops_the_message_before_any_extraction():
    """Settings are not rewritten when a subscription ends, so `enabled` stays true.

    The gate has to be here as well as on the toggle, or a customer keeps ingesting
    after their package lapses.
    """
    outcomes, extract, process = await _route(resolved=_settings_row(), entitled=False)
    assert outcomes == ["skipped"]
    extract.assert_not_awaited()
    process.assert_not_awaited()


@pytest.mark.asyncio
async def test_every_attachment_of_one_message_gets_its_own_outcome():
    outcomes, _, process = await _route(
        resolved=_settings_row(), attachments=[("a.jpg", b"x"), ("b.jpg", b"y")]
    )
    assert outcomes == ["posted", "posted"]
    assert process.await_count == 2


# ── Gmail's forwarding confirmation ───────────────────────────────────────────

_CONFIRM = "forwarding-noreply@google.com"
_CONFIRM_SUBJECT = "(#123456789) Gmail Forwarding Confirmation - Receive Mail from x@y.com"


@pytest.mark.asyncio
async def test_the_gmail_confirmation_code_is_stored_against_the_tag():
    """The mail carries no attachment, so it has to be caught before that check —
    otherwise the code the customer is waiting for is dropped on the first line."""
    record = AsyncMock()
    outcomes, extract, process = await _route(
        resolved=_settings_row(),
        sender=_CONFIRM,
        subject=_CONFIRM_SUBJECT,
        attachments=[],
        record=record,
    )
    assert outcomes == ["skipped"]
    assert record.await_args.args[1:] == ("a1b2c3d4", "123456789")
    extract.assert_not_awaited()
    process.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_confirmation_with_no_usable_tag_is_dropped_quietly():
    """Not `unrouted`: that counter alerts at five per poll and exists to catch real
    documents going nowhere. An unattributable code is noise, and drowning the alert
    is worse than losing the code."""
    record = AsyncMock()
    outcomes, _, _ = await _route(
        resolved=None,
        sender=_CONFIRM,
        subject=_CONFIRM_SUBJECT,
        recipients=("Delivered-To: AIAGENT@carmensoftware.com",),
        attachments=[],
        record=record,
    )
    assert outcomes == ["skipped"]
    record.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_bank_document_is_not_diverted_by_a_hash_number_in_its_subject():
    """`(#123456789)` is an unremarkable thing for a bank to write. Only the sender
    decides, or a real invoice would be filed as a confirmation code and never posted."""
    record = AsyncMock()
    outcomes, _, process = await _route(
        resolved=_settings_row(), subject="Invoice (#123456789)", record=record
    )
    assert outcomes == ["posted"]
    record.assert_not_awaited()
    process.assert_awaited_once()


# ── run_ingest ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_run_ingest_summarises_every_message_and_records_the_job_run():
    """`job_runs` is what puts this job on #/admin/jobs at all — until now it returned
    a dict to its caller and wrote nothing, so a job that spends money on every poll
    was absent from the one page that answers "is the machine running?"."""
    messages = [
        {"message_id": "<a>", "subject": "s", "from": "f", "recipients": [], "attachments": []},
        {"message_id": "<b>", "subject": "s", "from": "f", "recipients": [], "attachments": []},
    ]
    record = AsyncMock()
    process = AsyncMock(side_effect=[["posted"], ["unrouted"]])
    with (
        patch.object(ingest.settings, "imap_host", "imap.example.com"),
        patch.object(ingest, "_fetch_unseen", lambda limit: messages),
        patch.object(ingest, "_process_message", process),
        patch.object(ingest, "_record_run", record),
    ):
        summary = await ingest.run_ingest(limit=5)

    assert summary == {"messages": 2, "posted": 1, "failed": 0, "skipped": 0, "unrouted": 1}
    record.assert_awaited_once()
    assert record.await_args.args[1] == summary


@pytest.mark.asyncio
async def test_a_poll_full_of_unroutable_mail_raises_one_alert():
    """The counter CARMEN_INTEGRATION.md §2.5 promises we watch. Nobody owns unrouted
    mail, so there is no tenant to notify — the alert is ours."""
    alert = AsyncMock()
    with (
        patch.object(ingest, "async_session", _session_factory(_FakeDB())),
        patch.object(ingest.anomaly_service, "open_alert_if_absent", alert),
    ):
        await ingest._record_run(
            datetime.now(UTC), {"posted": 0, "unrouted": ingest.UNROUTED_ALERT_THRESHOLD}
        )
    assert alert.await_args.kwargs["metric"] == "email_ingest_unrouted"
    assert alert.await_args.kwargs["tenant_id"] == "system"


@pytest.mark.asyncio
async def test_a_quiet_poll_raises_no_alert():
    alert = AsyncMock()
    with (
        patch.object(ingest, "async_session", _session_factory(_FakeDB())),
        patch.object(ingest.anomaly_service, "open_alert_if_absent", alert),
    ):
        await ingest._record_run(datetime.now(UTC), {"posted": 3, "unrouted": 0})
    alert.assert_not_awaited()


# ── The LLM cost is attributed, not parked ────────────────────────────────────


@pytest.mark.asyncio
async def test_the_extraction_runs_with_a_tenant_and_a_task_already_set():
    """`llm_usage_logs.tenant_id` is NOT NULL.

    The tax-ID design extracted before it knew whose document it was, so the cost had
    to be parked in a ContextVar buffer and flushed later — and was lost on every one
    of the five exits that never reached the flush. Routing on the envelope removes the
    problem instead of working around it, so that buffer is gone.
    """
    from app.context import current_tenant_id

    seen = {}

    async def _extract(**kwargs):
        seen["tenant"] = current_tenant_id.get()
        seen["task_id"] = kwargs["task_id"]
        return _extracted()

    outcome, _ = await _run(
        _FakeDB(),
        extracted=_extracted(),
        config=_config(),
        carmen_result={"Code": 0, "InternalMessage": "JV-1"},
        extract_side_effect=_extract,
    )
    assert outcome == "posted"
    assert seen["tenant"] == TENANT_ID
    assert seen["task_id"]  # the usage row can carry a task, not just a tenant


@pytest.mark.asyncio
async def test_log_llm_usage_writes_the_row_with_the_tenant_in_context():
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


# ── Opening the file, before anything is charged ──────────────────────────────


@pytest.mark.asyncio
async def test_a_disguised_file_is_refused_before_the_llm_sees_it():
    """`ensure_pdf_openable` is a no-op for non-PDFs, so a .jpg that is really a text
    file used to reach the vision model and be paid for."""
    with pytest.raises(ingest._Skip) as exc:
        await ingest._open_or_fail(b"not an image at all", "statement.jpg", [])
    assert exc.value.reason_code == "unreadable_document"


@pytest.mark.asyncio
async def test_a_real_jpeg_passes_the_magic_byte_gate():
    assert await ingest._open_or_fail(b"\xff\xd8\xff" + bytes(20), "statement.jpg", []) is None


# ── Attachments: a cap, and forward-as-attachment ─────────────────────────────


def _mime(parts):
    """A multipart/mixed message carrying (filename, payload) attachment parts."""
    from email.mime.application import MIMEApplication
    from email.mime.multipart import MIMEMultipart

    outer = MIMEMultipart()
    for filename, payload in parts:
        part = MIMEApplication(payload, _subtype="octet-stream")
        part.add_header("Content-Disposition", "attachment", filename=filename)
        outer.attach(part)
    return outer


def test_attachments_are_capped_per_message():
    """`imap_batch_size` caps messages per poll, not attachments per message — and a
    forwarded chain's signature logos are each their own MIME part."""
    msg = _mime([(f"logo{i}.png", b"x") for i in range(ingest.MAX_ATTACHMENTS_PER_MESSAGE + 5)])
    assert len(ingest._attachments(msg)) == ingest.MAX_ATTACHMENTS_PER_MESSAGE


def test_files_with_an_unsupported_extension_are_ignored():
    msg = _mime([("notes.txt", b"x"), ("report.pdf", b"%PDF-1.4")])
    assert [f for f, _ in ingest._attachments(msg)] == ["report.pdf"]


def test_a_forward_as_attachment_still_yields_the_inner_pdf():
    """Load-bearing for manual forwarding: many clients forward the original mail as a
    message/rfc822 part rather than re-attaching its files."""
    from email.mime.message import MIMEMessage

    inner = _mime([("MDR-aug.pdf", b"%PDF-1.4 inner")])
    inner["Subject"] = "Your commission report"
    outer = _mime([])
    outer.attach(MIMEMessage(inner))

    found = ingest._attachments(outer)
    assert [f for f, _ in found] == ["MDR-aug.pdf"]
    assert found[0][1] == b"%PDF-1.4 inner"
