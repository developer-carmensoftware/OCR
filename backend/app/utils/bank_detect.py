"""
Backend bank detection — Python port of the frontend `detectBankFromExtracted`
(`frontend/src/constants/banks.ts`).

The credit-card duplicate check keys on `bank_code`, but the bank is not known
when `/extract` is called (the frontend never passes one). This resolves the
bank from the LLM-extracted fields so the persisted row and the duplicate check
carry the same `bank_code` the submit step will later store.

Supported banks: BBL | KBANK | SCB.
"""


def detect_bank_code(
    *,
    bank_company_name: str | None = None,
    bank_name: str | None = None,
    company_name: str | None = None,
    doc_name: str | None = None,
    raw_text: str | None = None,
) -> str | None:
    """Return 'BBL' | 'KBANK' | 'SCB' from extracted fields, or None if no signal."""
    # 1. Name signals — Thai bank names in any of the name fields.
    for name in (bank_company_name, bank_name, company_name):
        if not name:
            continue
        if "กรุงเทพ" in name:
            return "BBL"
        if "กสิกร" in name:
            return "KBANK"
        if "ไทยพาณิชย์" in name:
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

    # 3. Raw-text keyword fallbacks.
    if "กสิกร" in raw:
        return "KBANK"
    if "กรุงเทพ" in raw:
        return "BBL"
    if "ไทยพาณิชย์" in raw:
        return "SCB"

    return None
