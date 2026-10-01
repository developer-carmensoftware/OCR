"""extract_stateless — the deterministic KBANK settlement reader's hook (ticket 08).

Real, tiny PDFs built in memory rather than mocking `get_pdf_page_count`/
`extract_pages_as_pdf`: those two are the actual page-selection contract this test
exists to leave alone, so faking them would test nothing.
"""

from unittest.mock import AsyncMock, patch

import fitz
import pytest

from app.constants import DocType
from app.models.schemas import ExtractedCreditCardData
from app.services.credit_card import ocr as ocr_service


def _pdf() -> bytes:
    doc = fitz.open()
    doc.new_page()
    buf = doc.tobytes()
    doc.close()
    return buf


def _extracted(**over) -> ExtractedCreditCardData:
    defaults = dict(doc_no="X", raw_text="")
    defaults.update(over)
    return ExtractedCreditCardData(**defaults)


@pytest.mark.asyncio
async def test_a_readable_kbank_settlement_skips_the_vision_call_entirely():
    deterministic = _extracted(doc_no="DETERMINISTIC")
    with (
        patch.object(
            ocr_service.kbank_settlement_text, "parse", return_value=deterministic
        ) as parse,
        patch.object(ocr_service, "extract_from_image", AsyncMock()) as vision,
    ):
        result = await ocr_service.extract_stateless(
            file_bytes=_pdf(),
            original_filename="KB1P554V2_SUM_451005282039001_20260721.pdf",
            bank_code="KBANK",
            doc_type=DocType.AR_RECONCILE,
        )

    assert result is deterministic
    parse.assert_called_once()
    vision.assert_not_called()


@pytest.mark.asyncio
async def test_a_shape_mismatch_falls_through_to_vision_unchanged():
    vision_result = _extracted(doc_no="FROM_VISION")
    with (
        patch.object(ocr_service.kbank_settlement_text, "parse", return_value=None),
        patch.object(
            ocr_service, "extract_from_image", AsyncMock(return_value=("raw", vision_result))
        ) as vision,
    ):
        result = await ocr_service.extract_stateless(
            file_bytes=_pdf(),
            original_filename="KB1P554V2_SUM_451005282039001_20260721.pdf",
            bank_code="KBANK",
            doc_type=DocType.AR_RECONCILE,
        )

    assert result is vision_result
    vision.assert_awaited_once()


@pytest.mark.asyncio
async def test_the_deterministic_reader_is_never_tried_outside_kbank_ar_reconcile():
    """Neither an ordinary fee invoice nor a settlement report from another bank ever
    reaches a parser that only knows one bank's one report layout."""
    vision_result = _extracted(doc_no="FROM_VISION")
    for doc_type, bank_code in (
        (DocType.FEE_INVOICE, "KBANK"),
        (DocType.AR_RECONCILE, "SCB"),
        (DocType.FEE_INVOICE, None),
    ):
        with (
            patch.object(ocr_service.kbank_settlement_text, "parse") as parse,
            patch.object(
                ocr_service, "extract_from_image", AsyncMock(return_value=("raw", vision_result))
            ),
        ):
            await ocr_service.extract_stateless(
                file_bytes=_pdf(),
                original_filename="statement.pdf",
                bank_code=bank_code,
                doc_type=doc_type,
            )
        parse.assert_not_called()
