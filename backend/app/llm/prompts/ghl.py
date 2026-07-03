"""Layout config for GHL (NTT DATA Digital Payment Thailand) — fee invoice."""

LAYOUT = """\
GHL (NTT DATA Digital Payment / บริษัท เอ็นทีที เดต้า ดิจิทัล เพย์เม้นท์ (ประเทศไทย) จำกัด)
  Detect by: "เอ็นทีที เดต้า" or "NTT DATA" or "GHL" in issuer header
  bank_name value: "GHL" (fixed literal)
  bank_company_name: issuer name from header (บริษัท เอ็นทีที เดต้า ดิจิทัล เพย์เม้นท์ (ประเทศไทย) จำกัด)
  Header labels: เลขที่/No → doc_no | วันที่/Date → doc_date (Thai month name + Buddhist year → DD/MM/YYYY) | ลูกค้า/Customer → merchant_name AND company_name | head office code next to สำนักงานใหญ่ (e.g. "00000") → branch_no
  merchant_id: always null
  Fee invoice — this document bills the merchant fee itself, there is no card-type table.
  Critical: build exactly ONE details row from the totals (the totals ARE the data — do NOT skip them as summary rows):
    transaction = fee description line (e.g. "TRANSACTION FEE ...") | pay_amt = จำนวนเงินทั้งสิ้น (Grand Total Amount) | commis_amt = จำนวนเงินหลังหักส่วนลด (After Discount) | tax_amt = ภาษีมูลค่าเพิ่ม (VAT 7%) | total = "0" (always)\
"""
