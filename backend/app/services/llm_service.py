"""
OpenRouter Vision OCR Service.

Sends an image to a multimodal LLM via OpenRouter for simultaneous OCR +
structured data extraction in a single API call.
"""

import base64
import json
import logging
import os
import pathlib
import stat
import tempfile
from typing import Optional, Tuple

from app.config import settings
from app.constants import Module
from app.llm.client import call_vision_llm, _strip_code_fences
from app.llm.prompts import get_ocr_prompt
from app.models import ExtractedCreditCardData

logger = logging.getLogger(__name__)

_CARD_FIELDS = set(ExtractedCreditCardData.model_fields.keys())


def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(ext, "image/png")


async def extract_from_image(
    image_bytes: bytes,
    filename:    str = "receipt.png",
    bank_code:   Optional[str] = None,
    hints:       Optional[dict] = None,
    task_id:     Optional[str] = None,
    # Legacy alias
    bank_type:   Optional[str] = None,
) -> Tuple[str, ExtractedCreditCardData]:
    """
    Send an image to OpenRouter vision LLM and return (raw_text, ExtractedCreditCardData).
    bank_code: 'BBL' | 'KBANK' | 'SCB' — selects bank-specific prompt.
    hints: correction hints from correction_feedback (appended to prompt).
    """
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    effective_bank = bank_code or bank_type
    prompt = get_ocr_prompt(effective_bank, hints=hints)
    mime_type = _get_mime_type(filename)
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    logger.info("Calling OpenRouter model=%s bank=%s", settings.openrouter_ocr_model, effective_bank or "generic")

    result_text = await call_vision_llm(
        system_prompt=prompt,
        user_content=[
            {"type": "image_url", "image_url": {"url": data_url}},
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
        image_size_bytes=len(image_bytes),
    )

    if not result_text:
        raise ValueError("LLM returned empty string from vision model")


    if settings.app_debug:
        tmp = pathlib.Path(tempfile.gettempdir()) / "last_llm_response.txt"
        tmp.write_text(result_text, encoding="utf-8")
        try:
            tmp.chmod(stat.S_IRUSR | stat.S_IWUSR)
        except Exception:
            pass

    result_text = _strip_code_fences(result_text)
    data: dict = json.loads(result_text)

    raw_text: str = data.pop("raw_text", "") or ""

    extracted = ExtractedCreditCardData(**{k: v for k, v in data.items() if k in _CARD_FIELDS})
    extracted.raw_text = raw_text

    def _is_zero(v: Optional[str]) -> bool:
        if v is None:
            return True
        try:
            return float(v.replace(",", "")) == 0
        except ValueError:
            return False

    extracted.details = [r for r in extracted.details if not _is_zero(r.pay_amt)]

    n_details = len(extracted.details)
    total_sample = extracted.details[0].total if n_details else "—"

    return raw_text, extracted
