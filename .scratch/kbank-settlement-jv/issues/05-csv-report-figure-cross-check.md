# 05: CSV vs. report figure cross-check

**What to build:** Once both the CSV (ticket 01) and the report's own total row (ticket 03) are
available, three more numbers are free to check — the tax invoice number, and the commission,
VAT and net the CSV reports for this merchant, against what the settlement report itself
printed. A disagreement is not rejected; it's surfaced to a reviewer as a warning, the same way
every other reconciliation check in this pipeline already behaves.

**Blocked by:** 01 (CSV sidecar ingestion), 03 (Combined JV — needs `total_row`)

**Status:** ready-for-agent

- [ ] The sidecar CSV row's `TAX INVOICE NO`, fee, VAT and net are compared against
      `extracted.doc_no` and `extracted.total_row`'s corresponding fields.
- [ ] Any mismatch appends a warning to `extracted.warnings` (the same list
      `_normalize_ar_settlement`'s own checks use) rather than raising or skipping — a non-empty
      `warnings` list already parks the document via the existing flag machinery.
- [ ] Test: a fixture where the CSV disagrees with the report on one figure produces exactly one
      warning naming both numbers; a fixture where they agree produces none.
- [ ] Changelog entry in the same commit.
