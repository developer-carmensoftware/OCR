"""
Unit tests for the post-LLM row cleaner in llm_service.

Regression: this bank-blind filter runs BEFORE the bank-aware normalizer and
used to drop every fee-invoice line row (pay_amt is null by design there),
leaving details=[] — a blank Details table in the wizard.
"""

import json

import pytest

from app.models.schemas.ocr import ExtractedDetailRow
from app.services import llm_service
from app.services.llm_service import _clean_llm_rows


def _rows(*specs) -> list[ExtractedDetailRow]:
    return [ExtractedDetailRow(**s) for s in specs]


def test_fee_invoice_keeps_blank_pay_amt_line_rows():
    # KTC/GHL/PAYPAL/SIAMPAY line rows carry the fee in commis_amt and leave
    # pay_amt null — they MUST survive so the normalizer can spread the footer VAT.
    rows = _rows(
        {"transaction": "MDR", "commis_amt": "4,407.76"},
        {
            "transaction": "TOTAL",
            "pay_amt": "4,716.31",
            "commis_amt": "4,407.76",
            "tax_amt": "308.55",
        },
    )
    kept = _clean_llm_rows(rows, is_fee_invoice=True)
    assert [r.transaction for r in kept] == ["MDR", "TOTAL"]


def test_fee_invoice_still_drops_wht_rows():
    rows = _rows(
        {"transaction": "Processing Fee", "commis_amt": "6,171.52"},
        {"transaction": "ภาษีเงินได้หัก ณ ที่จ่าย", "total": "16.35"},
    )
    kept = _clean_llm_rows(rows, is_fee_invoice=True)
    assert [r.transaction for r in kept] == ["Processing Fee"]


def test_statement_bank_drops_zero_and_blank_pay_amt_rows():
    # BBL/KBANK/SCB filler card types (0.00 / blank gross) must still be dropped.
    rows = _rows(
        {"transaction": "VSA-INT-P", "pay_amt": "12,290.00"},
        {"transaction": "VSA-P", "pay_amt": "0.00"},
        {"transaction": "JCB"},  # blank pay_amt
        {"transaction": "WITHHOLDING TAX", "total": "16.35"},
    )
    kept = _clean_llm_rows(rows, is_fee_invoice=False)
    assert [r.transaction for r in kept] == ["VSA-INT-P"]


def test_statement_bank_keeps_all_nonzero_card_rows():
    rows = _rows(
        {"transaction": "Visa", "pay_amt": "500.00"},
        {"transaction": "Master", "pay_amt": "300.00"},
    )
    kept = _clean_llm_rows(rows, is_fee_invoice=False)
    assert len(kept) == 2


# ── The model's own answer, through the real extract path ─────────────────────
#
# Everything above tests the cleaner directly. These drive `extract_from_image` with a
# monkeypatched vision call, so the whole chain runs for real: parse_vision_json →
# _CARD_FIELDS filter → ExtractedCreditCardData validator → detect_bank_code →
# _clean_llm_rows. If `bank_code` stops surviving any link of it, these fail.

_GHL_FEE_INVOICE = {
    # A fee invoice whose only issuer signal is what the model says it matched: no
    # bank_company_name, no bank_name, a doc title that names nobody. Before tier 0 this
    # document was undetectable, and its line row — pay_amt null by design — was dropped
    # by the bank-blind cleaner, leaving the reviewer a blank Details table.
    "bank_code": "GHL",
    "doc_name": "ใบเสร็จรับเงิน/ใบกำกับภาษี",
    "doc_no": "INV-77",
    "details": [{"transaction": "MDR", "commis_amt": "4,407.76"}],
}


async def _extract(payload: dict):
    async def _reply(*_args, **_kwargs):
        return json.dumps(payload, ensure_ascii=False)

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(llm_service, "call_vision_llm", _reply)
        return await llm_service.extract_from_image(b"\x89PNG\r\n\x1a\n", filename="fee.pdf")


@pytest.mark.asyncio
async def test_model_named_issuer_survives_the_parse_and_spares_fee_rows():
    _, extracted = await _extract(_GHL_FEE_INVOICE)
    assert extracted.bank_code == "GHL"
    assert [r.transaction for r in extracted.details] == ["MDR"]


@pytest.mark.asyncio
async def test_an_issuer_we_do_not_support_is_dropped_not_stored():
    _, extracted = await _extract({**_GHL_FEE_INVOICE, "bank_code": "KASIKORN"})
    assert extracted.bank_code is None
    # And with no issuer signal left, the row cleaner treats it as a statement bank —
    # the blank pay_amt row goes. That is the old behaviour, still correct for a
    # document nothing can identify.
    assert extracted.details == []
