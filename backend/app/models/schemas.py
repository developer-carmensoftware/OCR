from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from .enums import TaskStatus


# ── Credit Card ───────────────────────────────────────────────────────────────

class CreditCardTransactionSchema(BaseModel):
    id:          str
    tx_date:     Optional[str]   = None
    description: Optional[str]   = None
    amount:      Optional[float] = None
    tx_type:     Optional[str]   = None
    sort_order:  int             = 0

    class Config:
        from_attributes = True


class CreditCardSchema(BaseModel):
    id:                str
    task_id:           str
    bank_code:         Optional[str]      = None
    company_name:      Optional[str]      = None
    bank_company_name: Optional[str]      = None
    doc_date:          Optional[str]      = None
    doc_no:            Optional[str]      = None
    branch_no:         Optional[str]      = None
    submitted_at:      Optional[datetime] = None
    created_at:        Optional[datetime] = None
    transactions:      List[CreditCardTransactionSchema] = []

    class Config:
        from_attributes = True


# ── OCR Task ──────────────────────────────────────────────────────────────────

class OCRTaskResponse(BaseModel):
    id:                str
    original_filename: str
    status:            TaskStatus
    module_id:         Optional[str]      = None
    ocr_engine:        Optional[str]      = None
    error_message:     Optional[str]      = None
    created_at:        Optional[datetime] = None
    completed_at:      Optional[datetime] = None
    credit_card:       Optional[CreditCardSchema] = None

    class Config:
        from_attributes = True


class OCRTaskListResponse(BaseModel):
    total: int
    tasks: List[OCRTaskResponse]


class OCRUploadResponse(BaseModel):
    message:     str
    task_ids:    List[str]
    total_files: int


# ── Extraction (LLM output — not DB schema) ───────────────────────────────────

class ExtractedDetailRow(BaseModel):
    transaction:  Optional[str] = None
    pay_amt:      Optional[str] = None
    commis_amt:   Optional[str] = None
    tax_amt:      Optional[str] = None
    total:        Optional[str] = None


class ExtractedCreditCardData(BaseModel):
    bank_name:        Optional[str] = Field(None, description="ชื่อธนาคาร")
    doc_name:         Optional[str] = Field(None, description="ประเภทเอกสาร")
    company_name:     Optional[str] = Field(None, description="ชื่อบริษัท")
    doc_date:         Optional[str] = Field(None, description="วันที่เอกสาร")
    doc_no:           Optional[str] = Field(None, description="เลขที่เอกสาร")
    merchant_name:    Optional[str] = Field(None, description="ชื่อร้านค้า")
    merchant_id:      Optional[str] = Field(None, description="หมายเลขร้านค้า")
    bank_companyname: Optional[str] = Field(None, description="ชื่อนิติบุคคลของธนาคาร")
    branch_no:        Optional[str] = Field(None, description="รหัสสาขา")
    details:          List[ExtractedDetailRow] = Field(default_factory=list)
    is_duplicate:     bool          = Field(False)
    raw_text:         Optional[str] = Field(None)


# ── Correction Feedback ───────────────────────────────────────────────────────

class CorrectionFeedbackRequest(BaseModel):
    doc_no:          str
    bank_code:       str
    field_name:      str
    original_value:  Optional[str] = None
    corrected_value: Optional[str] = None


class CorrectionFeedbackResponse(BaseModel):
    id:              int
    doc_no:          str
    bank_code:       str
    field_name:      str
    original_value:  Optional[str]      = None
    corrected_value: Optional[str]      = None
    created_at:      Optional[datetime] = None

    class Config:
        from_attributes = True
