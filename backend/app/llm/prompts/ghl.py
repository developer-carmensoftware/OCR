"""Layout config for GHL (NTT DATA Digital Payment Thailand) — fee invoice."""

LAYOUT = """\
GHL (NTT DATA Digital Payment / บริษัท เอ็นทีที เดต้า ดิจิทัล เพย์เม้นท์ (ประเทศไทย) จำกัด)
  Detect by: "เอ็นทีที เดต้า" or "NTT DATA" or "GHL" in issuer header
  bank_name value: "GHL" (fixed literal)
  bank_company_name: issuer name from header (บริษัท เอ็นทีที เดต้า ดิจิทัล เพย์เม้นท์ (ประเทศไทย) จำกัด)
  Header labels: เลขที่/No → doc_no | วันที่/Date → doc_date (Thai month name + Buddhist year → DD/MM/YYYY) | ลูกค้า/Customer → merchant_name AND company_name | head office code next to สำนักงานใหญ่ (e.g. "00000") → branch_no
  merchant_id: always null
  Fee invoice — this document bills the merchant fee itself, there is no card-type table.
  Critical: read EVERY row in the Particulars/จำนวนเงิน (Amount) table as its own details row (usually one, but there may be several):
    transaction = line description (e.g. "TRANSACTION FEE ...") | commis_amt = that line's จำนวนเงิน/Amount (Baht, fee before VAT) | pay_amt/tax_amt = null (computed) | total = "0"
  Critical: THEN add ONE final summary row from the footer totals — this is an EXCEPTION to the skip-summary-rows rule; the system consumes it and spreads its VAT across the lines above:
    transaction = "TOTAL" | commis_amt = จำนวนเงินหลังหักส่วนลด (After Discount / Sub Total, before VAT) | tax_amt = ภาษีมูลค่าเพิ่ม (VAT) | pay_amt = จำนวนเงินทั้งสิ้น (Grand Total Amount) | total = "0"
  Critical: the skip-rows-with-blank-pay_amt rule does NOT apply here — include every fee line even though pay_amt is null\
"""
