"""
Application-wide constants.
Use these instead of bare strings to keep values consistent and catch typos at import time.
"""


class Module:
    """Module IDs — must match the `modules.id` primary keys seeded in migration 101."""

    CREDIT_CARD_OCR = "credit_card_ocr"
    AP_INVOICE = "ap_invoice"
