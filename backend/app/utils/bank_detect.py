"""
Backend bank detection — Python port of the frontend `detectBankFromExtracted`
(`frontend/src/constants/banks.ts`).

The credit-card duplicate check keys on `bank_code`, but the bank is not known
when `/extract` is called (the frontend never passes one). This resolves the
bank from the LLM-extracted fields so the persisted row and the duplicate check
carry the same `bank_code` the submit step will later store.

The model's own answer (`model_bank_code`) is tier 0: every prompt asks which
BANK REFERENCE entry issued the document, and the reader looking at the page
beats keyword-matching the two or three header fields it chose to fill in.

Supported banks: BBL | KBANK | SCB | BAY | KTC | GHL | PAYPAL | SIAMPAY.
"""

# Processor fee invoices (vs. statement banks): their detail rows are per-fee-line
# with pay_amt intentionally blank (the fee lives in commis_amt; pay_amt is
# computed later from the footer VAT). Single source of truth — imported by both
# credit_card_service (normalizer routing) and llm_service (row cleaning).
FEE_INVOICE_CODES = frozenset({"KTC", "GHL", "PAYPAL", "SIAMPAY"})


def credit_suggest_group(bank_code: str | None) -> str:
    """Which credit-side (payment-type) suggestion framing this bank uses.

    ponytail: two groups today (bank | gateway); a new group = new branch here
    + a context entry in llm/prompts/mapping.py _CREDIT_CONTEXTS.
    """
    return "gateway" if (bank_code or "").upper() in FEE_INVOICE_CODES else "bank"


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

# Every code this module can return — also the whitelist for the model's own answer,
# which is untrusted text until it matches one of these exactly.
BANK_CODES: frozenset[str] = frozenset(code for code, _, _ in _BANK_KEYWORDS)


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
    model_bank_code: str | None = None,
    bank_company_name: str | None = None,
    bank_name: str | None = None,
    company_name: str | None = None,
    doc_name: str | None = None,
) -> str | None:
    """Return a bank code ('BBL', 'KBANK', 'KTC', …) from extracted fields, or None."""
    # 0. What the model said it matched. Already validated to a known code by the
    # schema, re-checked here because this function is called with raw dicts too.
    if model_bank_code in BANK_CODES:
        return model_bank_code

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

    # There was a `raw_text` tier here until 2026-09-03. It never fired: no prompt has
    # ever asked the model to return `raw_text`, so it was always "". Two diagnoses
    # blamed it for a wrong bank before anyone checked — deleted rather than fixed,
    # since tier 0 now asks the reader directly.
    return None
