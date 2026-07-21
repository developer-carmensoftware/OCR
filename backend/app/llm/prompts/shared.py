"""Shared prompt fragments and builders reused across all bank OCR prompts."""

ROW_RULES = """
Rules for extracting details[] rows (a matched bank layout's "Critical" instructions OVERRIDE these general rules when they conflict):
1. Include every card/payment type row that has a non-zero pay_amt.
2. SKIP rows labeled: จำนวนเงินรวม, TOTAL, รวม, GRAND TOTAL, NET AMOUNT, จำนวนเงินค่าธรรมเนียม — summary rows only.
   EXCEPTION: when the matched bank layout explicitly instructs you to ADD or INCLUDE a summary/TOTAL row
   (BAY statement; KTC/GHL/PAYPAL/SIAMPAY fee invoices), that layout instruction WINS — emit exactly ONE such summary row.
3. SKIP rows where pay_amt is 0.00 or blank.
4. SKIP Withholding Tax deduction rows — any row whose label contains: ภาษีเงินได้หัก ณ ที่จ่าย, WHT, Withholding Tax, ภาษีถูกหัก, หัก ณ ที่จ่าย. These are bank tax deductions, NOT card transaction rows.
"""

OUTPUT_RULES = """
Return ONLY a valid JSON object — no markdown fences, no explanation.
If a field is not present in the document, set it to null.
For monetary amounts, preserve the original format with commas (e.g. "10,342.12").
For doc_date, always convert to DD/MM/YYYY format.

CRITICAL: Each payment/card type row = ONE separate JSON object inside the "details" array.
Do NOT merge multiple rows into one object.

Header fields to extract:
- bank_company_name : ชื่อนิติบุคคลของธนาคาร (ผู้ออกเอกสาร) จาก header/footer ของธนาคาร — ไม่ใช่ชื่อร้านค้า
- branch_no        : รหัสสาขาของธนาคาร (ถ้ามี) — look carefully near สาขา/สาขาที่/สถานประกอบการ/BRANCH/Head Office; this field is frequently missed, re-check before returning null
- bank_name        : ชื่อธนาคารภาษาไทย (กำหนดตายตัวในแต่ละ bank prompt)
- doc_name         : document title (e.g. "ใบเสร็จรับเงิน/ใบกำกับภาษี")
- company_name     : company name from address section (ชื่อ / NAME)
- doc_date         : document date → DD/MM/YYYY
- doc_no           : document number
- merchant_name    : MERCHANT NAME as shown in the merchant section
- merchant_id      : MERCHANT NUMBER / MERCHANT ID from the document HEADER section — numeric code only (NOT from a table column)

Detail row fields (one object per card/payment type row):
- transaction  : card type / payment type label per row (e.g. "Visa", "Master", "VSA-INT-P"), OR a terminal/merchant ID code if the bank uses numeric codes per row instead of card-type names — use whatever appears in the first data column of the table
- pay_amt      : gross sale amount (S/D AMOUNT / ยอดเงิน / จำนวนเงิน) — EXCEPT on fee invoices
                 (KTC/GHL/PAYPAL/SIAMPAY): there the line-item จำนวนเงิน/Amount is the FEE → put it in
                 commis_amt and leave pay_amt null on fee line rows (see the matched layout)
- commis_amt   : commission / discount fee (DISCOUNT AMOUNT / ค่าธรรมเนียม)
- tax_amt      : VAT on commission (VALUE ADDED TAX / ภาษีมูลค่าเพิ่ม)
- total        : net amount credited to merchant per row (AMOUNT CREDIT TO MERCHANT / จำนวนเงินสุทธิ)

Output structure:
{"bank_company_name":…,"branch_no":…,"bank_name":…,"doc_name":…,"company_name":…,"doc_date":…,"doc_no":…,"merchant_name":…,"merchant_id":…,"details":[{"transaction":…,"pay_amt":…,"commis_amt":…,"tax_amt":…,"total":…}]}
"""

_BASE_INTRO = (
    "You are extracting structured data from a Thai bank credit card receipt "
    "and tax invoice (ใบเสร็จรับเงิน/ใบกำกับภาษี).\n\n"
    "Carefully read all text in the image."
)


def build_bank_prompt(layout: str) -> str:
    """Build a standalone bank-specific prompt from a LAYOUT fragment."""
    return _BASE_INTRO + "\n\n" + layout + "\n" + ROW_RULES + OUTPUT_RULES


def build_combined_prompt(layouts: list[str]) -> str:
    """Build a single auto-detect prompt from all bank LAYOUT fragments."""
    sep = "\n" + "─" * 50 + "\n"
    bank_ref = sep.join(layouts)
    return (
        _BASE_INTRO + "\n\n"
        "Step 1 — Identify the bank: match the document header/footer/company name "
        "against the BANK REFERENCE below.\n"
        "Step 2 — Apply the matched bank's column mapping and quirks.\n"
        "Step 3 — If no bank matches, use best judgment from visible column labels.\n\n"
        f"BANK REFERENCE:\n{sep}{bank_ref}{sep}" + ROW_RULES + OUTPUT_RULES
    )
