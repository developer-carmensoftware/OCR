"""Layout config for PayPal (PayPal Thailand Limited) — fee invoice."""

LAYOUT = """\
PAYPAL (PayPal Thailand Limited)
  Detect by: "PayPal" in document header or issuer name
  bank_name value: "PayPal Thailand Limited"
  bank_company_name: "PayPal Thailand Limited" (from header)
  Header labels: เลขที่/Document No. → doc_no | วันที่/Document Date → doc_date | รหัสลูกค้า/Customer ID → merchant_id | ชื่อ/ที่อยู่ลูกค้า Buyer Name → merchant_name AND company_name
  branch_no: always null
  Fee invoice — this document bills the merchant fee itself, there is no card-type table.
  Critical: read EVERY line in the Description/จำนวนเงิน (Amount) table as its own details row (usually one, but there may be several):
    transaction = line description (e.g. "Online Payment Services") | commis_amt = that line's จำนวนเงิน/Amount (THB, fee before VAT) | pay_amt/tax_amt = null (computed) | total = "0"
  Critical: THEN add ONE final summary row from the footer totals (the system spreads its VAT across the lines above):
    transaction = "TOTAL" | commis_amt = ยอดรวมก่อนภาษีมูลค่าเพิ่ม/Total Amount (THB, before VAT) | tax_amt = ภาษีมูลค่าเพิ่ม/VAT Amount (THB) | pay_amt = รวมราคาทั้งสิ้น/Grand Total Amount (THB) | total = "0"\
"""
