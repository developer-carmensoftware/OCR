"""
Unit tests for the fee-invoice clamp in credit_card_service — deterministic
enforcement of total="0" (and blank merchant_id) that the LAYOUT prompts only
request of the LLM.
"""

from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow
from app.services.credit_card_service import _clamp_fee_invoice


def _extracted(total: str, merchant_id: str | None = "M-123") -> ExtractedCreditCardData:
    return ExtractedCreditCardData(
        merchant_id=merchant_id,
        details=[ExtractedDetailRow(transaction="MDR fee", pay_amt="4,716.31", total=total)],
    )


def test_clamps_stray_total_to_zero():
    ext = _extracted(total="4,716.31")
    _clamp_fee_invoice(ext, "KTC")
    assert ext.details[0].total == "0"
    assert ext.merchant_id is None


def test_paypal_keeps_customer_id_as_merchant_id():
    ext = _extracted(total="370.47", merchant_id="8C45WPKBSFA86")
    _clamp_fee_invoice(ext, "PAYPAL")
    assert ext.details[0].total == "0"
    assert ext.merchant_id == "8C45WPKBSFA86"
