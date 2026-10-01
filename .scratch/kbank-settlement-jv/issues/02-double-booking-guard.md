# 02: Double-booking guard (covered_by_settlement_jv)

**What to build:** Once combined-mode AR reconciliation is live for a bank, its ordinary
commission fee invoice must never also be processed as its own document — that would book the
same commission twice, once in the combined JV and once in the fee-invoice's own JV.

**Blocked by:** None (can start immediately)

**Status:** done — 2026-09-18, on `feat/detailed-cc-ar-reconciliation`, unpushed. Built the
freshness-check option from the known-risk note below, not the static-flag-plus-alert one.

- [x] In `email_ingest_service.py`, alongside rule resolution and before `consume_document`, a
      fee-invoice attachment whose bank has AR reconciliation enabled (`ar_reconcile_settings.enabled`
      for that bank) **and has a settlement report proven to have posted recently**
      (`_settlement_recently_posted`, see the known-risk resolution below) is skipped with a new
      reason code `covered_by_settlement_jv`.
- [x] The skip costs no credit — it fires before `consume_document`, like the existing
      `no_rule_match` skip.
- [x] This guard is the defensive backstop, not the primary mechanism: the primary fix is the BU
      repointing its KBANK filename rule at `KB1P554V2_SUM` so the fee invoice matches no rule at
      all (`no_rule_match`, also free). ~~Add a one-line note to the AR settings screen saying
      so.~~ Deferred to ticket 07 (frontend), which already owns the AR settings screen copy —
      no backend blocker.
- [x] No dependency on the combined-JV arithmetic change (ticket 03) — this only reads whether AR
      reconciliation is enabled for the bank, which already exists in the current schema.
- [x] Test: a KBANK fee-invoice attachment with AR reconciliation enabled for KBANK **and a
      settlement report posted within the last 3 days** is skipped as `covered_by_settlement_jv`
      with zero credits charged (`test_a_kbank_fee_invoice_is_skipped_once_its_settlement_report_posted`);
      with AR reconciliation disabled for that bank, it processes normally
      (`test_a_kbank_fee_invoice_posts_normally_when_ar_reconciliation_is_off`, regression check);
      with AR reconciliation enabled but **no recent proof**, it also processes normally rather
      than silently dropping
      (`test_a_kbank_fee_invoice_still_posts_without_recent_proof_of_a_settlement_report`) — plus
      two direct tests of `_settlement_recently_posted`'s own query-result reading. All in
      `test_ar_ingest_pipeline.py`.
- [x] Changelog entry in the same commit.

**Known risk to design around, not just implement past** (decision log #28, added
2026-09-18): a static `enabled` flag is *not* the same fact as "a settlement report was
actually captured today." The settlement report's filename rule matches an exact report
version number (`KB1P554V2`) that KBank could change; if it does, `no_rule_match` swallows
the report silently (deliberately outside `NOTIFIABLE_SKIPS`), and this guard — reading only
the static flag — would *also* silently skip the fee invoice kept as backup, leaving the BU
with zero JVs and no signal. Before shipping this guard, decide one of:
  - skip only when a settlement report has actually posted recently for this bank (a real
    freshness check, not a toggle), or
  - accept the static-flag version but pair it with an alert (e.g. "0 KBANK settlement
    reports processed in N days" on `#/admin/tenants` or `#/admin/email`) so the silence has
    somewhere to surface.
Do not ship the static-flag version with no alerting — that is the exact silent-outage shape
decision #28 warns about.
