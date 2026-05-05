"""
OCR API Routes — thin HTTP layer.

Business logic lives in:
  app/tools/extract.py  — OCR extraction
  app/tools/submit.py   — receipt persistence
  app/services/ocr_service.py — task/export helpers
Carmen proxy endpoints live in app/routers/carmen.py.
"""

import logging
import uuid
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
from app.models import (
    TaskStatus,
    BankType,
    OCRTask,
    CreditCard,
    ExtractedCreditCardData,
    DocumentType,
)
from app.services import ocr_service
from app.services.correction_service import get_correction_hints
from app.tools import submit as submit_tool
from app.tools.submit import SubmitInput
from app.utils.image_processing import is_valid_image
from app.auth import get_current_session, SessionInfo
from app.services import audit_service
from app.services.audit_service import AuditAction
from app.services.file_service import file_service
from app.context import current_document_ref


# ── Pydantic schemas for submit endpoint ────────────
# Frontend sends amount fields too (PayAmt/CommisAmt/TaxAmt/WHTAmount/Total)
# but only Transaction is persisted; the rest are silently ignored.
class SubmitDetailItem(BaseModel):
    model_config = ConfigDict(extra='ignore', populate_by_name=True)
    Transaction: Optional[str] = Field(None, alias="transaction")

class SubmitHeader(BaseModel):
    # Accepts MerchantId from frontend for display continuity but it is NOT persisted.
    model_config = ConfigDict(extra='ignore', populate_by_name=True)
    DateProcessed:    Optional[str] = Field(None, alias="date_processed")
    BankName:         Optional[str] = Field(None, alias="bank_name")
    DocName:          Optional[str] = Field(None, alias="doc_name")
    CompanyName:      Optional[str] = Field(None, alias="company_name")
    DocDate:          Optional[str] = Field(None, alias="doc_date")
    DocNo:            Optional[str] = Field(None, alias="doc_no")
    MerchantName:     Optional[str] = Field(None, alias="merchant_name")
    MerchantId:       Optional[str] = Field(None, alias="merchant_id")
    BankCompanyname:  Optional[str] = Field(None, alias="bank_companyname")
    BranchNo:         Optional[str] = Field(None, alias="branch_no")

