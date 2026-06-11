"""
Unit tests for app/routers/ocr.py (Credit Card OCR Router).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.enums import TaskStatus
from app.models.orm import CreditCard, OCRTask
from app.models.schemas import ExtractedCreditCardData
from tests.integration.conftest import FAKE_SESSION, make_test_client

BASE_URL = "/api/v1/credit-card"
AUTH_HEADERS = {"Authorization": "Bearer dummy"}


@pytest.fixture
def mock_session():
    """Mock the async_session context manager."""
    db = AsyncMock()

    # Setup mock result for execute
    result = MagicMock()
    result.scalar_one_or_none.return_value = MagicMock()
    db.execute.return_value = result
    db.commit = AsyncMock()
    db.add = MagicMock()

    ctx = AsyncMock()
    ctx.__aenter__.return_value = db
    ctx.__aexit__.return_value = None
    return ctx, db


# ── POST /extract ─────────────────────────────────────────────────────────────


class TestExtractCard:
    @patch("app.routers.ocr.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ocr.get_correction_hints", new_callable=AsyncMock)
    @patch("app.routers.ocr.create_task")
    @patch("app.routers.ocr.ocr_service.extract_stateless", new_callable=AsyncMock)
    @patch("app.services.credit_card_service.has_submitted_doc", new_callable=AsyncMock)
    def test_extract_card_happy_path(
        self,
        mock_has_submitted,
        mock_extract_stateless,
        mock_create_task,
        mock_get_hints,
        mock_check_quota,
        mock_session,
    ):
        ctx_mock, db_mock = mock_session

        # Setup mocks
        mock_get_hints.return_value = {"field": "hint"}

        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="credit_card_ocr",
            original_filename="receipt.jpg",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        extracted_data = ExtractedCreditCardData(
            id=None,
            task_id=None,
            bank_name="KBANK",
            company_name="Acme Co",
            doc_date="15/03/2024",
            doc_no="INV-123",
            details=[],
            is_duplicate=False,
        )
        mock_extract_stateless.return_value = extracted_data
        mock_has_submitted.return_value = False

        # Setup database select for completing task
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ocr.async_session", return_value=ctx_mock),
            patch("app.services.credit_card_service.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("files", ("receipt.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg"))]
            resp = client.post(
                f"{BASE_URL}/extract?bank_code=KBANK",
                files=files,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["company_name"] == "Acme Co"
        assert data[0]["is_duplicate"] is False
        assert data[0]["id"] is not None
        assert dummy_task.status == TaskStatus.COMPLETED

    @patch("app.routers.ocr.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ocr.get_correction_hints", new_callable=AsyncMock)
    @patch("app.routers.ocr.create_task")
    @patch("app.routers.ocr.ocr_service.extract_stateless", new_callable=AsyncMock)
    @patch("app.services.credit_card_service.has_submitted_doc", new_callable=AsyncMock)
    def test_extract_card_duplicate_skipped(
        self,
        mock_has_submitted,
        mock_extract_stateless,
        mock_create_task,
        mock_get_hints,
        mock_check_quota,
        mock_session,
    ):
        ctx_mock, db_mock = mock_session
        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="credit_card_ocr",
            original_filename="receipt.jpg",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        extracted_data = ExtractedCreditCardData(
            id=None,
            task_id=None,
            bank_name="KBANK",
            company_name="Acme Co",
            doc_date="15/03/2024",
            doc_no="INV-123",
            details=[],
            is_duplicate=False,
        )
        mock_extract_stateless.return_value = extracted_data
        mock_has_submitted.return_value = True  # Duplicate!

        # Setup database select for completing task
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ocr.async_session", return_value=ctx_mock),
            patch("app.services.credit_card_service.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("files", ("receipt.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg"))]
            resp = client.post(
                f"{BASE_URL}/extract?bank_code=KBANK",
                files=files,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["is_duplicate"] is True
        assert data[0]["id"] is None
        assert dummy_task.status == TaskStatus.COMPLETED

    @patch("app.routers.ocr.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ocr.get_correction_hints", new_callable=AsyncMock)
    @patch("app.routers.ocr.create_task")
    @patch("app.routers.ocr.ocr_service.extract_stateless", new_callable=AsyncMock)
    def test_extract_card_error_marks_failed(
        self,
        mock_extract_stateless,
        mock_create_task,
        mock_get_hints,
        mock_check_quota,
        mock_session,
    ):
        ctx_mock, db_mock = mock_session
        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="credit_card_ocr",
            original_filename="receipt.jpg",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        # Make extraction fail
        mock_extract_stateless.side_effect = RuntimeError("LLM Failure")

        # Setup database select for updating task to FAILED
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ocr.async_session", return_value=ctx_mock),
            patch("app.services.credit_card_service.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("files", ("receipt.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg"))]
            # Since raise_server_exceptions=True by default in TestClient, we expect RuntimeError
            with pytest.raises(RuntimeError):
                client.post(
                    f"{BASE_URL}/extract?bank_code=KBANK",
                    files=files,
                    headers=AUTH_HEADERS,
                )

        assert dummy_task.status == TaskStatus.FAILED
        assert dummy_task.error_message == "LLM Failure"

    @patch("app.routers.ocr.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ocr.get_correction_hints", new_callable=AsyncMock)
    @patch("app.routers.ocr.create_task")
    @patch("app.routers.ocr.ocr_service.extract_stateless", new_callable=AsyncMock)
    @patch("app.services.credit_card_service.has_submitted_doc", new_callable=AsyncMock)
    def test_bank_code_detected_from_extracted_when_not_passed(
        self,
        mock_has_submitted,
        mock_extract_stateless,
        mock_create_task,
        mock_get_hints,
        mock_check_quota,
        mock_session,
    ):
        """Core regression: when no bank_code query param is sent, finalize_extraction
        must detect it from bank_company_name and persist a non-NULL bank_code row.
        This is the root cause of the broken duplicate check — without this, every
        stored draft has bank_code=NULL while submitted rows have bank_code='SCB',
        so the duplicate key never matches."""
        ctx_mock, db_mock = mock_session
        mock_get_hints.return_value = {}

        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="credit_card_ocr",
            original_filename="receipt.jpg",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        # LLM extracts bank_company_name but no bank_code is passed by the frontend
        extracted_data = ExtractedCreditCardData(
            id=None,
            task_id=None,
            bank_company_name="ธนาคารกสิกรไทย จำกัด (มหาชน)",
            company_name="Some Merchant",
            doc_date="15/03/2024",
            doc_no="INV-456",
            details=[],
            is_duplicate=False,
        )
        mock_extract_stateless.return_value = extracted_data
        mock_has_submitted.return_value = False

        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ocr.async_session", return_value=ctx_mock),
            patch("app.services.credit_card_service.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("files", ("receipt.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg"))]
            # No bank_code query param — simulates real frontend behaviour
            resp = client.post(f"{BASE_URL}/extract", files=files, headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["is_duplicate"] is False

        # The CreditCard added to the session must carry bank_code='KBANK'
        added_card = db_mock.add.call_args[0][0]
        assert isinstance(added_card, CreditCard)
        assert added_card.bank_code == "KBANK", (
            f"Expected 'KBANK' resolved from bank_company_name, got {added_card.bank_code!r}"
        )

        # has_submitted_doc must have been called with the resolved bank_code, not None
        mock_has_submitted.assert_called_once()
        call_kwargs = mock_has_submitted.call_args[1]
        assert call_kwargs["bank_code"] == "KBANK"

    @patch("app.routers.ocr.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ocr.get_correction_hints", new_callable=AsyncMock)
    @patch("app.routers.ocr.create_task")
    @patch("app.routers.ocr.ocr_service.extract_stateless", new_callable=AsyncMock)
    @patch("app.services.credit_card_service.has_submitted_doc", new_callable=AsyncMock)
    def test_explicit_bank_code_param_takes_precedence_over_detection(
        self,
        mock_has_submitted,
        mock_extract_stateless,
        mock_create_task,
        mock_get_hints,
        mock_check_quota,
        mock_session,
    ):
        """When a bank_code is explicitly passed (reprocess path), it overrides detection."""
        ctx_mock, db_mock = mock_session
        mock_get_hints.return_value = {}

        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="credit_card_ocr",
            original_filename="receipt.jpg",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        extracted_data = ExtractedCreditCardData(
            id=None,
            task_id=None,
            bank_company_name="ธนาคารกสิกรไทย จำกัด (มหาชน)",  # would detect KBANK
            doc_no="INV-789",
            details=[],
            is_duplicate=False,
        )
        mock_extract_stateless.return_value = extracted_data
        mock_has_submitted.return_value = False

        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ocr.async_session", return_value=ctx_mock),
            patch("app.services.credit_card_service.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("files", ("receipt.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg"))]
            resp = client.post(
                f"{BASE_URL}/extract?bank_code=BBL",  # explicit override
                files=files,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        added_card = db_mock.add.call_args[0][0]
        assert added_card.bank_code == "BBL"  # explicit param wins
        assert mock_has_submitted.call_args[1]["bank_code"] == "BBL"


# ── GET /tasks ────────────────────────────────────────────────────────────────


class TestListTasks:
    @patch("app.routers.ocr.ocr_service.get_all_tasks", new_callable=AsyncMock)
    def test_list_tasks_200(self, mock_get_all):
        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="credit_card_ocr",
            original_filename="receipt.jpg",
            status=TaskStatus.COMPLETED,
        )
        mock_get_all.return_value = ([dummy_task], 1)

        db_mock = AsyncMock()
        with (
            make_test_client(db_mock) as client,
        ):
            resp = client.get(f"{BASE_URL}/tasks?limit=10", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["tasks"][0]["original_filename"] == "receipt.jpg"


# ── GET /tasks/{task_id} ───────────────────────────────────────────────────────


class TestGetTask:
    def test_get_task_200(self, mock_session):
        ctx_mock, db_mock = mock_session
        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="credit_card_ocr",
            original_filename="receipt.jpg",
            status=TaskStatus.COMPLETED,
        )
        dummy_card = CreditCard(
            id=uuid.uuid4(),
            task_id=dummy_task.id,
            bank_code="KBANK",
            company_name="Acme Co",
            doc_date="15/03/2024",
            doc_no="INV-123",
            branch_no="001",
        )
        dummy_task.credit_card = dummy_card

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = result_mock

        with (
            make_test_client(db_mock) as client,
        ):
            resp = client.get(f"{BASE_URL}/tasks/{dummy_task.id}", headers=AUTH_HEADERS)

        assert resp.status_code == 200
        data = resp.json()
        assert data["original_filename"] == "receipt.jpg"
        assert data["credit_card"]["company_name"] == "Acme Co"

    def test_get_task_404(self, mock_session):
        ctx_mock, db_mock = mock_session

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db_mock.execute.return_value = result_mock

        with (
            make_test_client(db_mock) as client,
        ):
            resp = client.get(f"{BASE_URL}/tasks/{uuid.uuid4()}", headers=AUTH_HEADERS)

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"]
