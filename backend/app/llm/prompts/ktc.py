"""Layout config for KTC (Krungthai Card / บริษัท บัตรกรุงไทย จำกัด (มหาชน)) — fee invoice."""

LAYOUT = """\
KTC (Krungthai Card / บริษัท บัตรกรุงไทย จำกัด (มหาชน))
  Detect by: "บัตรกรุงไทย" or "KRUNGTHAI CARD" in issuer header
  bank_name value: "บริษัท บัตรกรุงไทย จำกัด (มหาชน)"
  bank_company_name: issuer name (ผู้ออก / ISSUER)
  Header labels: เลขที่/NO. → doc_no | วันที่/ISSUE DATE → doc_date (Thai month name + Buddhist year, e.g. "01 พฤษภาคม 2569" → 01/05/2569) | ชื่อร้านค้า/MERCHANT NAME → merchant_name AND company_name | สถานประกอบการ/BRANCH (merchant section) → branch_no
  merchant_id: always null
  Fee invoice — this document bills the merchant fee itself, there is no card-type table.
  Critical: read EVERY line in the DESCRIPTION/จำนวนเงิน table as its own details row (usually one, but there may be several):
    transaction = line description (e.g. "ค่าบริการ Merchant Discount Rate (MDR)") | commis_amt = that line's AMOUNT/จำนวนเงิน (fee before VAT) | pay_amt/tax_amt = null (computed) | total = "0"
  Critical: THEN add ONE final summary row from the footer totals (the system spreads its VAT across the lines above):
    transaction = "TOTAL" | commis_amt = รวม/TOTAL (subtotal before VAT) | tax_amt = ภาษีมูลค่าเพิ่ม/VAT | pay_amt = จำนวนเงินรวม/GRAND TOTAL | total = "0"\
"""
