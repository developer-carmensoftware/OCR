# 04: TIN second factor

**What to build:** The settlement report's merchant ID is used to look up its TIN in the sidecar
CSV map (ticket 01), which is fed into the *existing* `foreign_tax_id` conflict check — so a
settlement report from a merchant registered to a different BU is caught exactly as a fee invoice
already is. A report with no CSV alongside it is never rejected, but is prevented from
auto-posting.

**Blocked by:** 01 (CSV sidecar ingestion)

**Status:** ready-for-agent

- [ ] For a settlement report, `extracted.merchant_id` (digits only) is looked up in the
      message's parsed CSV sidecar map; a hit appends that row's TIN to `extracted.tax_ids`
      before the existing `foreign_tax_id(...)` call runs.
- [ ] A miss (no CSV, or no matching merchant ID in it) sets a new flag `tin_unverified` rather
      than raising anything.
- [ ] `_review_flags`'s AR branch includes `tin_unverified` in the flags it returns, so
      `not auto_post or flags` blocks unattended posting — the document still parks and can be
      approved by a human in one click.
- [ ] Test: a settlement zip whose CSV row's TIN belongs to a different BU parks as
      `tax_id_mismatch` (the existing, unmodified check, now reachable for this document type).
      A settlement zip with no CSV parks with `tin_unverified` and is confirmed never to
      auto-post even when the BU's `auto_post` is true.
- [ ] Changelog entry in the same commit.
