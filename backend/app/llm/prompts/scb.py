"""Bank layout config for SCB (ธนาคารไทยพาณิชย์)."""

LAYOUT = """\
SCB (Siam Commercial Bank / ธนาคารไทยพาณิชย์)
  Detect by: "ไทยพาณิชย์" in header, OR doc title contains "ใบนำฝาก" or "ใบสรุปยอดขายบัตรเครดิต"
  bank_name value: "ธนาคารไทยพาณิชย์"
  Header labels: เลขที่ → doc_no | รายการประจำวันที่ → doc_date | MERCHANT NUMBER → merchant_id | MERCHANT NAME → merchant_name | NAME (address section) → company_name
  doc_date: read ALL THREE parts of รายการประจำวันที่ — "23/02/2026" is DD/MM/YYYY, never MM/YYYY.
    The เลขที่ directly above it is a 12-digit number that embeds the same digits (262302202523),
    so do not let it swallow the day: เลขที่ and รายการประจำวันที่ are separate fields, read each in full.
  Table columns: CARD TYPE=transaction | S/D AMOUNT=pay_amt | DISCOUNT AMOUNT=commis_amt | VALUE ADDED TAX=tax_amt | AMOUNT CREDIT TO MERCHANT=total
  Critical: scan ALL rows top to bottom — do NOT stop early (rows include VSA-INT-P, VSA-INT, MCA-INT-P, MCA-INT, etc.)\
"""
