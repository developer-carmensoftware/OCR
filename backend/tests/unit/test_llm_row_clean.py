"""
Unit tests for the post-LLM row cleaner in llm_service.

Regression: this bank-blind filter runs BEFORE the bank-aware normalizer and
used to drop every fee-invoice line row (pay_amt is null by design there),
leaving details=[] — a blank Details table in the wizard.
"""

from app.models.schemas.ocr import ExtractedDetailRow
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
