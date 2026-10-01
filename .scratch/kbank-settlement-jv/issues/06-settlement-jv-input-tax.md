# 06: Settlement JV posts its own input-tax record

**What to build:** Since the fee invoice (which used to file this) is no longer processed, the
settlement JV must file the commission's VAT claim itself, or it silently disappears.

**Blocked by:** 03 (Combined JV — needs `total_row`)

**Status:** done — 2026-09-18, on `feat/detailed-cc-ar-reconciliation`, unpushed.

- [x] On approve/auto-post of a settlement document, `build_input_tax_payload` is called with
      `details=[extracted.total_row]` — no change to `cc_input_tax.py` itself; the function
      already sums `commis_amt`/`tax_amt` over whatever rows it's given. `_post_input_tax` gained
      a `details: list[ExtractedDetailRow] | None = None` param (default `None` → unchanged
      `extracted.details` for every other document type) rather than branching on `doc_type`
      inside that function.
- [x] Posting the input-tax record is non-fatal to the JV — unchanged: still the same
      `_post_input_tax`/`build_input_tax_payload` machinery every other document type goes
      through, and AR now goes through it too instead of being skipped entirely.
- [x] Both the unattended `_run_document` path and the human `approve_document` path post it —
      both dropped their `doc_type != DocType.AR_RECONCILE` guard and now compute
      `[extracted.total_row] if extracted.total_row else []` for the AR case.
- [x] Test: `test_settlement_report_input_tax_uses_the_real_worked_example`
      (`test_ar_ingest_pipeline.py`) calls `_post_input_tax` for real (only `post_input_tax`,
      the actual Carmen call, is mocked) and asserts the built payload — base 582.99, VAT 40.81,
      `VnName`/`TaxId`/`Address` from a fake `banks` row, never from the document. Plus wiring
      tests on both paths (`test_ar_files_its_own_input_tax_from_the_total_row`,
      `test_a_settlement_report_files_its_own_input_tax_record`,
      `test_a_settlement_report_with_no_total_row_claims_nothing`,
      `test_a_failed_input_tax_post_does_not_block_the_ar_jv`).
- [x] Changelog entry in the same commit.
