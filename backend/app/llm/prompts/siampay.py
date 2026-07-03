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
  Critical: build exactly ONE details row from the footer totals, even when the invoice lists multiple fee lines (the totals ARE the data — do NOT skip them as summary rows):
    transaction = service description of the first fee line (e.g. "SiamPay Service - Processing Fee") | pay_amt = Total | commis_amt = Subtotal | tax_amt = VAT 7% | total = "0" (always)\
"""
