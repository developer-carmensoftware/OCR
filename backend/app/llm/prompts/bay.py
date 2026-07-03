"""Bank layout config for BAY (Bank of Ayudhya / ธนาคารกรุงศรีอยุธยา / Krungsri)."""

LAYOUT = """\
BAY (Bank of Ayudhya / Krungsri / ธนาคารกรุงศรีอยุธยา)
  Detect by: "กรุงศรี" in document header or company name
  bank_name value: "ธนาคารกรุงศรีอยุธยา"
  bank_company_name: "ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)" (from header)
  Header labels: เลขที่ → doc_no | วันที่ → doc_date | หมายเลขร้านค้า → merchant_id | ชื่อผู้รับบริการ → merchant_name AND company_name | document title (ใบเสร็จรับเงิน/ใบกำกับภาษี/ใบแจ้งการโอนเข้าบัญชี...) → doc_name
  branch_no: always null (do NOT use สาขาที่)
  Table columns, left to right: CARD=transaction | T-X = transaction COUNT (small integer — NEVER a payment type, NEVER its own row, NEVER an amount) | GROSS AMT=pay_amt | DISC AMT=commis_amt | TAX AMT (withholding — ignore) | VAT AMT=tax_amt | NET AMT=total
  Critical: read each printed LINE as one row — the CARD label and its amounts are on the same line; do not shift amounts up or down a row, and do not invent rows from column headers
  Critical: per-row VAT/NET cells are usually BLANK — leave them null, do NOT copy values from other columns
  Critical: INCLUDE the final รวม/TOTAL summary line as the LAST details row (exception to the skip-summary-rows rule — the system consumes it for VAT distribution)
  Critical: scan ALL card-type rows (VISA, V-PLAT & INF, MSC, M-PREMIUM, KCC, JCB, UPI, AMEX, DB CONS, DB NON CON, etc.)\
"""
