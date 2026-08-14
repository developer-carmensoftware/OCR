import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select

from app.auth import SessionInfo, get_current_session
from app.config import settings
from app.constants import Module
from app.context import current_document_ref
from app.database import async_session
from app.models.orm import APInvoice, OCRTask, TaskStatus
from app.models.schemas import SuggestGLRequest
from app.services import audit_service
from app.services.ap_invoice_service import extract_ap_invoice_data, suggest_for_items
from app.services.audit_service import AuditAction
from app.services.carmen_service import CarmenAPIError, get_account_codes, get_departments
from app.services.credit_service import consume_document, refund_document
from app.services.file_service import file_service
from app.services.quota_service import assert_module_enabled
from app.services.task_service import create_task, mark_failed
from app.utils.client_ip import get_client_ip
from app.utils.date_parsing import parse_doc_date
from app.utils.db_helpers import has_submitted_doc
from app.utils.pages import billable_pages, parse_selected_pages
from app.utils.pdf_utils import ensure_pdf_openable

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ap-invoice", tags=["AP Invoice"])


@router.post("/extract")
async def extract_ap_invoice(
    request: Request,
    file: UploadFile = File(...),
    selected_pages: str | None = Form(None),
    pdf_password: str | None = Form(None),
    session: SessionInfo = Depends(get_current_session),
):
    """Stateless AP Invoice OCR extraction using Vision LLM.

    DB sessions are scoped tightly — the long-running LLM call (2-10s) runs
    with no connection held, so the pool can't be exhausted under burst load.
    """
    current_document_ref.set(file.filename or "")
    await audit_service.log_action(
        session,
        AuditAction.EXTRACT,
        resource=Module.AP_INVOICE,
        resource_id=file.filename,
        ip_address=get_client_ip(request),
    )

    # Validate cheap config/input BEFORE consuming a credit, so a misconfigured
    # server or a malformed request can't burn a document credit for nothing.
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    # Optional page selection (JSON-encoded 0-based list, e.g. "[0,1,3]"). Form data
    # can't carry a list directly. None/empty → service processes all pages.
    try:
        parsed_pages = parse_selected_pages(selected_pages)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    file_bytes, filename = await file_service.validate_and_read(file)
    if not filename:
        filename = "invoice"

    # Open the PDF before consuming a credit so an encrypted/corrupt PDF fails first
    # (PdfPasswordRequired → 400 / ExtractionError → 422) without burning a credit.
    # The page count comes back from the same open — it is what the scan is priced on.
    page_count = await ensure_pdf_openable(file_bytes, filename, pdf_password)

    # Access gate before any charge — 403 if an admin disabled this module.
    await assert_module_enabled(Module.AP_INVOICE)

    # One credit per page sent to the LLM: a 3-page selection costs 3, not 1. Bounded
    # by MAX_PAGES_PER_CALL, the same cap the extraction itself truncates to.
    # ponytail: the whole N is charged to a single pool (subscription OR credits) —
    # a tenant with 3 allowance left scanning 5 pages pays 5 credits and strands the 3.
    # Split across pools inside consume_document if that is ever reported.
    pages = billable_pages(page_count, parsed_pages)
    charged = await consume_document(increment=pages)

    # Past this point the credit is charged; refund it if anything below fails so a
    # failed document (LLM error/timeout) never costs the user.
    task_id: str | None = None
    try:
        # Short DB session: create the task row, then release the connection.
        async with async_session() as db:
            task = await create_task(
                db,
                tenant_id=session.tenant_id,
                module_id=Module.AP_INVOICE,
                original_filename=filename,
                carmen_user_id=session.carmen_user_id,
                # `charged` is None when consume_document failed open — nothing was taken.
                charged_docs=pages if charged else 0,
            )
            task_id = str(task.id)

        # LLM extraction — no DB connection held during this call.
        data = await extract_ap_invoice_data(
            file_bytes, filename, task_id, selected_pages=parsed_pages, pdf_password=pdf_password
        )

        doc_no = data.get("documentNumber")
        vendor_name = data.get("vendorName")
        is_duplicate = False

        # Short DB session: duplicate check + insert AP invoice row.
        async with async_session() as db:
            if doc_no and vendor_name:
                is_duplicate = await has_submitted_doc(
                    db,
                    APInvoice,
                    tenant_id=session.tenant_id,
                    doc_no=doc_no,
                    vendor_name=vendor_name,
                )
                if is_duplicate:
                    logger.info("Duplicate AP Invoice: %s / %s", doc_no, vendor_name)

            if not is_duplicate:
                ap_inv = APInvoice(
                    id=uuid.uuid4(),
                    task_id=uuid.UUID(task_id),
                    tenant_id=session.tenant_id,
                    vendor_name=vendor_name,
                    doc_no=doc_no,
                    doc_date=parse_doc_date(data.get("documentDate")),
                    original_filename=file.filename,
                    carmen_user_id=session.carmen_user_id or None,
                )
                db.add(ap_inv)
                data["id"] = ap_inv.id
            else:
                data["id"] = None

            task_res = await db.execute(select(OCRTask).where(OCRTask.id == uuid.UUID(task_id)))
            task_obj = task_res.scalar_one_or_none()
            if task_obj:
                task_obj.status = TaskStatus.COMPLETED  # type: ignore[assignment]
                task_obj.completed_at = datetime.now(UTC)  # type: ignore[assignment]

            await db.commit()

        data["is_duplicate"] = is_duplicate
        return data

    except Exception as exc:
        logger.error("Failed to process AP Invoice OCR task %s: %s", task_id, exc)
        await refund_document(charged, increment=pages)
        if task_id is not None:
            async with async_session() as db:
                await mark_failed(db, task_id, str(exc))
        raise


@router.post("/suggest")
async def suggest(
    request: Request,
    body: SuggestGLRequest,
    session: SessionInfo = Depends(get_current_session),
):
    """AI-suggest dept/acc for AP invoice line items."""
    await audit_service.log_action(
        session,
        AuditAction.SUGGEST_GL,
        resource=Module.AP_INVOICE,
        ip_address=get_client_ip(request),
    )

    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    if not body.items:
        return {"suggestions": {}}

    try:
        accounts_raw = await get_account_codes(session.carmen_token)
        depts_raw = await get_departments(session.carmen_token)
    except CarmenAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=f"Carmen API error: {exc.detail}")

    items_payload = [
        {
            "index": i.index,
            "category": i.category,
            "description": i.description,
            "unit_price": i.unit_price,
        }
        for i in body.items
    ]
    suggestions, llm_ok = await suggest_for_items(
        items_payload,
        accounts_raw,
        depts_raw,
        invoice_desc=body.invoice_desc,
        vn_code=body.vn_code,
        carmen_token=session.carmen_token,
    )
    return {"suggestions": suggestions, "llm_partial": not llm_ok}
