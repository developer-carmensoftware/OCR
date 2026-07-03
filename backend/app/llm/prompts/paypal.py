"""Layout config for PayPal (PayPal Thailand Limited) — fee invoice."""

LAYOUT = """\
PAYPAL (PayPal Thailand Limited)
  Detect by: "PayPal" in document header or issuer name
  bank_name value: "PayPal Thailand Limited"
  bank_company_name: "PayPal Thailand Limited" (from header)
  Header labels: เลขที่/Document No. → doc_no | วันที่/Document Date → doc_date | รหัสลูกค้า/Customer ID → merchant_id | ชื่อ/ที่อยู่ลูกค้า Buyer Name → merchant_name AND company_name
  branch_no: always null
  Fee invoice — this document bills the merchant fee itself, there is no card-type table.
  Critical: build exactly ONE details row from the totals (the totals ARE the data — do NOT skip them as summary rows):
    transaction = description line (e.g. "Online Payment Services") | pay_amt = รวมราคาทั้งสิ้น/Grand Total Amount (THB) | commis_amt = ยอดรวมก่อนภาษีมูลค่าเพิ่ม/Total Amount (THB) | tax_amt = ภาษีมูลค่าเพิ่ม/VAT Amount 7% (THB) | total = "0" (always)\
"""
