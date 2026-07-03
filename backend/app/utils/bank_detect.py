"""
Backend bank detection — Python port of the frontend `detectBankFromExtracted`
(`frontend/src/constants/banks.ts`).

The credit-card duplicate check keys on `bank_code`, but the bank is not known
when `/extract` is called (the frontend never passes one). This resolves the
bank from the LLM-extracted fields so the persisted row and the duplicate check
carry the same `bank_code` the submit step will later store.

Supported banks: BBL | KBANK | SCB | BAY | KTC | GHL | PAYPAL | SIAMPAY.
"""


def _match_issuer(name: str) -> str | None:
    """Full keyword chain for issuer name fields — specific issuers before the
    generic กรุง* substrings (KTC/BAY/processors would otherwise be shadowed)."""
    upper = name.upper()
    if "บัตรกรุงไทย" in name or "KRUNGTHAI CARD" in upper or upper == "KTC":
        return "KTC"
    if "กรุงศรี" in name or "KRUNGSRI" in upper or "BANK OF AYUDHYA" in upper:
        return "BAY"
    if "เอ็นทีที เดต้า" in name or "NTT DATA" in upper or upper == "GHL":
        return "GHL"
    if "PAYPAL" in upper or "เพย์พาล" in name:
        return "PAYPAL"
    if "ASIA PAY" in upper or "SIAMPAY" in upper or "สยามเพย์" in name:
        return "SIAMPAY"
    if "กสิกร" in name:
        return "KBANK"
    if "ไทยพาณิชย์" in name:
        return "SCB"
    if "กรุงเทพ" in name:
        return "BBL"
    return None


def detect_bank_code(
    *,
    bank_company_name: str | None = None,
    bank_name: str | None = None,
    company_name: str | None = None,
    doc_name: str | None = None,
    raw_text: str | None = None,
) -> str | None:
    """Return a bank code ('BBL', 'KBANK', 'KTC', …) from extracted fields, or None."""
    # 1a. Issuer name fields — full keyword chain.
    for name in (bank_company_name, bank_name):
        if name and (code := _match_issuer(name)):
            return code

    # 1b. Merchant company name — legacy bank keywords ONLY. Merchant names like
    # "บริษัท กรุงศรี ฟู้ดส์" must not flip detection to a new issuer.
    if company_name:
        if "กรุงเทพ" in company_name:
            return "BBL"
        if "กสิกร" in company_name:
            return "KBANK"
        if "ไทยพาณิชย์" in company_name:
            return "SCB"

    doc = (doc_name or "").upper()
    raw = (raw_text or "").upper()

    # 2. Document-name keyword fallbacks.
    if "KASIKORN" in doc or "กสิกร" in doc:
        return "KBANK"
    if "BANGKOK BANK" in doc or "กรุงเทพ" in doc:
        return "BBL"
    if "SIAM COMMERCIAL" in doc or "ไทยพาณิชย์" in doc:
        return "SCB"
    if "ใบนำฝาก" in doc or "ใบสรุปยอดขายบัตรเครดิต" in doc:
        return "SCB"

    # 3. Raw-text keyword fallbacks — most-specific first. กรุงเทพ is checked
    # LAST: it is just "Bangkok" and appears in every Bangkok-address footer
    # (all four processors are Bangkok-based).
    if "บัตรกรุงไทย" in raw or "KRUNGTHAI CARD" in raw:
        return "KTC"
    if "กรุงศรี" in raw or "KRUNGSRI" in raw or "BANK OF AYUDHYA" in raw:
        return "BAY"
    if "เอ็นทีที เดต้า" in raw or "NTT DATA" in raw:
        return "GHL"
    if "PAYPAL" in raw:
        return "PAYPAL"
    if "ASIA PAY" in raw or "SIAMPAY" in raw:
        return "SIAMPAY"
    if "กสิกร" in raw:
        return "KBANK"
    if "ไทยพาณิชย์" in raw:
        return "SCB"
    if "กรุงเทพ" in raw:
        return "BBL"

    return None
