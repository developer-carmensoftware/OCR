"""
Application-wide constants.
Use these instead of bare strings to keep values consistent and catch typos at import time.
"""


class Module:
    """Module IDs — must match the `modules.id` primary keys seeded in migration 101."""

    CREDIT_CARD_OCR = "credit_card_ocr"
    AP_INVOICE = "ap_invoice"


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
