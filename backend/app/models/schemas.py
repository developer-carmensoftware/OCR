from datetime import datetime

from pydantic import BaseModel, Field

from .enums import FieldName, TaskStatus

# ── Credit Card ───────────────────────────────────────────────────────────────


class CreditCardTransactionSchema(BaseModel):
    id: str
    tx_date: str | None = None
    description: str | None = None
    amount: float | None = None
    tx_type: str | None = None
    sort_order: int = 0

    class Config:
        from_attributes = True


class CreditCardSchema(BaseModel):
    id: str
    task_id: str
    bank_code: str | None = None
    company_name: str | None = None
    bank_company_name: str | None = None
    doc_date: str | None = None
    doc_no: str | None = None
    branch_no: str | None = None
    submitted_at: datetime | None = None
    created_at: datetime | None = None
    transactions: list[CreditCardTransactionSchema] = []

    class Config:
        from_attributes = True


# ── OCR Task ──────────────────────────────────────────────────────────────────


class OCRTaskResponse(BaseModel):
    id: str
    original_filename: str
    status: TaskStatus
    module_id: str | None = None
    ocr_engine: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None
    credit_card: CreditCardSchema | None = None

    class Config:
        from_attributes = True


class OCRTaskListResponse(BaseModel):
    total: int
    tasks: list[OCRTaskResponse]


class OCRUploadResponse(BaseModel):
    message: str
    task_ids: list[str]
    total_files: int


# ── Extraction (LLM output — not DB schema) ───────────────────────────────────


class ExtractedDetailRow(BaseModel):
    transaction: str | None = None
    pay_amt: str | None = None
    commis_amt: str | None = None
    tax_amt: str | None = None
    total: str | None = None


class ExtractedCreditCardData(BaseModel):
    bank_name: str | None = Field(None, description="ชื่อธนาคาร")
    doc_name: str | None = Field(None, description="ประเภทเอกสาร")
    company_name: str | None = Field(None, description="ชื่อบริษัท")
    doc_date: str | None = Field(None, description="วันที่เอกสาร")
    doc_no: str | None = Field(None, description="เลขที่เอกสาร")
    merchant_name: str | None = Field(None, description="ชื่อร้านค้า")
    merchant_id: str | None = Field(None, description="หมายเลขร้านค้า")
    bank_companyname: str | None = Field(None, description="ชื่อนิติบุคคลของธนาคาร")
    branch_no: str | None = Field(None, description="รหัสสาขา")
    details: list[ExtractedDetailRow] = Field(default_factory=list)
    is_duplicate: bool = Field(False)
    raw_text: str | None = Field(None)


# ── Correction Feedback ───────────────────────────────────────────────────────


class CorrectionFeedbackRequest(BaseModel):
    doc_no: str
    bank_code: str
    field_name: FieldName
    original_value: str | None = Field(None, max_length=2000)
    corrected_value: str | None = Field(None, max_length=2000)


class CorrectionFeedbackResponse(BaseModel):
    id: int
    skipped: bool = False
    doc_no: str
    bank_code: str
    field_name: str
    original_value: str | None = None
    corrected_value: str | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class CorrectionFeedbackBatchRequest(BaseModel):
    corrections: list[CorrectionFeedbackRequest]


class CorrectionFeedbackBatchResponse(BaseModel):
    saved: int
    skipped: int
