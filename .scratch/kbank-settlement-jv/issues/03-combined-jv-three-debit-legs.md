# 03: Combined JV — three debit legs, drop the control leg

**What to build:** The settlement report's own JV becomes self-sufficient: `Dr.` commission /
`Dr.` input tax / `Dr.` bank account (read from the report's own total row), `Cr.` one line per
card scheme (read from the report's per-payment-type rows) — replacing the derived single
control leg that depended on a second document (the e-tax invoice) ever posting. This is the
spine ticket everything else in this feature hangs off.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `ExtractedCreditCardData` gains a `total_row` field (reuse `ExtractedDetailRow` — no new
      schema type) that survives past `_normalize_ar_settlement`'s row filter, so
      `review_payload` retains it for approve-time JV rebuilding.
- [ ] `ar_reconcile_jv.build_ar_jv_rows` emits three fixed debit legs (`commission`, `tax`, `net`)
      read from `total_row`'s commission/VAT/net columns and the BU's *existing* credit-card GL
      mapping (`bu_accounting_mapping_entries`) — not a new mapping table — instead of one
      derived control leg. Keep the per-scheme credit legs, the negative-group side-swap, and
      `render_jv_description` unchanged.
- [ ] `unmapped_ar_types` also requires the three fixed keys to be mapped, mirroring
      `cc_jv.unmapped_payment_types`'s existing pattern for the wizard.
- [ ] `control_leg_missing` is deleted; `is_balanced`'s docstring is corrected — it is no longer a
      tautology, because credits (per-row THB) and debits (the anchor row's three totals) are now
      independent readings of the same page.
- [ ] `ar_reconcile_service.jv_for_document` and `POST /ar-reconcile/preview` reflect the new
      shape; `ARPreviewOut.control_missing` is dropped.
- [ ] `ar_reconcile_settings.debit_dept_code`/`debit_account_code` are left in place, unread — so
      the split (two-JV) shape could return later without a migration.
- [ ] Test: rebuilt `test_ar_reconcile_jv.py` against the real worked example (VS 15,471.00 /
      MC 9,320.00 / JCB 300.00 credit legs; commission 582.99 / tax 40.81 / net 24,467.20 debit
      legs; Σdebit = Σcredit = 25,091.00).
- [ ] Docs: FRD v1.2 §6.1 replacement text drafted (markdown, ready to paste into the
      customer-facing `.docx`) recording that the two-JV shape is superseded and why. Decision
      recorded as entry #28 in `docs/email-automation/06-decision-log.md`.
- [ ] Changelog entry in the same commit.
