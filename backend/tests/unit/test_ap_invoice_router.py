"""
Unit tests for app/routers/ap_invoice.py (AP Invoice Router).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.enums import TaskStatus
from app.models.orm import OCRTask
from app.services.carmen_service import CarmenAPIError
from tests.integration.conftest import FAKE_SESSION, make_test_client

BASE_URL = "/api/v1/ap-invoice"
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


class TestExtractAPInvoice:
    @patch("app.routers.ap_invoice.check_quota", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.create_task")
    @patch("app.routers.ap_invoice.extract_ap_invoice_data", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.has_submitted_doc", new_callable=AsyncMock)
    def test_extract_ap_invoice_happy_path(
        self,
        mock_has_submitted,
        mock_extract_data,
        mock_create_task,
        mock_check_quota,
        mock_session,
    ):
        ctx_mock, db_mock = mock_session

        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="ap_invoice",
            original_filename="invoice.pdf",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        extracted_data = {
            "vendorName": "Acme Supplier",
            "documentNumber": "INV-999",
            "documentDate": "15/03/2024",
            "lineItems": [],
        }
        mock_extract_data.return_value = extracted_data
        mock_has_submitted.return_value = False

        # Setup database select for completing task
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ap_invoice.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("file", ("invoice.pdf", b"%PDF-1.5" + b"\x00" * 20, "application/pdf"))]
            resp = client.post(
                f"{BASE_URL}/extract",
                files=files,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["vendorName"] == "Acme Supplier"
        assert data["is_duplicate"] is False
        assert data["id"] is not None
        assert dummy_task.status == TaskStatus.COMPLETED

    @patch("app.routers.ap_invoice.check_quota", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.create_task")
    @patch("app.routers.ap_invoice.extract_ap_invoice_data", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.has_submitted_doc", new_callable=AsyncMock)
    def test_extract_ap_invoice_duplicate(
        self,
        mock_has_submitted,
        mock_extract_data,
        mock_create_task,
        mock_check_quota,
        mock_session,
    ):
        ctx_mock, db_mock = mock_session

        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="ap_invoice",
            original_filename="invoice.pdf",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        extracted_data = {
            "vendorName": "Acme Supplier",
            "documentNumber": "INV-999",
            "documentDate": "15/03/2024",
            "lineItems": [],
        }
        mock_extract_data.return_value = extracted_data
        mock_has_submitted.return_value = True  # Duplicate!

        # Setup database select for completing task
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ap_invoice.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("file", ("invoice.pdf", b"%PDF-1.5" + b"\x00" * 20, "application/pdf"))]
            resp = client.post(
                f"{BASE_URL}/extract",
                files=files,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["is_duplicate"] is True
        assert data["id"] is None
        assert dummy_task.status == TaskStatus.COMPLETED

    @patch("app.routers.ap_invoice.check_quota", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.create_task")
    @patch("app.routers.ap_invoice.extract_ap_invoice_data", new_callable=AsyncMock)
    def test_extract_ap_invoice_error_marks_failed(
        self,
        mock_extract_data,
        mock_create_task,
        mock_check_quota,
        mock_session,
    ):
        ctx_mock, db_mock = mock_session

        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="ap_invoice",
            original_filename="invoice.pdf",
            status=TaskStatus.PROCESSING,
        )
        mock_create_task.return_value = dummy_task

        # Make extraction fail
        mock_extract_data.side_effect = RuntimeError("LLM Failure")

        # Setup database select for completing task
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        with (
            patch("app.routers.ap_invoice.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            files = [("file", ("invoice.pdf", b"%PDF-1.5" + b"\x00" * 20, "application/pdf"))]
            with pytest.raises(RuntimeError):
                client.post(
                    f"{BASE_URL}/extract",
                    files=files,
                    headers=AUTH_HEADERS,
                )

        assert dummy_task.status == TaskStatus.FAILED
        assert dummy_task.error_message == "LLM Failure"


# ── POST /suggest ─────────────────────────────────────────────────────────────


class TestSuggestGL:
    @patch("app.routers.ap_invoice.get_account_codes", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.get_departments", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.suggest_for_items", new_callable=AsyncMock)
    def test_suggest_gl_happy_path(
        self,
        mock_suggest,
        mock_get_depts,
        mock_get_accs,
    ):
        mock_get_accs.return_value = {"Data": []}
        mock_get_depts.return_value = {"Data": []}
        mock_suggest.return_value = {"0": {"acc": "5100", "dept": "FIN"}}

        payload = {
            "items": [
                {"index": 0, "category": "Food", "description": "Lunch", "unit_price": 120.0}
            ],
            "invoice_desc": "Team Lunch",
            "vn_code": "V-123",
        }

        db_mock = AsyncMock()
        with (
            make_test_client(db_mock) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest",
                json=payload,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert "suggestions" in data
        assert data["suggestions"]["0"]["acc"] == "5100"

    @patch("app.routers.ap_invoice.get_account_codes", new_callable=AsyncMock)
    def test_suggest_gl_carmen_api_error(
        self,
        mock_get_accs,
    ):
        # Carmen API error
        mock_get_accs.side_effect = CarmenAPIError(status_code=502, detail="Bad Gateway")

        payload = {
            "items": [
                {"index": 0, "category": "Food", "description": "Lunch", "unit_price": 120.0}
            ],
            "invoice_desc": "Team Lunch",
            "vn_code": "V-123",
        }

        db_mock = AsyncMock()
        with (
            make_test_client(db_mock) as client,
        ):
            resp = client.post(
                f"{BASE_URL}/suggest",
                json=payload,
                headers=AUTH_HEADERS,
            )

        assert resp.status_code == 502
        assert "Carmen API error" in resp.json()["detail"]
