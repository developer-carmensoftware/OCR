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


def test_detects_new_commission_formats_from_names():
    assert detect_bank_code(bank_company_name="ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)") == "BAY"
    assert detect_bank_code(bank_name="บริษัท บัตรกรุงไทย จำกัด (มหาชน)") == "KTC"
    assert detect_bank_code(bank_name="GHL") == "GHL"
    assert (
        detect_bank_code(bank_company_name="บริษัท เอ็นทีที เดต้า ดิจิทัล เพย์เม้นท์ (ประเทศไทย) จำกัด") == "GHL"
    )
    assert detect_bank_code(bank_name="PayPal Thailand Limited") == "PAYPAL"
    assert detect_bank_code(bank_name="Asia Pay (Thailand) Limited") == "SIAMPAY"


def test_ktc_wins_over_generic_krung_prefixes():
    # บัตรกรุงไทย must NOT fall through to กรุงเทพ/กรุงศรี checks
    assert detect_bank_code(raw_text="KRUNGTHAI CARD PUBLIC COMPANY LIMITED") == "KTC"
    assert detect_bank_code(bank_company_name="บริษัท บัตรกรุงไทย จำกัด (มหาชน)") == "KTC"


def test_new_formats_raw_text_fallback():
    assert detect_bank_code(raw_text="...ธนาคารกรุงศรีอยุธยา...") == "BAY"
    assert detect_bank_code(raw_text="...NTT DATA Digital Payment...") == "GHL"
    assert detect_bank_code(raw_text="...paypal.com...") == "PAYPAL"
    assert detect_bank_code(raw_text="...SiamPay Service - Processing Fee...") == "SIAMPAY"


def test_bay_english_aliases():
    assert detect_bank_code(bank_company_name="Bank of Ayudhya Public Company Limited") == "BAY"
    assert detect_bank_code(raw_text="...KRUNGSRI...") == "BAY"


def test_processor_wins_over_bangkok_address_in_raw_text():
    # All four processors print a Bangkok (กรุงเทพ) address — the address must
    # not misroute detection to BBL.
    assert detect_bank_code(raw_text="เอ็นทีที เดต้า ... สีลม เขตบางรัก กรุงเทพมหานคร 10500") == "GHL"
    assert detect_bank_code(raw_text="PayPal Thailand ... Pathumwan กรุงเทพ 10330") == "PAYPAL"
    # But a plain Bangkok Bank document still resolves to BBL
    assert detect_bank_code(raw_text="ธนาคารกรุงเทพ จำกัด (มหาชน)") == "BBL"


def test_merchant_company_name_cannot_flip_to_new_issuer():
    # Merchant named กรุงศรี* must not be detected as BAY; the raw-text signal wins.
    assert detect_bank_code(company_name="บริษัท กรุงศรี ฟู้ดส์ จำกัด", raw_text="กสิกร") == "KBANK"
    assert detect_bank_code(company_name="บริษัท กรุงศรี ฟู้ดส์ จำกัด") is None


def test_doc_name_detects_new_formats_specific_first():
    # Tier-2 (doc_name) uses the same specific-before-generic chain as the
    # other tiers — บัตรกรุงไทย must beat the trailing กรุงเทพ address word.
    assert detect_bank_code(doc_name="ใบเสร็จรับเงิน บริษัท บัตรกรุงไทย กรุงเทพฯ") == "KTC"
    assert detect_bank_code(doc_name="ใบแจ้งการโอนเข้าบัญชี ธนาคารกรุงศรีอยุธยา") == "BAY"


def test_returns_none_without_signal():
    assert detect_bank_code() is None
    assert detect_bank_code(company_name="Acme Co", doc_name="Invoice") is None


def test_credit_suggest_group():
    from app.utils.bank_detect import credit_suggest_group

    assert credit_suggest_group("PAYPAL") == "gateway"
    assert credit_suggest_group("ktc") == "gateway"
    assert credit_suggest_group("KBANK") == "bank"
    assert credit_suggest_group(None) == "bank"
    assert credit_suggest_group("") == "bank"
