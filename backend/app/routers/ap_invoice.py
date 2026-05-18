import base64
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import SessionInfo, get_current_session
from app.config import settings
from app.constants import Module
from app.context import current_document_ref
from app.database import get_db
from app.models.orm import APInvoice
from app.services import audit_service
from app.services.ap_invoice_service import extract_ap_invoice_data, suggest_gl_for_items
from app.services.audit_service import AuditAction
from app.services.carmen_service import CarmenAPIError, get_account_codes, get_departments
from app.services.file_service import file_service
from app.services.ocr_service import create_task
from app.services.usage_service import check_quota
from app.utils.db_helpers import has_submitted_doc
from app.utils.mime import get_mime_type

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ap-invoice", tags=["AP Invoice"])


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
        session,
        AuditAction.EXTRACT,
        resource=Module.AP_INVOICE,
        resource_id=file.filename,
        ip_address=request.client.host if request.client else None,
    )

    await check_quota()

    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    filename = file.filename or "invoice"
    file_bytes = await file_service.validate_and_read(file)
    mime_type = get_mime_type(filename)
    data_url = f"data:{mime_type};base64,{base64.b64encode(file_bytes).decode()}"

    task = await create_task(
        db,
        tenant_id=session.tenant_id,
        business_unit_id=session.business_unit_id,
        module_id=Module.AP_INVOICE,
        original_filename=filename,
        carmen_user_id=session.carmen_user_id,
    )

    data = await extract_ap_invoice_data(data_url, filename, str(task.id))

    doc_no = data.get("documentNumber")
    vendor_name = data.get("vendorName")
    is_duplicate = False

    if doc_no and vendor_name:
        is_duplicate = await has_submitted_doc(
            db,
            APInvoice,
            tenant_id=session.tenant_id,
            business_unit_id=session.business_unit_id,
            doc_no=doc_no,
            vendor_name=vendor_name,
        )
        if is_duplicate:
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
    index: int
    category: str = ""
    description: str = ""
    unit_price: float = 0.0


class SuggestGLRequest(BaseModel):
    items: list[SuggestGLItem]
    invoice_desc: str = ""


@router.post("/suggest-gl")
async def suggest_gl(
    request: Request,
    body: SuggestGLRequest,
    session: SessionInfo = Depends(get_current_session),
):
    """AI-suggest dept/acc for AP invoice line items."""
    await audit_service.log_action(
        session,
        AuditAction.SUGGEST_GL,
        resource=Module.AP_INVOICE,
        ip_address=request.client.host if request.client else None,
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
    suggestions = await suggest_gl_for_items(
        items_payload, accounts_raw, depts_raw, invoice_desc=body.invoice_desc
    )
    return {"suggestions": suggestions}
