import logging
import base64
import os
import uuid
from typing import List

from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.ap_invoice_service import extract_ap_invoice_data, suggest_gl_for_items
from app.services.carmen_service import get_account_codes, get_departments, CarmenAPIError
from app.database import get_db
from app.models.orm import APInvoice
from app.auth import get_current_session, SessionInfo
from app.services import audit_service
from app.services.audit_service import AuditAction
from app.services.file_service import file_service
from app.services.ocr_service import create_task
from app.context import current_document_ref
from app.constants import Module

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ap-invoice", tags=["AP Invoice"])


def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".webp": "image/webp",
        ".pdf":  "application/pdf",
    }.get(ext, "image/jpeg")


@router.post("/extract")
async def extract_ap_invoice(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Stateless AP Invoice OCR extraction using Vision LLM."""
    current_document_ref.set(file.filename or "")
    await audit_service.log_action(
        session, AuditAction.EXTRACT,
        resource=Module.AP_INVOICE, resource_id=file.filename,
        ip_address=request.client.host if request.client else None,
    )

    from app.services.usage_service import check_quota
    await check_quota()

    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    file_bytes = await file_service.validate_and_read(file)
    mime_type  = _get_mime_type(file.filename)
    data_url   = f"data:{mime_type};base64,{base64.b64encode(file_bytes).decode()}"

    task = await create_task(
        db,
        tenant_id=session.tenant_id,
        business_unit_id=session.business_unit_id,
        module_id=Module.AP_INVOICE,
        original_filename=file.filename,
        carmen_user_id=session.carmen_user_id,
    )

    data = await extract_ap_invoice_data(data_url, file.filename, task.id)

    doc_no      = data.get("documentNumber")
    vendor_name = data.get("vendorName")
    is_duplicate = False

    if doc_no and vendor_name:
        dup = await db.execute(
            select(APInvoice).where(
                APInvoice.tenant_id == session.tenant_id,
                APInvoice.business_unit_id == session.business_unit_id,
                APInvoice.doc_no == doc_no,
                APInvoice.vendor_name == vendor_name,
                APInvoice.submitted_at.isnot(None),
                APInvoice.deleted_at.is_(None),
            )
        )
        if dup.scalars().first():
            is_duplicate = True
            logger.info("Duplicate AP Invoice: %s / %s", doc_no, vendor_name)

    if not is_duplicate:
        ap_inv = APInvoice(
            id=str(uuid.uuid4()),
            task_id=task.id,
            tenant_id=session.tenant_id,
            business_unit_id=session.business_unit_id,
            vendor_name=vendor_name,
            doc_no=doc_no,
            doc_date=data.get("documentDate"),
            original_filename=file.filename,
            carmen_user_id=session.carmen_user_id or None,
        )
        db.add(ap_inv)
        await db.commit()
        data["id"] = ap_inv.id
    else:
        data["id"] = None

    data["is_duplicate"] = is_duplicate
    return data


class SuggestGLItem(BaseModel):
    index:       int
    category:    str   = ""
    description: str   = ""
    unit_price:  float = 0.0


class SuggestGLRequest(BaseModel):
    items:        List[SuggestGLItem]
    invoice_desc: str = ""


@router.post("/suggest-gl")
async def suggest_gl(
    request: Request,
    body: SuggestGLRequest,
    session: SessionInfo = Depends(get_current_session),
):
    """AI-suggest dept/acc for AP invoice line items."""
    await audit_service.log_action(
        session, AuditAction.SUGGEST_GL, resource=Module.AP_INVOICE,
        ip_address=request.client.host if request.client else None,
    )
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    if not body.items:
        return {"suggestions": {}}

    try:
        accounts_raw = await get_account_codes(session.carmen_token)
        depts_raw    = await get_departments(session.carmen_token)
    except CarmenAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=f"Carmen API error: {exc.detail}")

    items_payload = [
        {"index": i.index, "category": i.category,
         "description": i.description, "unit_price": i.unit_price}
        for i in body.items
    ]
    suggestions = await suggest_gl_for_items(
        items_payload, accounts_raw, depts_raw, invoice_desc=body.invoice_desc
    )
    return {"suggestions": suggestions}
