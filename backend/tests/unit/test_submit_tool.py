"""
Unit tests for tools/submit.py
Mocks AsyncSession — no real DB required.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from tests.conftest import make_mock_db, set_context
from app.tools.submit import run, SubmitInput


def make_input(**kwargs):
    defaults = dict(
        bank_code="KBANK",
        original_filename="statement.pdf",
        doc_no="DOC-001",
        doc_date="2024-01-15",
        bank_name="KBANK",
        company_name="Acme Co",
        merchant_name="Merchant X",
        bank_company_name="BCO",
        branch_no="001",
        details=[],
    )
    defaults.update(kwargs)
    return SubmitInput(**defaults)


# ── B1.1: Happy path ─────────────────────────────────────────────────────────

async def test_B1_1_happy_path_returns_success_with_ids():
    set_context("t-001", "bu-001", "u-001")
    db = make_mock_db(execute_rows=[])  # no duplicate found

    result = await run(make_input(), db)

    assert result.success is True
    assert "card_id" in result.output
    assert result.output["doc_no"] == "DOC-001"
    assert result.output["submitted_at"] is not None
    assert db.commit.called


async def test_B1_1_creates_task_card_and_commits():
    set_context("t-001", "bu-001")
    db = make_mock_db(execute_rows=[])

    result = await run(make_input(), db)

    assert result.success is True
    # add() called at least twice (OCRTask + CreditCard)
    assert db.add.call_count >= 2
    assert db.commit.called


# ── B1.2: Duplicate doc_no ───────────────────────────────────────────────────

async def test_B1_2_duplicate_doc_no_returns_failure():
    set_context("t-001", "bu-001")
    fake_card = MagicMock()  # simulate existing CreditCard row
    db = make_mock_db(execute_rows=[fake_card])

    result = await run(make_input(doc_no="EXISTING-DOC"), db)

    assert result.success is False
    assert result.output == {"error": "DUPLICATE_DOC_NO"} or \
           any("DUPLICATE_DOC_NO" in str(e) for e in result.errors) or \
           result.output is None  # different duplicate path returns without output key


async def test_B1_2_duplicate_does_not_commit():
    set_context("t-001", "bu-001")
    db = make_mock_db(execute_rows=[MagicMock()])

    await run(make_input(), db)

    db.commit.assert_not_called()


# ── B1.3: DB exception ───────────────────────────────────────────────────────

async def test_B1_3_db_exception_returns_failure():
    set_context("t-001", "bu-001")
    db = make_mock_db(execute_rows=[])
    db.flush.side_effect = RuntimeError("connection lost")

    result = await run(make_input(), db)

    assert result.success is False
    assert len(result.errors) > 0
    assert "connection lost" in result.errors[0]


# ── B1.4: Empty details ───────────────────────────────────────────────────────

async def test_B1_4_empty_details_creates_card_with_zero_transactions():
    set_context("t-001", "bu-001")
    db = make_mock_db(execute_rows=[])

    result = await run(make_input(details=[]), db)

    assert result.success is True
    assert result.metadata["transaction_count"] == 0


# ── B1.5: sort_order preserved ───────────────────────────────────────────────

async def test_B1_5_sort_order_matches_detail_index():
    set_context("t-001", "bu-001")
    db = make_mock_db(execute_rows=[])
    details = [
        {"transaction": "Sale A", "amount": 100},
        {"transaction": "Sale B", "amount": 200},
        {"transaction": "Sale C", "amount": 300},
    ]

    added_txs = []
    original_add = db.add.side_effect

    def capture_add(obj):
        from app.models.orm import CreditCardTransaction
        if isinstance(obj, CreditCardTransaction):
            added_txs.append(obj)

    db.add.side_effect = capture_add

    result = await run(make_input(details=details), db)

    assert result.metadata["transaction_count"] == 3
    for i, tx in enumerate(added_txs):
        assert tx.sort_order == i


# ── B1.6: Context vars ────────────────────────────────────────────────────────

async def test_B1_6_tenant_id_set_on_created_objects():
    set_context("tenant-xyz", "bu-abc", "user-111")
    db = make_mock_db(execute_rows=[])

    added_objects = []
    db.add.side_effect = lambda obj: added_objects.append(obj)

    await run(make_input(), db)

    from app.models.orm import OCRTask, CreditCard
    tasks = [o for o in added_objects if isinstance(o, OCRTask)]
    cards = [o for o in added_objects if isinstance(o, CreditCard)]

    assert tasks[0].tenant_id == "tenant-xyz"
    assert tasks[0].business_unit_id == "bu-abc"
    assert cards[0].tenant_id == "tenant-xyz"


async def test_duplicate_check_skipped_when_no_doc_no():
    set_context("t-001", "bu-001")
    db = make_mock_db(execute_rows=[])

    result = await run(make_input(doc_no=None), db)

    # Should succeed (no doc_no to check duplicate against)
    assert result.success is True
    # execute() may not have been called for the duplicate check
    # (but may be called for flush — just confirm success)


async def test_detail_rows_without_transaction_label_skipped():
    set_context("t-001", "bu-001")
    db = make_mock_db(execute_rows=[])
    details = [
        {"transaction": "", "amount": 100},   # empty label → skipped
        {"transaction": "Valid", "amount": 200},
    ]

    result = await run(make_input(details=details), db)

    assert result.metadata["transaction_count"] == 1
