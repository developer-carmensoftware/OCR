"""
Unit tests for utils/bank_detect.py — Python port of the frontend
`detectBankFromExtracted`. Keeps backend bank resolution in sync with the
credit-card duplicate key.
"""

from app.utils.bank_detect import detect_bank_code


def test_detects_from_bank_company_name():
    assert detect_bank_code(bank_company_name="ธนาคารกรุงเทพ จำกัด (มหาชน)") == "BBL"
    assert detect_bank_code(bank_company_name="ธนาคารกสิกรไทย จำกัด (มหาชน)") == "KBANK"
    assert detect_bank_code(bank_company_name="ธนาคารไทยพาณิชย์ จำกัด (มหาชน)") == "SCB"


def test_name_signal_checks_company_name_fallback():
    assert detect_bank_code(company_name="บริษัท กสิกร x") == "KBANK"


def test_doc_name_keyword_fallback():
    assert detect_bank_code(doc_name="KASIKORN Statement") == "KBANK"
    assert detect_bank_code(doc_name="Bangkok Bank Slip") == "BBL"
    assert detect_bank_code(doc_name="Siam Commercial Bank") == "SCB"
    assert detect_bank_code(doc_name="ใบนำฝาก") == "SCB"
    assert detect_bank_code(doc_name="ใบสรุปยอดขายบัตรเครดิต") == "SCB"


def test_raw_text_keyword_fallback():
    assert detect_bank_code(raw_text="...ธนาคารกสิกรไทย...") == "KBANK"
    assert detect_bank_code(raw_text="...กรุงเทพ...") == "BBL"
    assert detect_bank_code(raw_text="...ไทยพาณิชย์...") == "SCB"


def test_name_signal_takes_priority_over_raw_text():
    assert detect_bank_code(bank_company_name="ธนาคารกรุงเทพ", raw_text="กสิกร") == "BBL"


def test_returns_none_without_signal():
    assert detect_bank_code() is None
    assert detect_bank_code(company_name="Acme Co", doc_name="Invoice") is None
