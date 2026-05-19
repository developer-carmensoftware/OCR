"""
Tool: submit_card

Persists user-confirmed credit card receipt data to the database.
Creates: OCRTask → CreditCard → CreditCardTransaction (one row per line item).
Duplicate check: (tenant_id, business_unit_id, bank_code, doc_no, submitted_at IS NOT NULL).
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.constants import Module
from app.context import current_business_unit_id, current_carmen_user_id, current_tenant_id
from app.models.orm import CreditCard, CreditCardTransaction, OCRTask, TaskStatus
from app.tools.base import ToolResult
from app.utils.date_parsing import parse_doc_date
from app.utils.db_helpers import has_submitted_doc

logger = logging.getLogger(__name__)

TOOL_NAME = "submit_card"


@dataclass
class SubmitInput:
    bank_code: str | None
    original_filename: str
    doc_no: str | None
    doc_date: str | None
    bank_name: str | None
    company_name: str | None
    merchant_name: str | None
    bank_company_name: str | None = None
    branch_no: str | None = None
    details: list[dict[str, Any]] = field(default_factory=list)


async def run(inp: SubmitInput, db: AsyncSession) -> ToolResult:
    """
    Save confirmed receipt data to DB.
    Returns:
        success=True  → output = {card_id, doc_no, submitted_at}
        success=False + output = {"error": "DUPLICATE_DOC_NO"} → duplicate
    """
    tenant_id = current_tenant_id.get() or ""
    business_unit_id = current_business_unit_id.get() or ""
    carmen_user_id = current_carmen_user_id.get() or None

    tool_input = {"doc_no": inp.doc_no, "bank_code": inp.bank_code}
    try:
        # 1. Duplicate safeguard
        if inp.doc_no and tenant_id:
            if await has_submitted_doc(
                db,
                CreditCard,
                tenant_id=tenant_id,
                business_unit_id=business_unit_id,
                doc_no=inp.doc_no,
            ):
                return ToolResult(
                    success=False,
                    tool=TOOL_NAME,
                    input=tool_input,
                    errors=[f"Document {inp.doc_no} already submitted in this BU"],
                )

        # 2. OCRTask (record-keeping stub)
        task = OCRTask(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            business_unit_id=business_unit_id,
            module_id=Module.CREDIT_CARD_OCR,
            original_filename=inp.original_filename or "uploaded_file",
            status=TaskStatus.COMPLETED,
            ocr_engine=settings.ocr_engine,
            completed_at=datetime.utcnow(),
            carmen_user_id=carmen_user_id,
        )
        db.add(task)
        await db.flush()

        # 3. CreditCard header
        card = CreditCard(
            id=str(uuid.uuid4()),
            task_id=task.id,
            tenant_id=tenant_id,
            business_unit_id=business_unit_id,
            bank_code=inp.bank_code or None,
            company_name=inp.company_name,
            bank_company_name=inp.bank_company_name,
            doc_date=parse_doc_date(inp.doc_date),
            doc_no=inp.doc_no,
            branch_no=inp.branch_no,
            submitted_at=datetime.utcnow(),
            carmen_user_id=carmen_user_id,
        )
        db.add(card)
        await db.flush()

        # 4. CreditCardTransaction rows (replaces JSON blob)
        tx_count = 0
        for idx, item in enumerate(inp.details):
            tx_label = str(item.get("transaction") or "").strip()
            if not tx_label:
                continue
            db.add(
                CreditCardTransaction(
                    id=str(uuid.uuid4()),
                    credit_card_id=card.id,
                    tx_date=parse_doc_date(item.get("date")),
                    description=tx_label,
                    amount=item.get("amount"),
                    tx_type=item.get("type"),
                    sort_order=idx,
                )
            )
            tx_count += 1

        await db.commit()
        logger.info(
            "[%s] saved doc_no=%s card_id=%s tx=%d", TOOL_NAME, inp.doc_no, card.id, tx_count
        )

        return ToolResult(
            success=True,
            tool=TOOL_NAME,
            input=tool_input,
            output={
                "card_id": card.id,
                "doc_no": inp.doc_no,
                "submitted_at": card.submitted_at.isoformat() if card.submitted_at else None,
            },
            metadata={"task_id": task.id, "transaction_count": tx_count},
        )

    except Exception as exc:
        logger.error("[%s] unexpected error: %s", TOOL_NAME, exc, exc_info=True)
        return ToolResult(success=False, tool=TOOL_NAME, input=tool_input, errors=[str(exc)])
