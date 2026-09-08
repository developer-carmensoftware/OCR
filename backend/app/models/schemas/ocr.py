import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.models.enums import FieldName, TaskStatus
from app.utils.bank_detect import BANK_CODES
from app.utils.date_parsing import format_doc_date

# ── Credit Card ───────────────────────────────────────────────────────────────


class CreditCardTransactionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tx_date: date | None = None
    description: str | None = None
    amount: float | None = None
    tx_type: str | None = None
    sort_order: int = 0

    @field_serializer("tx_date")
    def _serialize_tx_date(self, v: date | None) -> str | None:
        return format_doc_date(v)


class CreditCardSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    task_id: str
    bank_code: str | None = None
    company_name: str | None = None
    bank_company_name: str | None = None
    doc_date: date | None = None
    doc_no: str | None = None
    branch_no: str | None = None
    submitted_at: datetime | None = None
    created_at: datetime | None = None
    transactions: list[CreditCardTransactionSchema] = Field(default_factory=list)

    @field_serializer("doc_date")
    def _serialize_doc_date(self, v: date | None) -> str | None:
        return format_doc_date(v)


# ── OCR Task ──────────────────────────────────────────────────────────────────


class OCRTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    status: TaskStatus
    module_id: str | None = None
    ocr_engine: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None
    credit_card: CreditCardSchema | None = None


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


class ExtractionWarning(BaseModel):
    """Something the reviewer should check, named rather than narrated.

    The normalizers used to compose the sentence here, which made every warning banner
    English on two screens that are otherwise bilingual — this process cannot know who is
    reading. So the finding travels as a code plus the numbers it needs, and the UI writes
    the sentence in the reader's language (`warningText` in `lib/reviewReasons.ts`).

    **A bare string still validates**, becoming `legacy` with the text in `params`. Two
    reasons it has to: `review_payload` holds the extraction of every document already
    waiting in a queue, and `approve_document` re-validates it — a parked document must not
    become unapprovable because the shape moved underneath it.
    """

    code: str
    params: dict[str, str] = Field(default_factory=dict)

    @field_validator("params", mode="before")
    @classmethod
    def _stringify(cls, v):
        """Numbers arrive formatted for reading (`"1,234.56"`), but a caller passing a float
        should not silently produce `{"gap": 10.0}` that the UI prints as `10`."""
        return {k: str(x) for k, x in (v or {}).items()}


def as_warning(value: "ExtractionWarning | dict | str") -> "ExtractionWarning":
    if isinstance(value, ExtractionWarning):
        return value
    if isinstance(value, str):
        return ExtractionWarning(code="legacy", params={"text": value})
    return ExtractionWarning.model_validate(value)


class ExtractedCreditCardData(BaseModel):
    id: str | None = Field(None, description="Credit card record ID (Draft)")
    task_id: str | None = Field(None, description="Task ID associated with this extraction")
    bank_code: str | None = Field(
        None,
        description=(
            "Which BANK REFERENCE entry the model says issued this document. A claim, "
            "not the resolved bank — detect_bank_code() takes it as tier 0."
        ),
    )
    bank_name: str | None = Field(None, description="Bank name")
    doc_name: str | None = Field(None, description="Document type")
    company_name: str | None = Field(None, description="Company name")
    doc_date: str | None = Field(None, description="Document date")
    doc_no: str | None = Field(None, description="Document number")
    merchant_name: str | None = Field(None, description="Merchant name")
    merchant_id: str | None = Field(None, description="Merchant ID")
    bank_company_name: str | None = Field(None, description="Bank company name")
    branch_no: str | None = Field(None, description="Branch number")
    tax_ids: list[str] = Field(
        default_factory=list,
        description=(
            "Every 13-digit tax ID printed on the document (issuer's and merchant's). "
            "Email automation checks the BU's registered tax ID against this list before "
            "posting — see CARMEN_INTEGRATION.md §2.4."
        ),
    )
    details: list[ExtractedDetailRow] = Field(default_factory=list)
    is_duplicate: bool = Field(False)
    raw_text: str | None = Field(None)
    warnings: list[ExtractionWarning] = Field(
        default_factory=list,
        description="User-facing extraction findings, as codes the UI renders in its language",
    )

    @field_validator("warnings", mode="before")
    @classmethod
    def _accept_legacy_warnings(cls, v):
        """A queue full of documents parked before this shape existed still has to open."""
        return [as_warning(w) for w in (v or [])]

    @field_validator("bank_code", mode="before")
    @classmethod
    def _known_bank_only(cls, v):
        """LLM output is untrusted: keep the code only if it is one we actually support.
        "KASIKORN", "Bangkok Bank" and "" all become None and fall through to keywords."""
        code = str(v or "").strip().upper()
        return code if code in BANK_CODES else None

    @field_validator("tax_ids", mode="before")
    @classmethod
    def _coerce_tax_ids(cls, v):
        """LLM output is untrusted — null, a bare string or junk must not fail the
        whole extraction. Keep only well-formed 13-digit numbers, de-duplicated."""
        if isinstance(v, str):
            v = [v]
        if not isinstance(v, list):
            return []
        out: list[str] = []
        for item in v:
            digits = re.sub(r"\D", "", str(item or ""))
            if len(digits) == 13 and digits not in out:
                out.append(digits)
        return out


# ── Correction Feedback ───────────────────────────────────────────────────────


class CorrectionFeedbackRequest(BaseModel):
    doc_no: str
    bank_code: str
    field_name: FieldName
    original_value: str | None = Field(None, max_length=2000)
    corrected_value: str | None = Field(None, max_length=2000)


class CorrectionFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    skipped: bool = False
    doc_no: str
    bank_code: str
    field_name: str
    original_value: str | None = None
    corrected_value: str | None = None
    created_at: datetime | None = None


class CorrectionFeedbackBatchRequest(BaseModel):
    corrections: list[CorrectionFeedbackRequest]


class CorrectionFeedbackBatchResponse(BaseModel):
    saved: int
    skipped: int


# ── Bug Report ────────────────────────────────────────────────────────────────

_MAX_SCREENSHOT_B64_LEN = 1_400_000  # ~1 MB binary → ~1.37 MB base64


class BugReportRequest(BaseModel):
    module: str = Field(..., max_length=50)
    category: str = Field(..., max_length=32)
    description: str = Field(..., min_length=1, max_length=5000)
    screenshot_b64: str | None = Field(None, max_length=_MAX_SCREENSHOT_B64_LEN)
    screenshot_mime: str | None = Field(None, max_length=16)


class BugReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    module_id: str
    category: str
    status: str
    created_at: datetime | None = None
