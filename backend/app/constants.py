"""
Application-wide constants.
Use these instead of bare strings to keep values consistent and catch typos at import time.
"""


class Module:
    """Module IDs — must match the `modules.id` primary keys seeded in migration 101."""

    CREDIT_CARD_OCR = "credit_card_ocr"
    AP_INVOICE = "ap_invoice"
    CC_AR_RECONCILE = "cc_ar_reconcile"


class DocType:
    """What kind of credit-card document this is — `credit_cards.doc_type`.

    KBANK prints one tax invoice number across two documents: the commission tax
    invoice the wizard has always read, and the merchant settlement report this
    column was added for. Both are legitimate, both post their own JV, and the
    duplicate guard keys on (tenant, doc_no, doc_date) — so without this column the
    second one to arrive is refused as a copy of the first.
    """

    FEE_INVOICE = "fee_invoice"  # default: everything the wizard has ever scanned
    AR_RECONCILE = "ar_reconcile"  # KBANK KB1P554V2 merchant settlement report


class PostType:
    """How finely the AR-reconciliation JV splits its credit side.

    DETAIL credits one line per printed payment type ("VS INTER UP PREM"); SUMMARY
    folds them onto the payment type's first token ("VS"). Each keeps its own set of
    mappings, so switching is a real choice about which accounts the BU maintains,
    not a display toggle.
    """

    DETAIL = "Detail"
    SUMMARY = "Summary"
    ALL = (DETAIL, SUMMARY)


class GLFields:
    """Fixed GL field names used in credit-card mapping suggestions."""

    FIXED_TYPES = ["Credit card commission", "Input Tax", "Bank Account"]


class ExpenseAccounts:
    """Filters for selecting expense-type accounts from Carmen."""

    VALID_TYPES = {"e", "expense", "exp", "expenditure"}
    CODE_PREFIXES = ("5", "6", "7")


class BlockedHosts:
    """Hostnames that are never allowed as Carmen URIs (SSRF protection)."""

    LOOPBACK = {"localhost", "ip6-localhost", "ip6-loopback", "broadcasthost"}
