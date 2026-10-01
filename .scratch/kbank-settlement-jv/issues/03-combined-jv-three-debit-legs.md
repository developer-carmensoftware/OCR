# 03: Combined JV — three debit legs, drop the control leg

**What to build:** The settlement report's own JV becomes self-sufficient: `Dr.` commission /
`Dr.` input tax / `Dr.` bank account (read from the report's own total row), `Cr.` one line per
card scheme (read from the report's per-payment-type rows) — replacing the derived single
control leg that depended on a second document (the e-tax invoice) ever posting. This is the
spine ticket everything else in this feature hangs off.

**Blocked by:** None (can start immediately)

**Status:** done — 2026-09-18, on `feat/detailed-cc-ar-reconciliation`, unpushed. Full
backend suite: 1355 passed, 0 failed.

- [x] `ExtractedCreditCardData` gains a `total_row` field (reuse `ExtractedDetailRow` — no new
      schema type) that survives past `_normalize_ar_settlement`'s row filter, so
      `review_payload` retains it for approve-time JV rebuilding.
- [x] `ar_reconcile_jv.build_ar_jv_rows` emits three fixed debit legs (`commission`, `tax`, `net`)
      read from `total_row`'s commission/VAT/net columns and the BU's *existing* credit-card GL
      mapping (`bu_accounting_mapping_entries`) — not a new mapping table — instead of one
      derived control leg. Keep the per-scheme credit legs, the negative-group side-swap, and
      `render_jv_description` unchanged.
- [x] `unmapped_ar_types` also requires the three fixed keys to be mapped, mirroring
      `cc_jv.unmapped_payment_types`'s existing pattern for the wizard.
- [x] `control_leg_missing` is deleted; `is_balanced`'s docstring is corrected — it is no longer a
      tautology, because credits (per-row THB) and debits (the anchor row's three totals) are now
      independent readings of the same page.
- [x] `ar_reconcile_service.jv_for_document` and `POST /ar-reconcile/preview` reflect the new
      shape; `ARPreviewOut.control_missing` is dropped.
- [x] `ar_reconcile_settings.debit_dept_code`/`debit_account_code` are left in place, unread — so
      the split (two-JV) shape could return later without a migration.
- [x] Test: rebuilt `test_ar_reconcile_jv.py` against the real worked example (VS 15,471.00 /
      MC 9,320.00 / JCB 300.00 credit legs; commission 582.99 / tax 40.81 / net 24,467.20 debit
      legs; Σdebit = Σcredit = 25,091.00).
- [x] Docs: FRD v1.2 §6.1 replacement text drafted (markdown, ready to paste into the
      customer-facing `.docx`) recording that the two-JV shape is superseded and why. Decision
      recorded as entry #28 in `docs/email-automation/06-decision-log.md`.
- [x] Changelog entry in the same commit.

**Also touched, not in the original checklist but required to keep the branch green:**
`unmapped_ar_types` gained a `cc_mappings` parameter (4th positional-or-keyword arg) — every
caller updated. `email_ingest_service.py`'s AR branch (`_review_flags`, `approve_document`)
had to change in lockstep with `control_leg_missing`'s deletion, since it was the only
caller outside this feature's own files; `clearing_account_missing` became `ar_unbalanced`
→ `unbalanced`, and `approve_document`'s gate now checks `not built.balanced`. This pulled
forward a small, mechanical slice of ticket 07's backend half (the `unbalanced` flag) — the
frontend half of 07 (removing the settings-screen widget, i18n) is still untouched and
still pending. See `docs/email-automation/06-decision-log.md` #28 and
`changelog/2026-09-18.md`'s 04:28 entry for the full list of touched files.
