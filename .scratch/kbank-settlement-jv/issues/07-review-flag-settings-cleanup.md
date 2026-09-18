# 07: Review-flag and settings-screen cleanup

**What to build:** Remove what the new shape makes dead, and finish surfacing what it makes real,
in both the reviewer's queue and the AR settings screen.

**Blocked by:** 03 (Combined JV — `is_balanced` becomes real, `control_leg_missing` is deleted),
04 (TIN second factor — `tin_unverified` must exist to be labeled)

**Status:** ready-for-agent

- [ ] Backend: `clearing_account_missing` is removed from `_review_flags`'s AR branch;
      `unbalanced` (from `is_balanced(rows)`, now a real check per ticket 03) is added.
- [ ] Frontend: `ARReconcileSettings.tsx` / `useARReconcile.ts` / `ARJvPreview.tsx` no longer
      show the clearing-account Dept/Acc pair or its divergence warning; in its place, the three
      fixed debit mappings (`commission`/`tax`/`net`) are shown read-only with a link to the
      existing Mapping page, plus a one-line note telling the BU to point their KBANK filename
      rule at `KB1P554V2_SUM`.
- [ ] `ReviewDocument.tsx`'s approve-ladder drops the `control_missing` rung; the
      `!arJv.balanced` rung stays and is now reachable.
- [ ] `tin_unverified` and `covered_by_settlement_jv` get queue labels and reviewer copy in
      `lib/reviewReasons.ts` and `i18n/dict.ts` — **both `en` and `th`**, or the build fails.
- [ ] `QueueRow.tsx` reflects the updated reason set.
- [ ] Test: the settings screen no longer renders a clearing-account field; a document with
      `is_balanced(rows) == False` parks and is labeled correctly in the queue.
- [ ] Changelog entry in the same commit.
