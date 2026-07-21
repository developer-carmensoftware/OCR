"""
Backend bank detection — Python port of the frontend `detectBankFromExtracted`
(`frontend/src/constants/banks.ts`).

The credit-card duplicate check keys on `bank_code`, but the bank is not known
when `/extract` is called (the frontend never passes one). This resolves the
bank from the LLM-extracted fields so the persisted row and the duplicate check
carry the same `bank_code` the submit step will later store.

Supported banks: BBL | KBANK | SCB | BAY | KTC | GHL | PAYPAL | SIAMPAY.
"""

# Processor fee invoices (vs. statement banks): their detail rows are per-fee-line
# with pay_amt intentionally blank (the fee lives in commis_amt; pay_amt is
# computed later from the footer VAT). Single source of truth — imported by both
# credit_card_service (normalizer routing) and llm_service (row cleaning).
FEE_INVOICE_CODES = frozenset({"KTC", "GHL", "PAYPAL", "SIAMPAY"})

# (code, thai keywords, english keywords) — ordered specific-before-generic:
# processors/issuers before the generic กรุง* substrings (which would otherwise
# shadow KTC/BAY), and before กรุงเทพ specifically (just "Bangkok" — appears in
# every Bangkok-address footer, including the processors' own). Single source
# of truth for the issuer-name tier (1) and the raw-text tier (3) below.
_BANK_KEYWORDS: list[tuple[str, tuple[str, ...], tuple[str, ...]]] = [
    ("KTC", ("บัตรกรุงไทย",), ("KRUNGTHAI CARD",)),
    ("BAY", ("กรุงศรี",), ("KRUNGSRI", "BANK OF AYUDHYA")),
    ("GHL", ("เอ็นทีที เดต้า",), ("NTT DATA",)),
    ("PAYPAL", ("เพย์พาล",), ("PAYPAL",)),
    ("SIAMPAY", ("สยามเพย์",), ("ASIA PAY", "SIAMPAY")),
    ("KBANK", ("กสิกร",), ()),
    ("SCB", ("ไทยพาณิชย์",), ()),
    ("BBL", ("กรุงเทพ",), ()),
]


def _match(text: str, upper: str) -> str | None:
    for code, thai_kw, eng_kw in _BANK_KEYWORDS:
        if any(k in text for k in thai_kw) or any(k in upper for k in eng_kw):
            return code
    return None


def _match_issuer(name: str) -> str | None:
    """Keyword chain for issuer name fields (bank_company_name/bank_name)."""
    upper = name.upper()
    if upper == "GHL":  # ghl.py fixes bank_name to the literal "GHL" (too short/common a
        return "GHL"  # substring to safely match elsewhere, e.g. raw free text)
    return _match(name, upper)


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

    # 2. Document-name keyword fallbacks — same specific-first chain as the
    # other tiers, then English legacy names and SCB document-title keywords.
    if doc:
        if code := _match(doc, doc):
            return code
        if "KASIKORN" in doc:
            return "KBANK"
        if "BANGKOK BANK" in doc:
            return "BBL"
        if "SIAM COMMERCIAL" in doc:
            return "SCB"
        if "ใบนำฝาก" in doc or "ใบสรุปยอดขายบัตรเครดิต" in doc:
            return "SCB"

    # 3. Raw-text keyword fallbacks — most-specific first (see _BANK_KEYWORDS).
    if raw_text and (code := _match(raw, raw)):
        return code

    return None
