"""Layout config for SiamPay (Asia Pay (Thailand) Limited) — fee invoice."""

LAYOUT = """\
SIAMPAY (SiamPay / Asia Pay (Thailand) Limited)
  Detect by: "Asia Pay" or "SiamPay" in document header or line items
  bank_name value: "Asia Pay (Thailand) Limited"
  bank_company_name: "Asia Pay (Thailand) Limited" (from header)
  Header labels: Receipt No. → doc_no | Date → doc_date | Customer (name block under "Customer:") → merchant_name AND company_name
  merchant_id: always null
  branch_no: always null
  Fee invoice — this document bills the merchant fee itself, there is no card-type table.
  Critical: read EVERY fee line in the item table as its own details row (usually several — Processing Fee, Transaction Fee, ...):
    transaction = line description (e.g. "SiamPay Service - Processing Fee") | commis_amt = line Amount (before VAT) | pay_amt/tax_amt = null (computed) | total = "0"
  Critical: THEN add ONE final summary row from the footer totals (the system spreads its VAT across the lines above):
    transaction = "TOTAL" | commis_amt = Subtotal (before VAT) | tax_amt = VAT 7% | pay_amt = Total | total = "0"
  Critical: the skip-rows-with-blank-pay_amt rule does NOT apply here — include every fee line even though pay_amt is null\
"""
