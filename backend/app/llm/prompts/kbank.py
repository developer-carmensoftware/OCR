"""Bank layout config for KBANK (Kasikornbank / ธนาคารกสิกรไทย)."""

LAYOUT = """\
KBANK (Kasikornbank / ธนาคารกสิกรไทย)
  Detect by: "กสิกร" in document header or company name
  bank_name value: "ธนาคารกสิกรไทย"
  Header labels: วันที่ออกเอกสาร/Issued Date → doc_date | เลขที่เอกสาร/Document number → doc_no | รหัสร้านค้า/MERCHANT ID → merchant_id | ชื่อร้านค้า/MERCHANT NAME → merchant_name AND company_name
  Table columns: ประเภทการชำระ/PAYMENT TYPE=transaction | ยอดเงิน/AMOUNT=pay_amt | ค่าธรรมเนียม/FEE=commis_amt | ภาษีมูลค่าเพิ่ม/VAT=tax_amt | ยอดเงินสุทธิ/NET AMOUNT=total
  MANDATORY FINAL ROW — the table ends with one printed summary line (จำนวนเงินรวม / รวม /
  TOTAL). Append it as one extra object in details[], the LAST object, on top of every
  payment-type row above: if the table prints N payment-type rows, details[] MUST contain
  N+1 objects. This row is the one exception to "skip summary/total rows" — the system
  consumes it to verify the rows above and never posts it, so omitting it is a
  verification failure, not a harmless skip.
    transaction = "TOTAL" | its ยอดเงิน → pay_amt | ค่าธรรมเนียม → commis_amt | ภาษีมูลค่าเพิ่ม → tax_amt | ยอดเงินสุทธิ → total\
"""
