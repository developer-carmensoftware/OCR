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
  Critical: scan ALL rows top to bottom — do NOT stop early (rows include VSA-INT-P, VSA-INT, MCA-INT-P, MCA-INT, etc.)
  MANDATORY FINAL ROW — the table ends with one printed summary line (TOTAL / รวม /
  จำนวนเงินรวม). Append it as one extra object in details[], the LAST object, on top of
  every card-type row above: if the table prints N card-type rows, details[] MUST contain
  N+1 objects. This row is the one exception to "skip summary/total rows" — the system
  consumes it to verify the rows above and never posts it, so omitting it is a
  verification failure, not a harmless skip. Do NOT use the separate NET AMOUNT or
  WITHHOLDING TAX lines for it.
    transaction = "TOTAL" | its S/D AMOUNT → pay_amt | DISCOUNT AMOUNT → commis_amt | VALUE ADDED TAX → tax_amt | AMOUNT CREDIT TO MERCHANT → total\
"""
