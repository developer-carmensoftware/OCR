"""
OCR Service — stateless extraction + task listing/export helpers.
"""

import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.config import settings
from app.context import current_tenant_id, current_business_unit_id
from app.models.orm import OCRTask, CreditCard, CreditCardTransaction, TaskStatus
from app.models.schemas import ExtractedCreditCardData
from app.utils.image_processing import preprocess_image
from app.services.llm_service import extract_from_image

logger = logging.getLogger(__name__)


async def create_task(
    db: AsyncSession,
    *,
    tenant_id: str,
    business_unit_id: str,
    module_id: str,
    original_filename: str,
    carmen_user_id: Optional[str] = None,
) -> OCRTask:
    """Create, persist, and return a completed OCRTask. Shared by OCR and AP invoice routers."""
    task = OCRTask(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        business_unit_id=business_unit_id,
        module_id=module_id,
        original_filename=original_filename,
        status=TaskStatus.COMPLETED,
        ocr_engine=settings.ocr_engine,
        carmen_user_id=carmen_user_id or None,
    )
    db.add(task)
    await db.commit()
    return task


async def extract_stateless(
    file_bytes: bytes,
    original_filename: str,
    bank_code: Optional[str] = None,
    hints: Optional[dict] = None,
    task_id: Optional[str] = None,
) -> ExtractedCreditCardData:
    """
    Stateless OCR extraction: resize → Vision LLM → return structured data.
    Does NOT write to DB.
    bank_code: 'BBL' | 'KBANK' | 'SCB' — selects bank-specific prompt.
    hints: correction hints from correction_service (injected into prompt).
    """
    ext = os.path.splitext(original_filename)[1].lower()
    if ext == ".pdf":
        processed_bytes = file_bytes
    else:
        processed_bytes = preprocess_image(
            file_bytes,
            grayscale=False,
            contrast_factor=1.0,
            sharpness_factor=1.0,
            denoise=False,
        )

    logger.info("Extracting: %s (bank=%s hints=%d)",
                original_filename, bank_code, len(hints) if hints else 0)
    _, extracted = await extract_from_image(
        processed_bytes, original_filename, bank_code, hints=hints, task_id=task_id
    )
    return extracted


async def get_all_tasks(
    db: AsyncSession,
    status: Optional[TaskStatus] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[OCRTask], int]:
    tenant_id        = current_tenant_id.get()
    business_unit_id = current_business_unit_id.get()

    query = select(OCRTask).where(OCRTask.deleted_at.is_(None))
    count_q = select(func.count()).select_from(OCRTask).where(OCRTask.deleted_at.is_(None))

    if tenant_id:
        query   = query.where(OCRTask.tenant_id == tenant_id)
        count_q = count_q.where(OCRTask.tenant_id == tenant_id)
    if business_unit_id:
        query   = query.where(OCRTask.business_unit_id == business_unit_id)
        count_q = count_q.where(OCRTask.business_unit_id == business_unit_id)
    if status:
        query   = query.where(OCRTask.status == status)
        count_q = count_q.where(OCRTask.status == status)

    total = (await db.execute(count_q)).scalar()
    tasks = (await db.execute(query.order_by(desc(OCRTask.created_at)).limit(limit).offset(offset))).scalars().all()
    return list(tasks), total


async def export_tasks_to_csv(db: AsyncSession) -> str:
    """Export submitted credit card documents to CSV."""
    import csv

    tenant_id        = current_tenant_id.get()
    business_unit_id = current_business_unit_id.get()

    query = (
        select(OCRTask, CreditCard)
        .join(CreditCard, CreditCard.task_id == OCRTask.id)
        .where(
            OCRTask.status == TaskStatus.COMPLETED,
            OCRTask.deleted_at.is_(None),
            CreditCard.deleted_at.is_(None),
        )
        .order_by(desc(OCRTask.completed_at))
    )
    if tenant_id:
        query = query.where(OCRTask.tenant_id == tenant_id)
    if business_unit_id:
        query = query.where(OCRTask.business_unit_id == business_unit_id)

    rows = (await db.execute(query)).all()

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    csv_path  = os.path.join(settings.export_dir, f"ocr_export_{timestamp}.csv")

    headers = [
        "Date Processed", "Bank Code", "Company Name",
        "Merchant Name", "Doc Date", "Doc No",
        "Tx Date", "Description", "Amount", "Type",
    ]

    written = 0
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for task, card in rows:
            # Fetch transactions via separate query (relationship not loaded here)
            tx_result = await db.execute(
                select(CreditCardTransaction)
                .where(CreditCardTransaction.credit_card_id == card.id,
                       CreditCardTransaction.deleted_at.is_(None))
                .order_by(CreditCardTransaction.sort_order)
            )
            transactions = tx_result.scalars().all()
            if not transactions:
                writer.writerow([
                    task.completed_at.strftime("%Y-%m-%d %H:%M:%S") if task.completed_at else "",
                    card.bank_code or "", card.company_name or "",
                    "", card.doc_date or "", card.doc_no or "",
                    "", "", "", "",
                ])
                written += 1
            else:
                for tx in transactions:
                    writer.writerow([
                        task.completed_at.strftime("%Y-%m-%d %H:%M:%S") if task.completed_at else "",
                        card.bank_code or "", card.company_name or "",
                        tx.description or "", card.doc_date or "", card.doc_no or "",
                        tx.tx_date or "", tx.description or "",
                        float(tx.amount) if tx.amount else "", tx.tx_type or "",
                    ])
                    written += 1

    logger.info("Exported %d rows to %s", written, csv_path)
    return csv_path
