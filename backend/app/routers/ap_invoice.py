import logging
import base64
import os
from typing import List

from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.ap_invoice_service import extract_ap_invoice_data, suggest_gl_for_items
from app.services.carmen_service import get_account_codes, get_departments, CarmenAPIError
from app.database import get_db
from app.models.orm import OCRTask, TaskStatus
from app.models.enums import DocumentType
from app.auth import get_current_session, SessionInfo
from app.services import audit_service
from app.services.audit_service import AuditAction
from app.services.file_service import file_service
from app.context import current_document_ref
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ap-invoice", tags=["AP Invoice"])


def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(ext, "image/jpeg")


@router.post("/extract")
async def extract_ap_invoice(
    request: Request,
    file: UploadFile = File(..., description="รูปใบแจ้งหนี้/ใบกำกับภาษี AP (JPG, PNG, PDF)"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Stateless AP Invoice OCR extraction using Vision LLM (OpenRouter)."""
    current_document_ref.set(file.filename or "")
    await audit_service.log_action(
        session, AuditAction.EXTRACT, DocumentType.AP_INVOICE,
        document_ref=file.filename, ip_address=request.client.host if request.client else None,
    )
    from app.services.usage_service import check_bu_rate_limit
    await check_bu_rate_limit()

    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    # Use centralized file validation and reading
    file_bytes = await file_service.validate_and_read(file)

    mime_type = _get_mime_type(file.filename)
    data_url = f"data:{mime_type};base64,{base64.b64encode(file_bytes).decode()}"

    task = OCRTask(
        id=str(uuid.uuid4()),
        original_filename=file.filename,
        status=TaskStatus.COMPLETED,
        ocr_engine=settings.ocr_engine,
    )
    db.add(task)
    await db.commit()

    data = await extract_ap_invoice_data(data_url, file.filename, task.id)

    from app.models.orm import APInvoice
    from app.context import current_user_id
    from sqlalchemy import select

    ap_invoice_id = str(uuid.uuid4())

    # Check for duplicates (same doc_no + vendor_name) — tenant isolation by DB
    # Match only documents that have been successfully submitted (submitted_at is not null)
    is_duplicate = False
    doc_no      = data.get("documentNumber")
    vendor_name = data.get("vendorName")

    if doc_no and vendor_name:
        dup_check = await db.execute(
            select(APInvoice).where(
                APInvoice.doc_no == doc_no,
                APInvoice.vendor_name == vendor_name,
                APInvoice.submitted_at.isnot(None),
            )
        )
        if dup_check.scalars().first():
            is_duplicate = True
            logger.info(f"Duplicate AP Invoice detected: {doc_no} for {vendor_name}")

    # Only save to ap_invoices if NOT a duplicate
    if not is_duplicate:
        ap_inv = APInvoice(
            id=ap_invoice_id,
            task_id=task.id,
            user_id=current_user_id.get() or session.user_id,
            vendor_name=vendor_name,
            doc_no=doc_no,
            doc_date=data.get("documentDate"),
            original_filename=file.filename,
        )
        db.add(ap_inv)
        await db.commit()
        data["id"] = ap_invoice_id
    else:
        # For duplicates, we don't save a new APInvoice record, 
        # but we still return the extracted data for UI display.
        data["id"] = None
    data["is_duplicate"] = is_duplicate
    return data


class SuggestGLItem(BaseModel):
    index: int
    category: str = ""
    description: str = ""
    unit_price: float = 0.0


class SuggestGLRequest(BaseModel):
    items: List[SuggestGLItem]
    invoice_desc: str = ""


@router.post("/suggest-gl")
async def suggest_gl(
    request: Request,
    body: SuggestGLRequest,
    session: SessionInfo = Depends(get_current_session),
):
    """AI-suggest dept/acc for AP invoice expense items using category + description."""
    await audit_service.log_action(
        session, AuditAction.SUGGEST_GL, DocumentType.AP_INVOICE,
        ip_address=request.client.host if request.client else None,
    )
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    if not body.items:
        return {"suggestions": {}}

    try:
        accounts_raw = await get_account_codes(session.carmen_token)
        depts_raw = await get_departments(session.carmen_token)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen API error: {e.detail}")

    items_payload = [{"index": i.index, "category": i.category, "description": i.description, "unit_price": i.unit_price} for i in body.items]
    suggestions = await suggest_gl_for_items(items_payload, accounts_raw, depts_raw, invoice_desc=body.invoice_desc)
    return {"suggestions": suggestions}
