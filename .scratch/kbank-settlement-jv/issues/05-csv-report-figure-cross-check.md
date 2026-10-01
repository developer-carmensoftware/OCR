# 05: CSV vs. report figure cross-check

**What to build:** Once both the CSV (ticket 01) and the report's own total row (ticket 03) are
available, three more numbers are free to check — the tax invoice number, and the commission,
VAT and net the CSV reports for this merchant, against what the settlement report itself
printed. A disagreement is not rejected; it's surfaced to a reviewer as a warning, the same way
every other reconciliation check in this pipeline already behaves.

**Blocked by:** 01 (CSV sidecar ingestion), 03 (Combined JV — needs `total_row`)

**Status:** done — 2026-09-18, on `feat/detailed-cc-ar-reconciliation`, unpushed.

- [x] The sidecar CSV row's `TAX INVOICE NO`, fee, VAT and net are compared against
      `extracted.doc_no` and `extracted.total_row`'s corresponding fields
      (`kbank_tax_summary.cross_check`, called from `_run_document` right after the existing
      CSV-row lookup, so it only ever runs when a CSV row actually matched).
- [x] Any mismatch appends a warning to `extracted.warnings` (the same list
      `_normalize_ar_settlement`'s own checks use) rather than raising or skipping — a non-empty
      `warnings` list already parks the document via the existing flag machinery. No new wiring
      needed there; `_review_flags` already turns any `extracted.warnings` into the `warnings`
      flag.
- [x] One warning per mismatched field (`csvTaxInvoiceMismatch`/`csvFeeMismatch`/
      `csvVatMismatch`/`csvNetMismatch`), each naming both numbers. Same 0.02-baht tolerance
      `credit_card_service.py` uses for its own checks. A field that doesn't parse on either
      side is silent, not a false alarm — mirrors `_normalize_ar_settlement`'s own pattern.
- [x] Test: `test_kbank_tax_summary.py` — one disagreeing figure → exactly one warning naming
      both numbers; a matching fixture (including a 1-satang gap within tolerance) → none; a
      missing total row or an unparseable figure → silent. `test_ar_ingest_pipeline.py` —
      end-to-end: a disagreeing CSV parks with the `warnings` flag and the one warning in
      `review_payload`; an agreeing CSV posts clean.
- [x] ~~Frontend copy for the new warning codes~~ — deliberately deferred: `warningText()`
      (`lib/reviewReasons.ts`) already falls back to printing the bare code for anything
      missing from `dict.ts`, the same graceful path an unfamiliar `legacy` warning takes. Not
      a ticket-05 criterion; add EN/TH copy whenever someone is next in that file.
- [x] Changelog entry in the same commit.
