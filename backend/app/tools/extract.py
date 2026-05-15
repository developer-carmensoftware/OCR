"""
Tool: extract_card

Wraps the stateless OCR pipeline:
  preprocess image → Vision LLM → ExtractedCreditCardData

Usage:
    result = await extract.run(file_bytes, filename, bank_type)
    if result.success:
        data = result.output  # ExtractedCreditCardData dict
"""

import logging

from app.services import ocr_service
from app.tools.base import ToolResult

logger = logging.getLogger(__name__)

TOOL_NAME = "extract_card"


async def run(
    file_bytes: bytes,
    filename: str,
    bank_type: str | None = None,
) -> ToolResult:
    """
    Extract structured data from an image/PDF using Vision LLM.

    Args:
        file_bytes: Raw file content
        filename:   Original filename (used to detect mime type)
        bank_type:  "SCB" | "BBL" | "KBANK" — selects bank-specific prompt

    Returns:
        ToolResult with output=ExtractedCreditCardData dict on success
    """
    tool_input = {"filename": filename, "bank_type": bank_type}
    try:
        extracted = await ocr_service.extract_stateless(file_bytes, filename, bank_type)
        return ToolResult(
            success=True,
            tool=TOOL_NAME,
            input=tool_input,
            output=extracted.model_dump(),
            metadata={
                "doc_no": extracted.doc_no,
                "bank_name": extracted.bank_name,
                "detail_rows": len(extracted.details),
            },
        )
    except Exception as exc:
        logger.error(f"[{TOOL_NAME}] failed for {filename}: {exc}", exc_info=True)
        return ToolResult(
            success=False,
            tool=TOOL_NAME,
            input=tool_input,
            errors=[str(exc)],
        )
