"""Bank layout config for BAY (Bank of Ayudhya / ธนาคารกรุงศรีอยุธยา / Krungsri)."""

LAYOUT = """\
BAY (Bank of Ayudhya / Krungsri / ธนาคารกรุงศรีอยุธยา)
  Detect by: "กรุงศรี" in document header or company name
  bank_name value: "ธนาคารกรุงศรีอยุธยา"
  bank_company_name: "ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)" (from header)
  Header labels: เลขที่ → doc_no | วันที่ → doc_date | หมายเลขร้านค้า → merchant_id | ชื่อผู้รับบริการ → merchant_name AND company_name | document title (ใบเสร็จรับเงิน/ใบกำกับภาษี/ใบแจ้งการโอนเข้าบัญชี...) → doc_name
  branch_no: always null (do NOT use สาขาที่)
  Table columns: CARD=transaction | GROSS AMT=pay_amt | DISC AMT=commis_amt | VAT AMT=tax_amt | NET AMT=total
  Critical: the table has BOTH a "TAX AMT" and a "VAT AMT" column — tax_amt comes from VAT AMT; ignore the TAX AMT column (withholding tax)
  Critical: scan ALL card-type rows (VISA, V-PLAT & INF, MSC, M-PREMIUM, KCC, JCB, UPI, AMEX, DB CONS, DB NON CON, etc.)\
"""
