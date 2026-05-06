"""Bank layout config for KBANK (Kasikornbank / ธนาคารกสิกรไทย)."""

LAYOUT = """\
KBANK (Kasikornbank / ธนาคารกสิกรไทย)
  Detect by: "กสิกร" in document header or company name
  bank_name value: "ธนาคารกสิกรไทย"
  Header labels: วันที่ออกเอกสาร/Issued Date → doc_date | เลขที่เอกสาร/Document number → doc_no | รหัสร้านค้า/MERCHANT ID → merchant_id | ชื่อร้านค้า/MERCHANT NAME → merchant_name AND company_name
  Table columns: ประเภทการชำระ/PAYMENT TYPE=transaction | ยอดเงิน/AMOUNT=pay_amt | ค่าธรรมเนียม/FEE=commis_amt | ภาษีมูลค่าเพิ่ม/VAT=tax_amt | ยอดเงินสุทธิ/NET AMOUNT=total\
"""
