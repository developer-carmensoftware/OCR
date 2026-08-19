"""task_service: OCRTask creation and the charged_docs record.

`charged_docs` is the only place a task's real cost is written down — a
subscription-funded scan writes no ledger row, and a credit-funded one refers to
the file by name, not by task id. If it stops being persisted, per-module cost
reporting silently under-counts.
"""

import uuid
from unittest.mock import MagicMock

import pytest

from app.models.orm import TaskStatus
from app.services import task_service as ts
from tests.conftest import make_mock_db


@pytest.mark.asyncio
async def test_create_task_persists_a_processing_task():
    db = make_mock_db()

    task = await ts.create_task(
        db,
        tenant_id="t-001",
        module_id="credit_card_ocr",
        original_filename="statement.pdf",
    )

    assert task.status == TaskStatus.PROCESSING
    assert task.tenant_id == "t-001"
    assert task.module_id == "credit_card_ocr"
    assert task.original_filename == "statement.pdf"
    db.add.assert_called_once_with(task)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_charged_docs_defaults_to_one_and_is_stored_verbatim():
    """AP invoice charges per page, so a 5-page scan must record 5, not 1."""
    db = make_mock_db()

    default = await ts.create_task(
        db, tenant_id="t-001", module_id="ap_invoice", original_filename="a.pdf"
    )
    multi = await ts.create_task(
        db,
        tenant_id="t-001",
        module_id="ap_invoice",
        original_filename="b.pdf",
        charged_docs=5,
    )

    assert default.charged_docs == 1
    assert multi.charged_docs == 5


@pytest.mark.asyncio
async def test_a_charge_that_failed_open_records_zero():
    """consume_document() fails open on infra errors; that scan cost nothing and
    must not be counted as a document."""
    db = make_mock_db()

    task = await ts.create_task(
        db,
        tenant_id="t-001",
        module_id="ap_invoice",
        original_filename="c.pdf",
        charged_docs=0,
    )

    assert task.charged_docs == 0


@pytest.mark.asyncio
async def test_blank_carmen_user_id_is_stored_as_null():
    db = make_mock_db()

    task = await ts.create_task(
        db,
        tenant_id="t-001",
        module_id="credit_card_ocr",
        original_filename="d.pdf",
        carmen_user_id="",
    )

    assert task.carmen_user_id is None


@pytest.mark.asyncio
async def test_mark_failed_records_the_status_and_message():
    task = MagicMock()
    db = make_mock_db()
    db.execute.return_value.scalar_one_or_none.return_value = task

    await ts.mark_failed(db, uuid.uuid4(), "password-protected PDF")

    assert task.status == TaskStatus.FAILED
    assert task.error_message == "password-protected PDF"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_mark_failed_on_a_missing_task_is_a_no_op():
    """Called from error handlers — must not turn one failure into two."""
    db = make_mock_db()
    db.execute.return_value.scalar_one_or_none.return_value = None

    await ts.mark_failed(db, uuid.uuid4(), "boom")

    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_mark_failed_accepts_a_uuid_string():
    task = MagicMock()
    db = make_mock_db()
    db.execute.return_value.scalar_one_or_none.return_value = task

    await ts.mark_failed(db, str(uuid.uuid4()), "boom")

    assert task.status == TaskStatus.FAILED
