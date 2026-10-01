# 04: TIN second factor

**What to build:** The settlement report's merchant ID is used to look up its TIN in the sidecar
CSV map (ticket 01), which is fed into the *existing* `foreign_tax_id` conflict check — so a
settlement report from a merchant registered to a different BU is caught exactly as a fee invoice
already is. A report with no CSV alongside it is never rejected, but is prevented from
auto-posting.

**Blocked by:** 01 (CSV sidecar ingestion)

**Status:** done — 2026-09-18, on `feat/detailed-cc-ar-reconciliation`, unpushed. Combined
with ticket 01 in the same pass. Full backend suite: 1366 passed, 0 failed.

- [x] For a settlement report, `extracted.merchant_id` (digits only) is looked up in the
      message's parsed CSV sidecar map; a hit appends that row's TIN to
      ~~`extracted.tax_ids`~~ **a local `tax_ids_to_check` list, not `extracted.tax_ids`
      itself** — that field is documented as "every tax ID *printed on the document*",
      and a CSV-sourced ID never is; mutating it would make that claim false for anything
      reading the persisted `review_payload` later. Functionally identical for
      `foreign_tax_id`, which only ever sees the list.
- [x] A miss (no CSV, or no matching merchant ID in it) sets a new flag `tin_unverified` rather
      than raising anything.
- [x] `_review_flags`'s AR branch includes `tin_unverified` in the flags it returns, so
      `not auto_post or flags` blocks unattended posting — the document still parks and can be
      approved by a human in one click.
- [x] Test: a settlement zip whose CSV row's TIN belongs to a different BU parks as
      `tax_id_mismatch` (the existing, unmodified check, now reachable for this document type) —
      `test_a_tin_conflict_via_csv_parks_as_tax_id_mismatch`. A settlement zip with no CSV parks
      with `tin_unverified` and is confirmed never to auto-post even when the BU's `auto_post` is
      true — `test_no_csv_sidecar_parks_as_tin_unverified_and_never_auto_posts`. Plus the clean
      case (`test_a_verified_merchant_feeds_its_tin_into_the_existing_check`) and wrong-merchant
      (`test_a_csv_for_a_different_merchant_is_the_same_as_no_csv_at_all`), all in
      `test_ar_ingest_pipeline.py`.
- [x] Changelog entry in the same commit.
