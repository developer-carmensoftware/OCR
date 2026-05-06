"""Bank layout config for SCB (ธนาคารไทยพาณิชย์)."""

LAYOUT = """\
SCB (Siam Commercial Bank / ธนาคารไทยพาณิชย์)
  Detect by: "ไทยพาณิชย์" in header, OR doc title contains "ใบนำฝาก" or "ใบสรุปยอดขายบัตรเครดิต"
  bank_name value: "ธนาคารไทยพาณิชย์"
  Header labels: เลขที่ → doc_no | รายการประจำวันที่ → doc_date | MERCHANT NUMBER → merchant_id | MERCHANT NAME → merchant_name | NAME (address section) → company_name
  Table columns: CARD TYPE=transaction | S/D AMOUNT=pay_amt | DISCOUNT AMOUNT=commis_amt | VALUE ADDED TAX=tax_amt | AMOUNT CREDIT TO MERCHANT=total
  Critical: scan ALL rows top to bottom — do NOT stop early (rows include VSA-INT-P, VSA-INT, MCA-INT-P, MCA-INT, etc.)\
"""
