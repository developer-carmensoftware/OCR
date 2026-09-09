"""Layout config for the KBANK merchant settlement report (report no. KB1P554V2).

A different document from kbank.py, not a different bank. kbank.py reads the
commission receipt/tax invoice (one table, one footer). This reads
`KB1P554V2_SUM_<merchant id>_<date>.pdf`, KASIKORNBANK's SALE TRANSACTION REPORT /
SUMMARY FULL PAYMENT, whose body repeats a block per TERMINAL ID and BATCH ID and
whose usable figures live on the last page only. The caller sends that page alone
(`extract_stateless(page_indexes=[-1])`), so the model never sees the per-terminal
noise — but the last page can still carry a trailing TERMINAL block above the
merchant summary, which is why the layout names the block to read rather than
saying "the table".
"""

LAYOUT = """\
KBANK SETTLEMENT REPORT (KASIKORNBANK — SALE TRANSACTION REPORT / SUMMARY FULL PAYMENT, REPORT NO. KB1P554V2)
  Detect by: "KASIKORNBANK" with "SALE TRANSACTION REPORT" in the page header
  bank_code value: "KBANK"
  bank_name value: "ธนาคารกสิกรไทย"
  bank_company_name: "KASIKORNBANK"
  Header labels: SETTLEMENT DATE → doc_date (already DD/MM/YYYY — copy it, do not use REPORT DATE or POSTING DATE) | TAX INVOICE NUMBER (printed at the very bottom of the page) → doc_no | MERCHANT ID → merchant_id | MERCHANT NAME → merchant_name AND company_name
  doc_name value: "SALE TRANSACTION REPORT"
  Critical: read ONLY the block headed "SUMMARY MERCHANT ID : <id> <merchant name>".
    IGNORE every "TERMINAL ID :" block, every "SUMMARY TERMINAL ID :" block and every
    "SUMMARY SERVICE :" block — they are subtotals of the same money and adding them
    would post the day's takings two or three times over.
  Critical: if more than one "SUMMARY MERCHANT ID" block appears, read the FIRST one only.
  Table columns inside that block: PAYMENT TYPE → transaction | THB AMT → pay_amt | COMM AMT → commis_amt | VAT AMT → tax_amt | NET AMT → total
    One row per PAYMENT TYPE (e.g. "VS INTER NON-PREM", "MC INTER UP PREM", "JCB PREM").
    Ignore the NO TXN, COMM RATE and RATE TYPE columns entirely.
    A dash "-" in the VAT AMT or NET AMT column means no value → null, not "0".
  Critical: THEN add ONE final summary row from the "TOTAL BY MERCHANT ID" line — this is an
  EXCEPTION to the skip-summary-rows rule; the system consumes it to verify the rows above
  and never posts it:
    transaction = "TOTAL" | pay_amt = its THB AMT | commis_amt = its COMM AMT | tax_amt = its VAT AMT | total = its NET AMT\
"""
