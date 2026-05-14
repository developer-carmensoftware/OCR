"""
OCR API Routes — thin HTTP layer.

Business logic lives in:
  app/tools/submit.py        — receipt persistence
  app/services/ocr_service.py — task/export helpers
"""

import logging
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Request, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.config import settings
from app.models import OCRTask, CreditCard, TaskStatus, ExtractedCreditCardData
from app.services import ocr_service
from app.services.ocr_service import create_task
from app.services.correction_service import get_correction_hints
from app.tools import submit as submit_tool
from app.tools.submit import SubmitInput
from app.auth import get_current_session, SessionInfo
from app.services import audit_service
from app.services.audit_service import AuditAction
from app.services.file_service import file_service
from app.context import current_document_ref
from app.constants import Module


# ── Submit payload schemas ────────────────────────────────────────────────────

class SubmitDetailItem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    Transaction: Optional[str] = Field(None, alias="transaction")
    Date:        Optional[str] = Field(None, alias="date")
    Amount:      Optional[str] = Field(None, alias="amount")
    Type:        Optional[str] = Field(None, alias="type")


class SubmitHeader(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    BankCode:        Optional[str] = Field(None, alias="bank_code")
    CompanyName:     Optional[str] = Field(None, alias="company_name")
    BankCompanyName: Optional[str] = Field(None, alias="bank_company_name")
    DocDate:         Optional[str] = Field(None, alias="doc_date")
    DocNo:           Optional[str] = Field(None, alias="doc_no")
    BranchNo:        Optional[str] = Field(None, alias="branch_no")
    # Legacy frontend fields — still accepted, not persisted
    BankName:        Optional[str] = Field(None, alias="bank_name")
    DocName:         Optional[str] = Field(None, alias="doc_name")
    MerchantName:    Optional[str] = Field(None, alias="merchant_name")


class SubmitPayload(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    BankCode:         Optional[str] = Field(None, alias="bank_code")
    BankType:         Optional[str] = Field(None, alias="bank_type")   # legacy alias
    OriginalFilename: Optional[str] = Field(None, alias="original_filename")
    Header:           SubmitHeader
    Details:          List[SubmitDetailItem] = []


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ocr", tags=["OCR"])


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/extract
# ═══════════════════════════════════════════════════

@router.post("/extract", response_model=List[ExtractedCreditCardData])
async def extract_card(
    request:   Request,
    files:     List[UploadFile] = File(...),
    bank_code: Optional[str]    = Query(None, description="Bank code: BBL / KBANK / SCB"),
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Stateless extraction — reads files, calls LLM, returns JSON. Does NOT write to DB."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    filenames = file_service.get_filenames_string(files)
    current_document_ref.set(filenames)
    await audit_service.log_action(
        session, AuditAction.EXTRACT,
        resource="credit_card", resource_id=filenames,
        ip_address=request.client.host if request.client else None,
    )

    from app.services.usage_service import check_quota
    await check_quota()

    hints   = await get_correction_hints(bank_code, db) if bank_code else {}
    results = []

    for upload_file in files:
        file_bytes = await file_service.validate_and_read(upload_file)

        task = await create_task(
            db,
            tenant_id=session.tenant_id,
            business_unit_id=session.business_unit_id,
            module_id=Module.CREDIT_CARD_OCR,
            original_filename=upload_file.filename,
            carmen_user_id=session.carmen_user_id,
        )

        extracted = await ocr_service.extract_stateless(
            file_bytes=file_bytes,
            original_filename=upload_file.filename,
            bank_code=bank_code,
            hints=hints or None,
            task_id=task.id,
        )

        if extracted.doc_no:
            dup = await db.execute(
                select(CreditCard).where(
                    CreditCard.tenant_id == session.tenant_id,
                    CreditCard.business_unit_id == session.business_unit_id,
                    CreditCard.doc_no == extracted.doc_no,
                    CreditCard.submitted_at.isnot(None),
                    CreditCard.deleted_at.is_(None),
                )
            )
            if dup.scalars().first():
                extracted.is_duplicate = True

        results.append(extracted)

    return results


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks
# ═══════════════════════════════════════════════════

@router.get("/tasks")
async def list_tasks(
    status: Optional[TaskStatus] = Query(None),
    limit:  int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    tasks, total = await ocr_service.get_all_tasks(db, status=status, limit=limit, offset=offset)
    return JSONResponse(content={
        "total": total,
        "tasks": [
            {
                "id":                t.id,
                "original_filename": t.original_filename,
                "module_id":         t.module_id,
                "status":            t.status.value if hasattr(t.status, "value") else t.status,
                "ocr_engine":        t.ocr_engine,
                "error_message":     t.error_message,
                "created_at":        t.created_at.isoformat() if t.created_at else None,
                "completed_at":      t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in tasks
        ],
    })


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks/{task_id}
# ═══════════════════════════════════════════════════

@router.get("/tasks/{task_id}")
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    result = await db.execute(
        select(OCRTask)
        .options(selectinload(OCRTask.credit_card))
        .where(OCRTask.id == task_id, OCRTask.tenant_id == session.tenant_id,
               OCRTask.deleted_at.is_(None))
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    card      = task.credit_card
    card_data = None
    if card:
        from app.models.orm import CreditCardTransaction
        tx_result = await db.execute(
            select(CreditCardTransaction)
            .where(CreditCardTransaction.credit_card_id == card.id,
                   CreditCardTransaction.deleted_at.is_(None))
            .order_by(CreditCardTransaction.sort_order)
        )
        card_data = {
            "id":                card.id,
            "task_id":           card.task_id,
            "bank_code":         card.bank_code,
            "company_name":      card.company_name,
            "bank_company_name": card.bank_company_name,
            "doc_date":          card.doc_date,
            "doc_no":            card.doc_no,
            "branch_no":         card.branch_no,
            "submitted_at":      card.submitted_at.isoformat() if card.submitted_at else None,
            "created_at":        card.created_at.isoformat() if card.created_at else None,
            "transactions": [
                {"tx_date": t.tx_date, "description": t.description,
                 "amount": float(t.amount) if t.amount else None, "tx_type": t.tx_type}
                for t in tx_result.scalars().all()
            ],
        }

    return JSONResponse(content={
        "id":                task.id,
        "original_filename": task.original_filename,
        "module_id":         task.module_id,
        "status":            task.status.value if hasattr(task.status, "value") else task.status,
        "ocr_engine":        task.ocr_engine,
        "error_message":     task.error_message,
        "created_at":        task.created_at.isoformat() if task.created_at else None,
        "completed_at":      task.completed_at.isoformat() if task.completed_at else None,
        "credit_card":       card_data,
    })


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/submit
# ═══════════════════════════════════════════════════

@router.post("/submit")
async def submit_receipt_stateless(
    request: Request,
    payload: SubmitPayload,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Save user-confirmed receipt data to DB via submit_tool."""
    doc_ref = payload.Header.DocNo or payload.OriginalFilename or ""
    current_document_ref.set(doc_ref)
    await audit_service.log_action(
        session, AuditAction.SUBMIT,
        resource="credit_card", resource_id=doc_ref,
        ip_address=request.client.host if request.client else None,
    )

    bank_code = payload.BankCode or payload.Header.BankCode or payload.BankType or None

    inp = SubmitInput(
        bank_code=bank_code,
        original_filename=payload.OriginalFilename or "uploaded_file",
        doc_no=payload.Header.DocNo,
        doc_date=payload.Header.DocDate,
        bank_name=payload.Header.BankName,
        company_name=payload.Header.CompanyName,
        merchant_name=payload.Header.MerchantName,
        bank_company_name=payload.Header.BankCompanyName,
        branch_no=payload.Header.BranchNo,
        details=[
            {"transaction": d.Transaction, "date": d.Date,
             "amount": d.Amount, "type": d.Type}
            for d in payload.Details
        ],
    )

    result = await submit_tool.run(inp, db)

    if not result.success:
        err         = result.errors[0] if result.errors else "Submit failed"
        status_code = 409 if (result.output or {}).get("error") == "DUPLICATE_DOC_NO" else 500
        raise HTTPException(status_code=status_code, detail=err)

    return {"ok": True, **result.output}


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/export
# ═══════════════════════════════════════════════════

@router.get("/export")
async def export_csv(
    request: Request,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    await audit_service.log_action(
        session, AuditAction.EXPORT, resource="credit_card",
        ip_address=request.client.host if request.client else None,
    )
    csv_path = await ocr_service.export_tasks_to_csv(db)
    filename = csv_path.replace("\\", "/").split("/")[-1]
    return FileResponse(
        path=csv_path, media_type="text/csv", filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/health  — public, no auth
# ═══════════════════════════════════════════════════

@router.get("/health")
async def health_check():
    import httpx

    llm_status = "not_configured"
    llm_error  = None

    if settings.openrouter_api_key:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    f"{settings.openrouter_base_url}/models",
                    headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                )
            llm_status = "ok" if r.status_code == 200 else "error"
            if r.status_code != 200:
                llm_error = f"HTTP {r.status_code}"
        except Exception as exc:
            llm_status = "error"
            llm_error  = str(exc)

    healthy = llm_status == "ok"
    body = {
        "status":                      "healthy" if healthy else "degraded",
        "openrouter":                  llm_status,
        "ocr_engine":                  settings.ocr_engine,
        "openrouter_ocr_model":        settings.openrouter_ocr_model,
        "openrouter_suggestion_model": settings.openrouter_suggestion_model,
        "timestamp":                   datetime.utcnow().isoformat(),
    }
    if llm_error:
        body["openrouter_error"] = llm_error
    return JSONResponse(status_code=200 if healthy else 503, content=body)


@router.get("/debug-llm")
async def debug_last_llm_response():
    if not settings.app_debug:
        raise HTTPException(status_code=403, detail="Debug mode is disabled")
    import pathlib, tempfile
    p = pathlib.Path(tempfile.gettempdir()) / "last_llm_response.txt"
    if not p.exists():
        return {"raw": "(no response saved yet)", "path": str(p)}
    return {"raw": p.read_text(encoding="utf-8"), "path": str(p)}
