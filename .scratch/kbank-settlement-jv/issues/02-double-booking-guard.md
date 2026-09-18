# 02: Double-booking guard (covered_by_settlement_jv)

**What to build:** Once combined-mode AR reconciliation is live for a bank, its ordinary
commission fee invoice must never also be processed as its own document — that would book the
same commission twice, once in the combined JV and once in the fee-invoice's own JV.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] In `email_ingest_service.py`, alongside rule resolution and before `consume_document`, a
      fee-invoice attachment whose bank has AR reconciliation enabled (`ar_reconcile_settings.enabled`
      for that bank) is skipped with a new reason code `covered_by_settlement_jv`.
- [ ] The skip costs no credit — it fires before `consume_document`, like the existing
      `no_rule_match` skip.
- [ ] This guard is the defensive backstop, not the primary mechanism: the primary fix is the BU
      repointing its KBANK filename rule at `KB1P554V2_SUM` so the fee invoice matches no rule at
      all (`no_rule_match`, also free). Add a one-line note to the AR settings screen saying so.
- [ ] No dependency on the combined-JV arithmetic change (ticket 03) — this only reads whether AR
      reconciliation is enabled for the bank, which already exists in the current schema.
- [ ] Test: a KBANK fee-invoice attachment with AR reconciliation enabled for KBANK is skipped as
      `covered_by_settlement_jv` with zero credits charged; with AR reconciliation disabled for
      that bank, it processes normally (regression check).
- [ ] Changelog entry in the same commit.
