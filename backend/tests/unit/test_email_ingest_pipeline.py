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
    ):
        self.extracted = extracted
        self.config = config
        self.carmen_result = carmen_result
        self.carmen_side_effect = carmen_side_effect
        self.refund_document = AsyncMock()
        self.consume_document = AsyncMock(return_value="credit")
        self.mark_submitted = AsyncMock()
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
    tax_ids=None,
    rules=None,
    carmen_token="dev-tok",
    carmen_uri="https://hotel.carmenwork.com",
    **patch_kwargs,
):
    """Runs _process_attachment and returns (outcome, patches) so callers can
    assert on refund_document/consume_document calls, not just the outcome string."""
    with (
        patch.object(ingest, "async_session", _session_factory(fake_db)),
        _Patches(**patch_kwargs) as p,
    ):
        outcome = await ingest._process_attachment(
            tenant_id=TENANT_ID,
            message_id="<msg-1@bank.co.th>",
            sender="no-reply@ktc.co.th",
            filename=filename,
            blob=b"fake-image-bytes",
            rules=rules or [],
            tax_ids=tax_ids if tax_ids is not None else {"1234567890123"},
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
async def test_tax_id_mismatch_fails_and_refunds():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(tax_ids=["9999999999999"]),  # not the BU's registered id
        config=_config(),
        carmen_result={"Code": 0},
        tax_ids={"1234567890123"},
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "tax_id_mismatch"
    assert db.added[0].status == "failed"
    p.refund_document.assert_awaited_once()


@pytest.mark.asyncio
async def test_mapping_incomplete_fails_and_refunds():
    db = _FakeDB()
    outcome, p = await _run(
        db,
        extracted=_extracted(),
        config=_config(mappings={}),  # nothing mapped at all
        carmen_result={"Code": 0},
    )
    assert outcome == "failed"
    assert db.added[0].reason_code == "mapping_incomplete"
    p.refund_document.assert_awaited_once()


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
    with (
        patch.object(ingest, "async_session", _session_factory(db)),
        _Patches(
            extracted=_extracted(),
            config=_config(),
            carmen_result={"Code": 1, "UserMessage": "Insufficient balance"},
        ) as p,
    ):
        outcome = await ingest._process_attachment(
            tenant_id=TENANT_ID,
            message_id="<msg-2@bank.co.th>",
            sender="no-reply@ktc.co.th",
            filename="statement.jpg",
            blob=b"fake",
            rules=[],
            tax_ids={"1234567890123"},
            passwords=[],
            carmen_token="dev-tok",
            carmen_uri="https://hotel.carmenwork.com",
        )
    assert outcome == "failed"
    assert db.added[0].reason_code == "carmen_rejected"
    p.refund_document.assert_not_called()  # extraction was fine — Carmen just declined


@pytest.mark.asyncio
async def test_carmen_transport_failure_fails_but_does_not_refund():
    db = _FakeDB()
    with (
        patch.object(ingest, "async_session", _session_factory(db)),
        _Patches(
            extracted=_extracted(),
            config=_config(),
            carmen_result=None,
            carmen_side_effect=CarmenAPIError(503, "upstream timeout"),
        ) as p,
    ):
        outcome = await ingest._process_attachment(
            tenant_id=TENANT_ID,
            message_id="<msg-3@bank.co.th>",
            sender="no-reply@ktc.co.th",
            filename="statement.jpg",
            blob=b"fake",
            rules=[],
            tax_ids={"1234567890123"},
            passwords=[],
            carmen_token="dev-tok",
            carmen_uri="https://hotel.carmenwork.com",
        )
    assert outcome == "failed"
    assert db.added[0].reason_code == "carmen_rejected"
    p.refund_document.assert_not_called()  # fate unknown — never auto-refund a maybe-posted JV


# ── run_ingest gate: a lapsed package must stop ingestion ─────────────────────


def _one_message():
    return [
        {
            "message_id": "<msg-lapsed@bank.co.th>",
            "subject": "statement",
            "from": "no-reply@ktc.co.th",
            "recipients": ["ocr+abc123@carmensoftware.com"],
            "attachments": [("statement.jpg", b"fake")],
        }
    ]


async def _run_ingest_with(*, entitled: bool):
    """One poll for a configured, enabled BU whose package may or may not be live."""
    settings_row = MagicMock(tenant_id=uuid4(), enabled=True, rules=[], tax_ids=[])
    db = AsyncMock()
    db.get = AsyncMock(return_value=MagicMock())  # tenant exists

    process = AsyncMock(return_value="posted")
    with (
        patch.object(ingest.settings, "imap_host", "imap.example.com"),
        patch.object(ingest.settings, "email_ingest_address", "ocr@carmensoftware.com"),
        patch.object(ingest, "_fetch_unseen", lambda limit: _one_message()),
        patch.object(ingest, "async_session", _session_factory(db)),
        patch.object(ingest.es, "get_by_tag", AsyncMock(return_value=settings_row)),
        patch.object(ingest.es, "is_entitled", AsyncMock(return_value=entitled)),
        patch.object(ingest.es, "rule_passwords", MagicMock(return_value=[])),
        patch.object(ingest.es, "posting_target", AsyncMock(return_value=("tok", "https://h"))),
        patch.object(ingest, "_process_attachment", process),
    ):
        summary = await ingest.run_ingest(limit=5)
    return summary, process


@pytest.mark.asyncio
async def test_lapsed_package_skips_the_message_without_extracting_it():
    """Settings are not rewritten when a subscription ends, so `enabled` stays true.

    The gate has to be here as well as on the toggle, or a customer keeps ingesting
    (and paying us nothing) after their package lapses.
    """
    summary, process = await _run_ingest_with(entitled=False)
    assert summary["skipped"] == 1
    assert summary["posted"] == 0
    process.assert_not_awaited()  # no LLM call, no credit spent


@pytest.mark.asyncio
async def test_active_package_lets_the_message_through():
    summary, process = await _run_ingest_with(entitled=True)
    assert summary["posted"] == 1
    process.assert_awaited_once()


# ── Ledger dedupe (_claim in isolation) ────────────────────────────────────────


@pytest.mark.asyncio
async def test_claim_dedupes_on_integrity_error_second_attempt():
    db = _FakeDB(fail_commit_on_call=2)
    first = await ingest._claim(db, TENANT_ID, "<msg-4@bank.co.th>", "statement.jpg")
    assert first is not None
    second = await ingest._claim(db, TENANT_ID, "<msg-4@bank.co.th>", "statement.jpg")
    assert second is None
    db.rollback.assert_awaited_once()
