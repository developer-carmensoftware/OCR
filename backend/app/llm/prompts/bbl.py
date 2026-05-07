"""Bank layout config for BBL (Bangkok Bank / ธนาคารกรุงเทพ)."""

LAYOUT = """\
BBL (Bangkok Bank / ธนาคารกรุงเทพ)
  Detect by: "กรุงเทพ" or "Bangkok Bank" in document header or company name
  bank_name value: "ธนาคารกรุงเทพ"

  Header fields:
    ชื่อ / NAME                → company_name  (also use as merchant_name)
    วันที่ / DATE              → doc_date
    เลขที่ / NO.               → doc_no
    เลขที่บัญชี / เลขที่สัญญา → merchant_id

  ── CRITICAL BBL TABLE RULE ──────────────────────────────────────────────────
  BBL's detail table has a column called "หมายเลขร้านค้า" as its FIRST column.
  Despite the name, its per-row values are Terminal/Merchant IDs (long numeric
  strings, e.g. "002205993394", "002205903321").

  Map these table values as:
    หมายเลขร้านค้า (col 1, numeric, per-row) → transaction   ← NOT merchant_id
    จำนวนเงิน                                → pay_amt
    ค่าธรรมเนียม                             → commis_amt
    ภาษีมูลค่าเพิ่ม                          → tax_amt
    จำนวนเงินสุทธิ                           → total

  DO NOT put the table's หมายเลขร้านค้า value into the header field merchant_id.
  merchant_id comes only from the document header (เลขที่บัญชี / เลขที่สัญญา).

  SKIP any row where the first column (หมายเลขร้านค้า) contains Thai text such as
  "จำนวนเงินรวม", "รวม", or any non-numeric label — those are summary rows, not
  individual transactions. Only rows with a numeric terminal/merchant ID belong in details[].
  ─────────────────────────────────────────────────────────────────────────────\
"""
