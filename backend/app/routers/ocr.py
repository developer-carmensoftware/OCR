"""
OCR API Routes — thin HTTP layer.

Business logic lives in:
  app/services/ocr_service.py          — stateless extract + task listing
  app/services/credit_card_service.py  — finalize_extraction / mark_task_failed
  app/services/task_service.py         — shared OCRTask creation
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import SessionInfo, get_current_session
from app.constants import Module
from app.context import current_document_ref
from app.database import async_session, get_db
from app.models import ExtractedCreditCardData, OCRTask, TaskStatus
from app.services import audit_service, ocr_service
from app.services.audit_service import AuditAction
from app.services.correction_service import get_correction_hints
from app.services.credit_card_service import finalize_extraction, mark_task_failed
from app.services.credit_service import consume_document, refund_document
from app.services.file_service import file_service
from app.services.quota_service import assert_module_enabled
from app.services.task_service import create_task
from app.utils.client_ip import get_client_ip
from app.utils.date_parsing import format_doc_date
from app.utils.pdf_utils import ensure_pdf_openable

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/credit-card", tags=["Credit Card OCR"])

# Hard cap on files per extract request. Each file is read fully into memory,
# gets its own vision-LLM call, and consumes its own document credit — so an
# unbounded batch is both an OOM vector (N×20 MB on a small instance) and a
# billing surprise. Beta batches are small; raise if a real use case needs more.
MAX_FILES_PER_EXTRACT = 10


def _task_to_dict(task: OCRTask) -> dict:
    return {
        "id": str(task.id),
        "original_filename": task.original_filename,
        "module_id": task.module_id,
        "status": task.status.value if hasattr(task.status, "value") else task.status,
        "ocr_engine": task.ocr_engine,
        "error_message": task.error_message,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


# ═══════════════════════════════════════════════════
# POST /api/v1/credit-card/extract
# ═══════════════════════════════════════════════════


@router.post("/extract", response_model=list[ExtractedCreditCardData])
async def extract_card(
    request: Request,
    files: list[UploadFile] = File(...),
    bank_code: str | None = Query(
        None, description="Bank code: BBL / KBANK / SCB / BAY / KTC / GHL / PAYPAL / SIAMPAY"
    ),
    pdf_password: str | None = Form(None, description="Password for an encrypted PDF"),
    session: SessionInfo = Depends(get_current_session),
):
    """Stateless extraction — reads files, calls LLM, returns JSON. Does NOT write to DB.

    DB sessions are scoped tightly (Phase 2 + correction hints + Phase 4) so that
    no connection from the pool is held during the long-running LLM call in Phase 3.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > MAX_FILES_PER_EXTRACT:
        raise HTTPException(
            status_code=422,
            detail=f"Too many files: {len(files)} (max {MAX_FILES_PER_EXTRACT} per request)",
        )

    filenames = file_service.get_filenames_string(files)
    current_document_ref.set(filenames)
    await audit_service.log_action(
        session,
        AuditAction.EXTRACT,
        resource="credit_card",
        resource_id=filenames,
        ip_address=get_client_ip(request),
    )

    # Phase 1: validate + read all files into memory (no DB / credit held). PDFs are
    # opened here so an encrypted/corrupt PDF fails BEFORE consume_document() — a
    # locked file must not burn a document credit (see app/exceptions.py mapping).
    file_data: list[tuple[str, bytes]] = []
    for upload_file in files:
        file_bytes, effective_name = await file_service.validate_and_read(upload_file)
        await ensure_pdf_openable(file_bytes, effective_name, pdf_password)
        file_data.append((effective_name, file_bytes))

    # Access gate before any charge: if an admin disabled this module for the tenant,
    # 403 here so no credit is consumed (same pre-charge placement as the PDF check).
    await assert_module_enabled(Module.CREDIT_CARD_OCR)

    # Charge one document credit per file — each file gets its own extraction and
    # LLM call, so a 30-file batch must cost 30, not 1. The whole batch draws from a
    # single credit tier (no cross-tier splitting); refund_document reverses per file.
    charged = await consume_document(increment=len(file_data))

    # Phase 2: short-lived DB session — fetch hints + create task rows, then release.
    # If this fails, nothing succeeded yet → always refund.
    try:
        task_records: list[tuple[str, bytes, str]] = []
        async with async_session() as db:
            hints = await get_correction_hints(bank_code, db) if bank_code else {}
            for filename, file_bytes in file_data:
                task = await create_task(
                    db,
                    tenant_id=session.tenant_id,
                    module_id=Module.CREDIT_CARD_OCR,
                    original_filename=filename,
                    carmen_user_id=session.carmen_user_id,
                )
                task_records.append((filename, file_bytes, str(task.id)))
    except Exception:
        await refund_document(charged)
        raise

    # Phase 3 & 4: process each file in parallel with task status tracking.
    # Use return_exceptions so partial success is visible — refund only when
    # every file failed (partial success = user got value, credit is earned).
    async def process_single_task(
        filename: str, file_bytes: bytes, task_id: str
    ) -> ExtractedCreditCardData:
        try:
            extracted = await ocr_service.extract_stateless(
                file_bytes=file_bytes,
                original_filename=filename,
                bank_code=bank_code,
                hints=hints or None,
                task_id=task_id,
                pdf_password=pdf_password,
            )
            extracted.task_id = task_id
            return await finalize_extraction(
                extracted, task_id, session.tenant_id, bank_code, session.carmen_user_id
            )
        except Exception as exc:
            await mark_task_failed(task_id, exc)
            raise

    raw = await asyncio.gather(
        *[
            process_single_task(filename, file_bytes, task_id)
            for filename, file_bytes, task_id in task_records
        ],
        return_exceptions=True,
    )
    errors = [r for r in raw if isinstance(r, BaseException)]
    if errors:
        # Refund exactly the files that failed (each was charged its own credit),
        # then surface the first error. Files that extracted successfully keep their
        # charge — the user got value from them.
        await refund_document(charged, increment=len(errors))
        raise errors[0]

    return [r for r in raw if not isinstance(r, BaseException)]


# ═══════════════════════════════════════════════════
# GET /api/v1/credit-card/tasks
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
# GET /api/v1/credit-card/tasks/{task_id}
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
        card_data = {
            "id": str(card.id),
            "task_id": str(card.task_id),
            "bank_code": card.bank_code,
            "company_name": card.company_name,
            "bank_company_name": card.bank_company_name,
            "doc_date": format_doc_date(card.doc_date),
            "doc_no": card.doc_no,
            "branch_no": card.branch_no,
            "submitted_at": card.submitted_at.isoformat() if card.submitted_at else None,
            "created_at": card.created_at.isoformat() if card.created_at else None,
        }

    return JSONResponse(content={**_task_to_dict(task), "credit_card": card_data})