class SubmitPayload(BaseModel):
    model_config = ConfigDict(extra='ignore', populate_by_name=True)
    BankType:         Optional[str] = Field(None, alias="bank_type")
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
    request: Request,
    files: List[UploadFile] = File(..., description="รูปใบเสร็จ (JPG, PNG, PDF)"),
    bank_type: Optional[BankType] = Query(None, description="ประเภทธนาคาร BBL/KBANK/SCB"),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    """
    Stateless extraction: read files, call LLM, return JSON data.
    Does NOT save to DB or Disk.
    Sets is_duplicate=True if doc_no already exists in submitted receipts.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    filenames = file_service.get_filenames_string(files)
    current_document_ref.set(filenames)
    await audit_service.log_action(
        _session, AuditAction.EXTRACT, DocumentType.CREDIT_CARD,
        document_ref=filenames, ip_address=request.client.host if request.client else None,
    )

    from app.services.usage_service import check_bu_rate_limit
    await check_bu_rate_limit()

    results = []
    bank_type_str = bank_type.value if bank_type else None
    hints = await get_correction_hints(bank_type_str, db) if bank_type_str else {}

    for upload_file in files:
        # Use centralized file validation and reading
        file_bytes = await file_service.validate_and_read(upload_file)

        task = OCRTask(
            id=str(uuid.uuid4()),
            original_filename=upload_file.filename,
            status=TaskStatus.COMPLETED,
            ocr_engine=settings.ocr_engine,
        )
        db.add(task)
        await db.commit()

        extracted = await ocr_service.extract_stateless(
            file_bytes=file_bytes,
            original_filename=upload_file.filename,
            bank_type=bank_type_str,
            hints=hints or None,
            task_id=task.id,
        )

        if extracted.doc_no:
            dup = await db.execute(
                select(CreditCard).where(
                    CreditCard.doc_no == extracted.doc_no,
                    CreditCard.submitted_at.isnot(None),
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
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    tasks, total = await ocr_service.get_all_tasks(db, status=status, limit=limit, offset=offset)
    return JSONResponse(content={
        "total": total,
        "tasks": [
            {
                "id": t.id,
                "original_filename": t.original_filename,
                "status": t.status.value if hasattr(t.status, "value") else t.status,
                "ocr_engine": t.ocr_engine,
                "error_message": t.error_message,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
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
    _session: SessionInfo = Depends(get_current_session),
):
    try:
        result = await db.execute(
            select(OCRTask)
            .options(selectinload(OCRTask.credit_card))
            .where(OCRTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        credit_card = task.credit_card

        return JSONResponse(content={
            "id": task.id,
            "original_filename": task.original_filename,
            "status": task.status.value if hasattr(task.status, "value") else task.status,
            "ocr_engine": task.ocr_engine,
            "error_message": task.error_message,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "credit_card": {
                "id": credit_card.id,
                "task_id": credit_card.task_id,
                "bank_name": credit_card.bank_name,
                "bank_type": credit_card.bank_type.value if credit_card.bank_type and hasattr(credit_card.bank_type, "value") else credit_card.bank_type,
                "doc_name": credit_card.doc_name,
                "company_name": credit_card.company_name,
                "doc_date": credit_card.doc_date,
                "doc_no": credit_card.doc_no,
                "merchant_name": credit_card.merchant_name,
                "submitted_at": credit_card.submitted_at.isoformat() if credit_card.submitted_at else None,
                "created_at": credit_card.created_at.isoformat() if credit_card.created_at else None,
                "transactions": credit_card.transactions or [],
            } if credit_card else None,
        })
    except HTTPException:
        raise
    except Exception:
        logger.error(f"get_task({task_id}) failed", exc_info=True)
        raise


# ═══════════════════════════════════════════════════
# PATCH /api/v1/ocr/credit-cards/{card_id}/submit
# ═══════════════════════════════════════════════════

@router.patch("/credit-cards/{card_id}/submit")
async def mark_card_submitted(
    card_id: str,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    result = await db.execute(select(CreditCard).where(CreditCard.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail=f"CreditCard {card_id} not found")
    card.submitted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "submitted_at": card.submitted_at.isoformat()}


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
    """Save user-confirmed data to DB. Delegates all logic to submit_tool."""
    doc_ref = payload.Header.DocNo or payload.OriginalFilename or ""
    current_document_ref.set(doc_ref)
    await audit_service.log_action(
        session, AuditAction.SUBMIT, DocumentType.CREDIT_CARD,
        document_ref=doc_ref, ip_address=request.client.host if request.client else None,
    )
    inp = SubmitInput(
        bank_type=payload.BankType,
        original_filename=payload.OriginalFilename or "uploaded_file",
        doc_no=payload.Header.DocNo,
        doc_date=payload.Header.DocDate,
        bank_name=payload.Header.BankName,
        doc_name=payload.Header.DocName,
        company_name=payload.Header.CompanyName,
        merchant_name=payload.Header.MerchantName,
        bank_companyname=payload.Header.BankCompanyname,
        branch_no=payload.Header.BranchNo,
        details=[
            {"transaction": d.Transaction}
            for d in payload.Details
        ],
    )

    result = await submit_tool.run(inp, db)

    if not result.success:
        raise HTTPException(status_code=500, detail=result.errors[0] if result.errors else "Submit failed")

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
        session, AuditAction.EXPORT, DocumentType.CREDIT_CARD,
        ip_address=request.client.host if request.client else None,
    )
    csv_path = await ocr_service.export_tasks_to_csv(db)
    filename = csv_path.replace("\\", "/").split("/")[-1]
    return FileResponse(
        path=csv_path,
        media_type="text/csv",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/debug-llm  (debug only)
# ═══════════════════════════════════════════════════

@router.get("/debug-llm")
async def debug_last_llm_response():
    if not settings.app_debug:
        raise HTTPException(status_code=403, detail="Debug mode is disabled")
    import pathlib, tempfile
    p = pathlib.Path(tempfile.gettempdir()) / "last_llm_response.txt"
    if not p.exists():
        return {"raw": "(no response saved yet — process a file first)", "path": str(p)}
    return {"raw": p.read_text(encoding="utf-8"), "path": str(p)}


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/health  — public, no auth
# ═══════════════════════════════════════════════════

@router.get("/health")
async def health_check():
    import httpx

    llm_status = "not_configured"
    llm_error = None

    if settings.openrouter_api_key:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    f"{settings.openrouter_base_url}/models",
                    headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
                )
            if r.status_code == 200:
                llm_status = "ok"
            else:
                llm_status = "error"
                llm_error = f"HTTP {r.status_code}"
        except Exception as exc:
            llm_status = "error"
            llm_error = str(exc)

    healthy = llm_status == "ok"
    body = {
        "status": "healthy" if healthy else "degraded",
        "openrouter": llm_status,
        "ocr_engine": settings.ocr_engine,
        "openrouter_ocr_model": settings.openrouter_ocr_model,
        "openrouter_suggestion_model": settings.openrouter_suggestion_model,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if llm_error:
        body["openrouter_error"] = llm_error

    return JSONResponse(status_code=200 if healthy else 503, content=body)
