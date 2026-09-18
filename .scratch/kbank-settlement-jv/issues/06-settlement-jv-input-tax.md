# 06: Settlement JV posts its own input-tax record

**What to build:** Since the fee invoice (which used to file this) is no longer processed, the
settlement JV must file the commission's VAT claim itself, or it silently disappears.

**Blocked by:** 03 (Combined JV — needs `total_row`)

**Status:** ready-for-agent

- [ ] On approve/auto-post of a settlement document, `build_input_tax_payload` is called with
      `details=[extracted.total_row]` — no change to `cc_input_tax.py` itself; the function
      already sums `commis_amt`/`tax_amt` over whatever rows it's given.
- [ ] Posting the input-tax record is non-fatal to the JV — a failure here is recorded (the same
      failure-note convention the fee-invoice path already uses), never rolls back or blocks the
      JV that already posted.
- [ ] Both the unattended `_run_document` path and the human `approve_document` path post it.
- [ ] Test: approving the real worked example produces an input-tax record with base 582.99, VAT
      40.81, and KBank's registered legal name/TIN/address (read from the `banks` table, not the
      document).
- [ ] Changelog entry in the same commit.
