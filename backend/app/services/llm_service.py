"""
OpenRouter Vision OCR Service.

Sends an image to a multimodal LLM via OpenRouter for simultaneous OCR +
structured data extraction in a single API call.
"""

import base64
import json
import logging

from app.config import settings
from app.constants import Module
from app.llm.client import _strip_code_fences, call_vision_llm
from app.llm.prompts import get_ocr_prompt
from app.models import ExtractedCreditCardData
from app.utils import debug_buffer
from app.utils.mime import get_mime_type

logger = logging.getLogger(__name__)

_CARD_FIELDS = set(ExtractedCreditCardData.model_fields.keys())


async def extract_from_image(
    image_bytes: bytes,
    filename: str = "receipt.png",
    bank_code: str | None = None,
    hints: dict | None = None,
    task_id: str | None = None,
    # Legacy alias
    bank_type: str | None = None,
    page_images: list[bytes] | None = None,
) -> tuple[str, ExtractedCreditCardData]:
    """
    Send an image (or multiple PDF pages) to OpenRouter vision LLM.
    Returns (raw_text, ExtractedCreditCardData).
    page_images: pre-rendered PNG bytes per page; if provided, overrides image_bytes
                 for multi-page documents (all pages sent in one LLM call).
    """
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    effective_bank = bank_code or bank_type
    prompt = get_ocr_prompt(effective_bank, hints=hints)

    # Build image content items.
    # page_images: pre-rendered PNG bytes per page (1 or more) — always use them when present.
    # Fallback to image_bytes only when no pre-rendered pages exist (non-PDF or legacy path).
    if page_images:
        image_items = [
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{base64.b64encode(p).decode()}"},
            }
            for p in page_images
        ]
        total_image_bytes = sum(len(p) for p in page_images)
    else:
        mime_type = get_mime_type(filename)
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        image_items = [
            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}}
        ]
        total_image_bytes = len(image_bytes)

    logger.info(
        "Calling OpenRouter model=%s bank=%s pages=%d",
        settings.openrouter_ocr_model,
        effective_bank or "generic",
        len(image_items),
    )

    result_text = await call_vision_llm(
        system_prompt=prompt,
        user_content=[
            *image_items,
            {
                "type": "text",
                "text": (
                    "Extract all detail rows from this document following the system instructions exactly. "
                    "Each merchant number row = one separate object in details[]. "
                    "Output valid JSON only, no explanation."
                ),
            },
        ],
        model=settings.openrouter_ocr_model,
        task_id=task_id,
        module_id=Module.CREDIT_CARD_OCR,
        image_size_bytes=total_image_bytes,
        count_quota=True,
    )

    if not result_text:
        raise ValueError("LLM returned empty string from vision model")

    if settings.app_debug:
        debug_buffer.record(result_text, source="vision_llm")

    result_text = _strip_code_fences(result_text)
    parsed = json.loads(result_text)
    data: dict = parsed[0] if isinstance(parsed, list) else parsed

    raw_text: str = data.pop("raw_text", "") or ""

    extracted = ExtractedCreditCardData(**{k: v for k, v in data.items() if k in _CARD_FIELDS})
    extracted.raw_text = raw_text

    def _is_zero(v: str | None) -> bool:
        if v is None:
            return True
        try:
            return float(v.replace(",", "")) == 0
        except ValueError:
            return False

    _WHT_KEYWORDS = frozenset({"wht", "withholding", "ภาษีเงินได้หัก", "หัก ณ ที่จ่าย", "ภาษีถูกหัก"})

    def _is_wht_row(r) -> bool:
        if not r.transaction:
            return False
        t = r.transaction.lower()
        return any(k in t for k in _WHT_KEYWORDS)

    extracted.details = [
        r for r in extracted.details if not _is_zero(r.pay_amt) and not _is_wht_row(r)
    ]

    return raw_text, extracted
