"""
OCR API Routes — thin HTTP layer.

Business logic lives in:
  app/tools/submit.py        — receipt persistence
  app/services/ocr_service.py — task/export helpers
"""

import asyncio
import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import SessionInfo, get_current_session
from app.config import settings
from app.constants import Module
from app.context import current_document_ref
from app.database import async_session, get_db
from app.models import CreditCard, ExtractedCreditCardData, OCRTask, TaskStatus
from app.services import audit_service, ocr_service
from app.services.audit_service import AuditAction
from app.services.correction_service import get_correction_hints
from app.services.file_service import file_service
from app.services.ocr_service import create_task
from app.services.usage_service import check_quota
from app.tools import submit as submit_tool
from app.tools.submit import SubmitInput
from app.utils.date_parsing import format_doc_date
from app.utils.db_helpers import has_submitted_doc

# ── Submit payload schemas ────────────────────────────────────────────────────


class SubmitDetailItem(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    Transaction: str | None = Field(None, alias="transaction")
    Date: str | None = Field(None, alias="date")
    Amount: str | None = Field(None, alias="amount")
    Type: str | None = Field(None, alias="type")


class SubmitHeader(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    BankCode: str | None = Field(None, alias="bank_code")
    CompanyName: str | None = Field(None, alias="company_name")
    BankCompanyName: str | None = Field(None, alias="bank_company_name")
    DocDate: str | None = Field(None, alias="doc_date")
    DocNo: str | None = Field(None, alias="doc_no")
    BranchNo: str | None = Field(None, alias="branch_no")
    # Legacy frontend fields — still accepted, not persisted
    BankName: str | None = Field(None, alias="bank_name")
    DocName: str | None = Field(None, alias="doc_name")
    MerchantName: str | None = Field(None, alias="merchant_name")


class SubmitPayload(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    BankCode: str | None = Field(None, alias="bank_code")
    BankType: str | None = Field(None, alias="bank_type")  # legacy alias
    OriginalFilename: str | None = Field(None, alias="original_filename")
    Header: SubmitHeader
    Details: list[SubmitDetailItem] = []


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ocr", tags=["OCR"])


def _task_to_dict(task: OCRTask) -> dict:
    return {
        "id": task.id,
        "original_filename": task.original_filename,
        "module_id": task.module_id,
        "status": task.status.value if hasattr(task.status, "value") else task.status,
        "ocr_engine": task.ocr_engine,
        "error_message": task.error_message,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/extract
# ═══════════════════════════════════════════════════


@router.post("/extract", response_model=list[ExtractedCreditCardData])
async def extract_card(
    request: Request,
    files: list[UploadFile] = File(...),
    bank_code: str | None = Query(None, description="Bank code: BBL / KBANK / SCB"),
    session: SessionInfo = Depends(get_current_session),
):
    """Stateless extraction — reads files, calls LLM, returns JSON. Does NOT write to DB.

    DB sessions are scoped tightly (Phase 2 + correction hints + Phase 4) so that
    no connection from the pool is held during the long-running LLM call in Phase 3.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    filenames = file_service.get_filenames_string(files)
    current_document_ref.set(filenames)
    await audit_service.log_action(
        session,
        AuditAction.EXTRACT,
        resource="credit_card",
        resource_id=filenames,
        ip_address=request.client.host if request.client else None,
    )

    await check_quota()

    # Phase 1: validate + read all files into memory (no DB held)
    file_data: list[tuple[str, bytes]] = []
    for upload_file in files:
        filename = upload_file.filename or "upload"
        file_bytes = await file_service.validate_and_read(upload_file)
        file_data.append((filename, file_bytes))

    # Phase 2: short-lived DB session — fetch hints + create task rows, then release.
    task_records: list[tuple[str, bytes, str]] = []
    async with async_session() as db:
        hints = await get_correction_hints(bank_code, db) if bank_code else {}
        for filename, file_bytes in file_data:
            task = await create_task(
                db,
                tenant_id=session.tenant_id,
                business_unit_id=session.business_unit_id,
                module_id=Module.CREDIT_CARD_OCR,
                original_filename=filename,
                carmen_user_id=session.carmen_user_id,
            )
            task_records.append((filename, file_bytes, str(task.id)))

    # Phase 3: parallel LLM extraction — the bottleneck (2-10s per file).
    # No DB connection is held during this phase.
    extractions: list[ExtractedCreditCardData] = list(
        await asyncio.gather(
            *[
                ocr_service.extract_stateless(
                    file_bytes=file_bytes,
                    original_filename=filename,
                    bank_code=bank_code,
                    hints=hints or None,
                    task_id=task_id,
                )
                for filename, file_bytes, task_id in task_records
            ]
        )
    )

    # Phase 4: short-lived DB session — duplicate checks.
    results: list[ExtractedCreditCardData] = []
    async with async_session() as db:
        for extracted in extractions:
            if extracted.doc_no:
                extracted.is_duplicate = await has_submitted_doc(
                    db,
                    CreditCard,
                    tenant_id=session.tenant_id,
                    business_unit_id=session.business_unit_id,
                    doc_no=extracted.doc_no,
                )
            results.append(extracted)

    return results


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks
# ═══════════════════════════════════════════════════


@router.get("/tasks")
async def list_tasks(
    status: TaskStatus | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    tasks, total = await ocr_service.get_all_tasks(db, status=status, limit=limit, offset=offset)
    return JSONResponse(content={"total": total, "tasks": [_task_to_dict(t) for t in tasks]})


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
        .where(
            OCRTask.id == task_id,
            OCRTask.tenant_id == session.tenant_id,
            OCRTask.deleted_at.is_(None),
        )
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

    card = task.credit_card
    card_data = None
    if card:
        from app.models.orm import CreditCardTransaction

        tx_result = await db.execute(
            select(CreditCardTransaction)
            .where(
                CreditCardTransaction.credit_card_id == card.id,
                CreditCardTransaction.deleted_at.is_(None),
            )
            .order_by(CreditCardTransaction.sort_order)
        )
        card_data = {
            "id": card.id,
            "task_id": card.task_id,
            "bank_code": card.bank_code,
            "company_name": card.company_name,
            "bank_company_name": card.bank_company_name,
            "doc_date": format_doc_date(card.doc_date),
            "doc_no": card.doc_no,
            "branch_no": card.branch_no,
            "submitted_at": card.submitted_at.isoformat() if card.submitted_at else None,
            "created_at": card.created_at.isoformat() if card.created_at else None,
            "transactions": [
                {
                    "tx_date": format_doc_date(t.tx_date),  # type: ignore
                    "description": t.description,
                    "amount": float(t.amount) if t.amount else None,  # type: ignore
                    "tx_type": t.tx_type,
                }
                for t in tx_result.scalars().all()
            ],
        }

    return JSONResponse(content={**_task_to_dict(task), "credit_card": card_data})


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
        session,
        AuditAction.SUBMIT,
        resource="credit_card",
        resource_id=doc_ref,
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
            {"transaction": d.Transaction, "date": d.Date, "amount": d.Amount, "type": d.Type}
            for d in payload.Details
        ],
    )

    result = await submit_tool.run(inp, db)

    if not result.success:
        err = result.errors[0] if result.errors else "Submit failed"
        status_code = 409 if (result.output or {}).get("error") == "DUPLICATE_DOC_NO" else 500
        raise HTTPException(status_code=status_code, detail=err)

    return {"ok": True, **result.output}


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
            llm_status = "ok" if r.status_code == 200 else "error"
            if r.status_code != 200:
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
        "timestamp": datetime.now(UTC).isoformat(),
    }
    if llm_error:
        body["openrouter_error"] = llm_error
    return JSONResponse(status_code=200 if healthy else 503, content=body)


@router.get("/debug-llm")
async def debug_last_llm_response():
    if not settings.app_debug:
        raise HTTPException(status_code=403, detail="Debug mode is disabled")
    import pathlib
    import tempfile

    p = pathlib.Path(tempfile.gettempdir()) / "last_llm_response.txt"
    if not p.exists():
        return {"raw": "(no response saved yet)", "path": str(p)}
    return {"raw": p.read_text(encoding="utf-8"), "path": str(p)}
