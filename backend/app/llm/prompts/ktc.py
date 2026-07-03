"""Layout config for KTC (Krungthai Card / บริษัท บัตรกรุงไทย จำกัด (มหาชน)) — fee invoice."""

LAYOUT = """\
KTC (Krungthai Card / บริษัท บัตรกรุงไทย จำกัด (มหาชน))
  Detect by: "บัตรกรุงไทย" or "KRUNGTHAI CARD" in issuer header
  bank_name value: "บริษัท บัตรกรุงไทย จำกัด (มหาชน)"
  bank_company_name: issuer name (ผู้ออก / ISSUER)
  Header labels: เลขที่/NO. → doc_no | วันที่/ISSUE DATE → doc_date (Thai month name + Buddhist year, e.g. "01 พฤษภาคม 2569" → 01/05/2569) | ชื่อร้านค้า/MERCHANT NAME → merchant_name AND company_name | สถานประกอบการ/BRANCH (merchant section) → branch_no
  merchant_id: always null
  Fee invoice — this document bills the merchant fee itself, there is no card-type table.
  Critical: build exactly ONE details row from the totals (the totals ARE the data — do NOT skip them as summary rows):
    transaction = fee description line (e.g. "ค่าบริการ Merchant Discount Rate (MDR)") | pay_amt = จำนวนเงินรวม/GRAND TOTAL | commis_amt = รวม/TOTAL (before VAT) | tax_amt = ภาษีมูลค่าเพิ่ม/VAT 7% | total = "0" (always)\
"""
