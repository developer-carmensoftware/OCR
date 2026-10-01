# 07: Review-flag and settings-screen cleanup

**What to build:** Remove what the new shape makes dead, and finish surfacing what it makes real,
in both the reviewer's queue and the AR settings screen.

**Blocked by:** 03 (Combined JV — `is_balanced` becomes real, `control_leg_missing` is deleted),
04 (TIN second factor — `tin_unverified` must exist to be labeled)

**Status:** done — 2026-09-18, on `feat/detailed-cc-ar-reconciliation`, unpushed. Backend
bullet was already done, pulled forward into ticket 03 (2026-09-18) because
`email_ingest_service.py` imports `control_leg_missing` directly and could not stay green
once ticket 03 deleted it.

- [x] ~~Backend: `clearing_account_missing` is removed from `_review_flags`'s AR branch;
      `unbalanced` (from `is_balanced(rows)`, now a real check per ticket 03) is added.~~
      Done in ticket 03's commit — the flag is `ar_unbalanced` → `"unbalanced"`, and
      `approve_document`'s gate is `not built.balanced`.
- [x] Frontend: `ARReconcileSettings.tsx` / `useARReconcile.ts` no longer show the
      clearing-account Dept/Acc pair or its divergence warning; in its place, the three fixed
      debit mappings (`commission`/`tax`/`net`, fetched from `getAccountingConfig()` — one
      config per tenant, not per bank) are shown read-only with a link to
      `#/CreditCardOCR/mapping`, plus a one-line note telling the BU to point their KBANK
      filename rule at `KB1P554V2_SUM`. `ARJvPreview.tsx` never referenced `control_missing`
      or the debit fields — nothing to change there.
- [x] `ReviewDocument.tsx`'s approve-ladder drops the `control_missing` rung; the
      `!arJv.balanced` rung stays and is now reachable. Also removed `arSettingsFix` — the
      conditional "fix the clearing account" link that rung fed, now permanently unreachable
      (untested and dead, so deleted rather than left inert) — and its dict key
      `review.actionFixClearingAccount`.
- [x] `tin_unverified` and `covered_by_settlement_jv` get queue labels and reviewer copy in
      `lib/reviewReasons.ts` and `i18n/dict.ts` — both `en` and `th`; `npm run build` confirms.
      `covered_by_settlement_jv` gets a `REASON_KEY` entry only, no `FIX` — same as
      `ar_reconcile_disabled`/`no_rule_match`, there is nothing for a reviewer to press on a
      free, pre-charge backstop skip.
- [x] `QueueRow.tsx` reflects the updated reason set: `clearing_account_missing` rung
      removed, `tin_unverified` rung added (ranked beside `doc_no_missing` — both are "we
      could not check" rather than "we read and found a problem").
- [x] `lib/api/arReconcile.ts`/`emailReview.ts` TS types cleaned to match: `ARSettings`/
      `ARPreviewRequest` drop `debit_dept_code`/`debit_account_code` (the wire fields still
      exist server-side, unread, per decision #28 — just no longer typed or sent from here);
      `ARPreview` drops `control_missing`; `ReviewFlag` swaps `clearing_account_missing` for
      `tin_unverified`.
- [x] Test: `ARReconcileSettings.test.tsx`'s clearing-account-divergence test rewritten for
      the read-only display (mocks `getAccountingConfig`); `ReviewQueue.test.tsx` gained a
      `tin_unverified` case in the parametrized message-column ladder; `is_balanced() ==
      False` parking and labeling was already covered by the existing `unbalanced` case.
      Full frontend suite: 761 passed; `npm run build` succeeds (proves both `en`/`th` carry
      every new key).
- [x] Changelog entry in the same commit.
