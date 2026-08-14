"""
Unit tests for app/routers/ap_invoice.py (AP Invoice Router).
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import fitz
import pytest

from app.models.enums import TaskStatus
from app.models.orm import OCRTask
from app.services.carmen_service import CarmenAPIError
from tests.integration.conftest import FAKE_SESSION, make_test_client

BASE_URL = "/api/v1/ap-invoice"
AUTH_HEADERS = {"Authorization": "Bearer dummy"}


def _valid_pdf_bytes(pages: int = 1) -> bytes:
    """A real PDF — the /extract pre-check opens the file before consuming a credit, so
    the fixture must be a genuinely openable PDF (not just a %PDF header). `pages` matters
    since the scan is now priced per page."""
    doc = fitz.open()
    for _ in range(pages):
        doc.new_page()
    data = doc.tobytes()
    doc.close()
    return data


VALID_PDF = _valid_pdf_bytes()
VALID_PDF_3P = _valid_pdf_bytes(3)


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
    @patch("app.routers.ap_invoice.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.create_task")
    @patch("app.routers.ap_invoice.extract_ap_invoice_data", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.has_submitted_doc", new_callable=AsyncMock)
    def test_extract_ap_invoice_happy_path(
        self,
        mock_has_submitted,
        mock_extract_data,
        mock_create_task,
        mock_consume_document,
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
            files = [("file", ("invoice.pdf", VALID_PDF, "application/pdf"))]
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

    @patch("app.routers.ap_invoice.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.create_task")
    @patch("app.routers.ap_invoice.extract_ap_invoice_data", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.has_submitted_doc", new_callable=AsyncMock)
    def test_extract_ap_invoice_duplicate(
        self,
        mock_has_submitted,
        mock_extract_data,
        mock_create_task,
        mock_consume_document,
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
            files = [("file", ("invoice.pdf", VALID_PDF, "application/pdf"))]
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

    @patch("app.routers.ap_invoice.consume_document", new_callable=AsyncMock)
    @patch("app.routers.ap_invoice.create_task")
    @patch("app.routers.ap_invoice.extract_ap_invoice_data", new_callable=AsyncMock)
    def test_extract_ap_invoice_error_marks_failed(
        self,
        mock_extract_data,
        mock_create_task,
        mock_consume_document,
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
            files = [("file", ("invoice.pdf", VALID_PDF, "application/pdf"))]
            with pytest.raises(RuntimeError):
                client.post(
                    f"{BASE_URL}/extract",
                    files=files,
                    headers=AUTH_HEADERS,
                )

        assert dummy_task.status == TaskStatus.FAILED
        assert dummy_task.error_message == "LLM Failure"


# ── Per-page charging ─────────────────────────────────────────────────────────


class TestPerPageCharging:
    """One credit per page actually sent to the LLM — and the refund gives back the same."""

    def _run(
        self,
        mock_session,
        *,
        pdf: bytes,
        data: dict | None = None,
        fail: bool = False,
        charged: str | None = "credit",
    ):
        """POST /extract with the charge/refund calls mocked.

        Returns (consume, refund, create_task)."""
        ctx_mock, db_mock = mock_session
        dummy_task = OCRTask(
            id=uuid.uuid4(),
            tenant_id=FAKE_SESSION.tenant_id,
            module_id="ap_invoice",
            original_filename="invoice.pdf",
            status=TaskStatus.PROCESSING,
        )
        task_result = MagicMock()
        task_result.scalar_one_or_none.return_value = dummy_task
        db_mock.execute.return_value = task_result

        consume = AsyncMock(return_value=charged)
        refund = AsyncMock()
        # create_task is async — patch() would autospec it, an explicit mock must not
        # be a plain MagicMock or the router's await blows up.
        create = AsyncMock(return_value=dummy_task)
        extract = AsyncMock()
        if fail:
            extract.side_effect = RuntimeError("LLM Failure")
        else:
            extract.return_value = {"vendorName": "Acme", "documentNumber": "INV-1"}

        with (
            patch("app.routers.ap_invoice.consume_document", consume),
            patch("app.routers.ap_invoice.refund_document", refund),
            patch("app.routers.ap_invoice.extract_ap_invoice_data", extract),
            patch("app.routers.ap_invoice.create_task", create),
            patch("app.routers.ap_invoice.has_submitted_doc", new_callable=AsyncMock) as dup,
            patch("app.routers.ap_invoice.async_session", return_value=ctx_mock),
            make_test_client(db_mock) as client,
        ):
            dup.return_value = False
            kwargs = {
                "files": [("file", ("invoice.pdf", pdf, "application/pdf"))],
                "data": data or {},
                "headers": AUTH_HEADERS,
            }
            if fail:
                with pytest.raises(RuntimeError):
                    client.post(f"{BASE_URL}/extract", **kwargs)
            else:
                assert client.post(f"{BASE_URL}/extract", **kwargs).status_code == 200
        return consume, refund, create

    def test_selected_pages_cost_one_credit_each(self, mock_session):
        consume, _, _ = self._run(mock_session, pdf=VALID_PDF_3P, data={"selected_pages": "[0,2]"})
        consume.assert_awaited_once_with(increment=2)

    def test_no_selection_charges_every_page(self, mock_session):
        consume, _, _ = self._run(mock_session, pdf=VALID_PDF_3P)
        consume.assert_awaited_once_with(increment=3)

    def test_single_page_pdf_still_costs_one(self, mock_session):
        consume, _, _ = self._run(mock_session, pdf=VALID_PDF)
        consume.assert_awaited_once_with(increment=1)

    def test_failure_refunds_what_it_charged(self, mock_session):
        consume, refund, _ = self._run(
            mock_session, pdf=VALID_PDF_3P, data={"selected_pages": "[0,1]"}, fail=True
        )
        consume.assert_awaited_once_with(increment=2)
        refund.assert_awaited_once_with("credit", increment=2)

    # ── the task records what it cost ────────────────────────────────────────
    # Nothing else can: a subscription-funded scan writes no ledger row, and a
    # credit-funded one refers to the file by name, not by task id.

    def test_task_records_the_documents_it_cost(self, mock_session):
        _, _, create = self._run(mock_session, pdf=VALID_PDF_3P, data={"selected_pages": "[0,2]"})
        assert create.call_args.kwargs["charged_docs"] == 2

    def test_task_records_zero_when_the_charge_failed_open(self, mock_session):
        # consume_document returns None on an infra error — it fails open rather than
        # blocking extraction, and nothing was taken, so the task must not claim it was.
        _, _, create = self._run(mock_session, pdf=VALID_PDF_3P, charged=None)
        assert create.call_args.kwargs["charged_docs"] == 0


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
        mock_suggest.return_value = ({"0": {"acc": "5100", "dept": "FIN"}}, True)

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
