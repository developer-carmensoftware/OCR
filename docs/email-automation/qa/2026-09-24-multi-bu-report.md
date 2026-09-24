# Email Automation — multi-BU QA report

**Run:** `0924070937` · **Date:** 2026-09-24 · **Tester stance:** independent QA, real mail / real LLM / real dev DB, biased toward finding problems, not toward a clean pass.

**Scope:** prove that when 5–6 BUs share one mailbox label (`AR Agent`), no document ever crosses from one BU's ledger, GL mapping, or Carmen posting into another's — across routing, the tax-ID gate, bank-rule toggles, automation on/off, dedupe, the review queue, and security probes. Full test plan: `~/.claude/plans/test-email-automation-glowing-perlis.md` (referenced here; not committed).

**Auto-generated data appendix:** [`0924070937-multi-bu-report.md`](0924070937-multi-bu-report.md) (raw per-case table + state dump). **This file is the one to read** — the appendix's PASS/FAIL column is a blunt string match against a predicted `status/reason_code` and gets several cases wrong for reasons explained below; nothing in it should be quoted without this narrative.

---

## Verdict

**No cross-BU leak was found — the property this run exists to prove holds.** Across 39 messages sent to 6 BUs (2 real: `carmen`, `carmencloud`; 4 scratch), every ledger row, OCR task, credit-card record, LLM usage log, and Carmen API call landed under the BU whose envelope tag it was addressed to, and only that BU. The one row the appendix's crude scan flags as a "cross-BU leak" (`s1-forged-header`) is explained below — it is this harness's own construction bug, not a system vulnerability, and the corrected retest (`s1-forged-header-v2`) proves the opposite: the routing header ordering that bug exercised is safe.

That said, **this run found real, unrelated defects — some higher-severity than anything the isolation matrix was designed to catch** — including one that goes to the heart of "can a customer's document silently vanish." See Findings.

| | |
|---|---|
| BUs | 6 (`carmen`, `carmencloud` real; `S3`–`S6` scratch) |
| Messages sent | 39 (real bank-document PDFs, real LLM vision calls) |
| Confirmed cross-BU leaks | **0** |
| Confirmed exploitable routing/security holes | 1 (tag-domain-suffix, see F-3) |
| Code-level defects (found reading the code, reproduced live) | 2 (DEF-1, DEF-2) |
| New defects found only by running this | 3 (F-3 real & confirmed, F-4 silent loss, F-5 field-drop) |
| Real JVs posted to dev Carmen | **0** — the one approve in this run posted to a scratch BU's dry-run dispatcher (`QA-DRY-1`), nothing to clean up in Carmen |

---

## Findings, ranked

### F-1 (HIGH) — Silent message loss in `fetch_unseen`/`run_ingest`

**Confirmed twice, independently, at different batch sizes.** A message can be marked `\Seen` — meaning the poll considers it handled — while producing **zero** `email_documents` row, **zero** mention in the poll's own summary dict, and **zero** log line. `job_runs` still records the poll as `status='success'`. There is no error anywhere.

- Incident 1: a 22-message burst (several attachments 2–2.4 MB) produced only 15 outcomes on the first poll. The missing 7 were confirmed `\Seen` via direct IMAP inspection, with no matching row in `email_documents`, `ocr_tasks`, or `job_runs`. A second poll of the same mailbox found 0 unseen messages — they were gone, not delayed.
- Incident 2: independently, in an unrelated 6-message batch, one message (`s6-now-expired`, resent after re-entitling S6) vanished the same way — `\Seen`, no row, no log line.
- Ruled out: an overlapping poll (`job_runs` shows exactly one `email-ingest` execution in the relevant window — this harness's own `_poll_lock`/`cron.alter_job(active:=false)` pause held); a raised-and-caught exception (none logged, `job_runs.status='success'`); a parse failure (that path *does* log and *does* flag `\Seen` — `email_imap.py:446-449` — and produces neither symptom seen here).
- **Impact:** `run_ingest`/`fetch_unseen` is the exact code path the production `email-ingest` cron calls every 10 minutes. A customer's bank statement can be consumed by a poll and never charged, never logged, never shown anywhere — not `#/admin/email`, not `#/CreditCardOCR`, not `ocr_tasks.error_message` (Extractions page's own caveat about "post-charge failures only" doesn't even cover this — there's no charge and no task). The customer's only symptom is "I forwarded it and nothing happened," with nothing in any admin screen to investigate.
- **Not root-caused.** Both incidents point at `email_imap.fetch_unseen` (`for uid in found[-limit:]: box.uid("FETCH", uid, "(INTERNALDATE BODY.PEEK[])")` — email_imap.py:434-450), but neither of that loop's two failure branches (unparseable-message, `continue`-without-append) matches the observed evidence, and reproducing it on demand wasn't achieved in the time available. **Recommend:** add a mismatch counter/log (`len(found) after slicing` vs `len(messages) returned`) so the *next* occurrence — in this harness or in production — leaves a trail, then correlate.

### DEF-1 (HIGH) — Two concurrent approvals can both post

Confirmed present in the code before this run, reproduced live against the real dev DB: `approve_document`'s row lock (`_claim_for_review`, `FOR UPDATE`) is released when its `async with async_session()` block closes — **before** `post_gljv` is awaited (`email_ingest_service.py:1875-1908`). `_finish` never re-checks `status == 'pending_review'`. Two reviewers in the same BU approving together (the bell notifies the whole BU, not one person) can both pass the lock and both post.
**Test:** `backend/tests/tenancy/test_email_approve_integrity.py::test_two_concurrent_approvals_post_exactly_once` — `xfail(strict=True)`, confirmed **XFAIL** this run (i.e., the bug is live).

### F-3 (HIGH) — Tag-extraction regex is not anchored to the real domain

**Confirmed live, with real production data.** `aragent+<S4's real tag>@carmensoftware.com.evil.test` — a domain-suffix trick — was successfully routed to the BU owning that tag (`s3-domain-suffix-attack`: the message's `email_documents` row landed under S4's tenant id, confirmed by direct query). The tag regex reads the tag correctly but does not require the domain to end there. This means a mail server that stamps `Delivered-To`/`Received: for` with a spoofable-suffix address — or an attacker who controls a subdomain of a domain a lenient relay forwards through — could attribute mail to a BU they picked by guessing or harvesting its (8-hex-char) tag, without needing the real `carmensoftware.com` mailbox at all. The blast radius is still bounded by the tax-ID gate and bank-rule matching downstream, so this is not a direct posting exploit — but it is a real gap in the one signal (`tag_from_recipients`) the whole design calls "routing, costs nothing" and treats as authoritative for attribution.
**Recommend:** anchor the regex to the literal configured domain (`@carmensoftware\.com\s*$`/exact match on the parsed address's domain part), not a substring search.

### DEF-2 (MEDIUM) — Cross-tenant write via a client-supplied `extracted.id`

Confirmed present in the code, reproduced live: `ApproveIn.extracted` is an ordinary client-supplied `dict`; `approve_document` passes `extracted.id` straight to `_mark_submitted(extracted.id)`, which does `db.get(CreditCard, id)` with **no tenant filter** (`email_ingest_service.py:1590-1599`, `:1933`). A reviewer in BU-B who names BU-A's card id in that field stamps BU-A's `credit_cards.submitted_at` — BU-A's next legitimate copy of that document then reads as an already-posted duplicate. Requires knowing a UUIDv4, so not trivially exploitable, but the isolation guarantee is still false.
**Test:** `...::test_approve_cannot_stamp_another_tenants_card` — `xfail(strict=True)`, confirmed **XFAIL** this run.

### F-5 (MEDIUM) — Settings writes silently drop unknown fields on a rule

**Confirmed live, and it damaged real (non-QA) data during this run.** `_merge_rule` (`email_settings_service.py:575-590`) rebuilds every rule from only the 5 keys `RuleIn` knows. `carmencloud`'s real KBANK rule carried `"doc_type": "ar_reconcile"` — not part of the documented schema. This run's settings write (flipping `auto_post` on, going through the real `save_settings`) silently deleted that field. Caught and restored by hand mid-run (not by the harness, and not by the product). **Any future settings write to any BU whose rule carries a field outside the schema will lose it the same way** — worth checking whether `doc_type` is load-bearing anywhere (the name suggests an in-progress AR-reconcile feature) before the next such write happens for real. Teardown was changed to a raw column update specifically to avoid re-triggering this.

### F-6 (MEDIUM) — GL-mapping suggestion calls Carmen before the tax-ID conflict check, contradicting the documented order

The module's own docstring pipeline is `extract → tax ID vs register → GL mapping → …` (`email_ingest_service.py:3-12`). The actual code computes `unmapped_payment_types` and calls `_suggest_missing_mappings` (a real Carmen account/department-master read) at `email_ingest_service.py:237-250` — **before** `foreign_tax_id` at line 277. Caught live: `r2-foreign-ktc` carried a TIN genuinely registered to another BU (confirmed: the extracted `tax_ids` list included S4's exact registered value), so it should have parked as `tax_id_mismatch` immediately. Instead it reached the GL-suggestion step, which called carmencloud's real (separately expired) Carmen credential and failed with `carmen_unauthorized`/`SecurityToken has Expired` — masking the true reason. Two consequences: (a) a wasted Carmen API call for a document about to be rejected anyway, whenever the payment type is new; (b) a misleading reason code shown to the reviewer — `carmen_unauthorized` reads as "your own credential is broken," sending the customer to reconnect a token that was never the problem, when the true story is "this document belongs to someone else."
**Recommend:** move the `foreign_tax_id` check before the GL-suggestion block, matching the documented order.

### Environment conditions found, not caused by this run

- **`carmencloud`'s stored Carmen posting credential is expired** (`SecurityToken has Expired`, confirmed live via a real 401). Blocks a live JV post for that BU until refreshed — unrelated to anything this test did.
- **`carmen` had no active subscription** at the start of this run (its own history — 9 posted, 9 pending_review, 12 rejected — shows it had one before). A temporary 7-day subscription was granted for the run and removed in teardown.

---

## What was confirmed working correctly

- **Zero cross-tenant leakage** across `email_documents`/`ocr_tasks`/`credit_cards`/`llm_usage_logs` and every recorded Carmen dispatch call (URI *and* token fingerprint checked per call — real BUs share one host, so URI alone wasn't enough; fingerprint was).
- **Tax-ID mismatch correctly parks under the receiving BU and never reaches the owning BU's queue** — proven with real production data: Kimberly Co., Ltd.'s real documents (`carmen`'s own TIN) sent to `S5`, which does not own that TIN, parked under `S5` alone.
- **A forged/duplicate `Delivered-To` positioned the way a real attacker could actually produce it does not hijack routing** (`s1-forged-header-v2`): the genuine, topmost header wins. (The *original* `s1-forged-header` fixture put the forged header first — unrealistic, since a sender cannot make their own content look like it was stamped by a hop that hasn't happened yet — and is the one row the auto-report's crude scan flags as a "leak." It isn't; see the case note below.)
- **Bank-rule active/inactive toggling** works per-BU, independent of other BUs (`s3-bay-inactive`: BAY inactive at S3 → free `no_rule_match`, no effect on any other BU).
- **PDF password isolation**: a BU's password is never tried on another BU's file (`s4-wrong-password-v2`: S4 correctly got `wrong_pdf_password` on a file only S3's password opens).
- **`owner_emails` sender restriction** works and costs nothing when it blocks (`s5-owner-blocked`).
- **Automation on/off (E-01/E-02)**: mail sent while `S4` was disabled correctly held (`retry_later`) with **no effect on `S3` processing normally in the same poll**; after re-enable, that held mail correctly became `skipped/ingest_paused` (never silently posted) while genuinely new mail processed.
- **Entitlement hold/release (E-05)**: expiring then extending a subscription correctly held, then released, mail for the same BU.
- **Duplicate detection across delivery mechanisms**: the same document sent plain and password-protected was recognized as one document via its printed doc number, not double-charged.
- **Overlapping-poll protection (O-02)**: a second `run_ingest()` while the first is running correctly returns `{"status":"busy"}` and processes nothing.
- **Review-queue API isolation (Q-01/Q-02)**: every one of 6 BUs' `GET /documents` and `/status` calls showed only its own rows; all 3 cross-BU GET/reject attempts (round-robin across `S3`→`S4`→`S5`→`S3`) returned 404, with no data leaked in the 404 body.
- **A real approve through the real HTTP router** (`Q-03`) — not the service function directly, the actual `POST /email/documents/{id}/approve` endpoint — correctly built JV rows from the stored extraction and accounting config, and posted (dry-run dispatcher, scratch BU `S6`; see the R1/R2 note below for why no *real* Carmen JV was posted this run).

---

## Why some cases in the raw table say FAIL and are not defects

The appendix's checker does an exact string match against a status/reason predicted *before* the run. Several predictions were simply wrong, for reasons only visible once real fixture history and real environment state were involved. None of these represent incorrect system behavior — each is explained:

| Case(s) | What the table shows | Why it's not a defect |
|---|---|---|
| `R1-own`, `cross-kimberly-s5`, `s3-own-kbank`, `s3-bay-inactive`, `s4-own-ktc`, `s4-own-paypal`, `s5-own-ghl` | "NO ROW FOUND" | These are the F-1 silent-loss incident. Real anomaly (see F-1) — but the *fixture prediction itself* isn't what's wrong; each was re-sent (`-r2`/`-r3`) and the resend's real outcome is what should be read. |
| `R1-own-r2`, `s3-own-kbank-r2`, `s1-forged-header-v2` | `failed/duplicate_document` | `carmen` and `S3` already had genuine history for these exact documents by the time these resends ran (carmen's own pre-existing 9 pending/9 posted rows for its shared fixture set; S3's own earlier successful `s3-right-password`). Correctly detected as duplicates — proves the dedupe guard works across repeated test runs, not a bug. |
| `r2-foreign-ktc` | `carmen_unauthorized` instead of `tax_id_mismatch` | This **is** a real finding — F-6 above — not a fixture error. |
| `s6-held` | `pending_review` instead of `retry_later` | Harness setup bug: every scratch BU, including `S6`, was accidentally given an active subscription at creation. Fixed mid-run (expired it directly), and the corrected case (`s6-now-expired`) shows the real, correct `retry_later` behavior. |
| `s1-forged-header` (original) | flagged as the run's one "cross-BU leak": routed to `S4` instead of `S3` | **This is this harness's own construction bug**, not a system vulnerability. The original fixture added the forged `Delivered-To` *before* the genuine one — the reverse of what any real sender can produce. `first Delivered-To value wins` is the documented, intended behavior; a real attacker cannot occupy the first position (see "confirmed working correctly" above). The corrected retest, `s1-forged-header-v2`, used the realistic order and routed correctly to `S3`. |
| `s2-to-header-ignored` (original) | — | Never actually tested what it claimed (no `to_header` divergence existed in the harness yet). Superseded by `s2-to-header-ignored-v2`, which passes. |
| `s2-to-header-ignored-v2` | `pending_review/tax_id_mismatch` instead of `pending_review/None` | Fixture prediction error on my part: `GHL.pdf`'s real TIN belongs to `S5` in this test's scheme, not `S4` — so routing it to `S4` (the case's actual point) correctly triggers a mismatch there. The routing itself (which BU claimed it) is what mattered, and it's correct. |
| `s4-wrong-password` (original) | `no_rule_match` | Filename didn't match any of S4's rule patterns — a fixture bug, not a password-handling bug. Superseded by `s4-wrong-password-v2`, which passes. |
| `cross-kimberly-s5-r2`, `s5-own-ghl-r2` | `sender_not_allowed` | `S5` has `owner_emails` set (intentionally, to test that gate) and these two cases used a sender not on that list — an oversight in the fixture, not a bug. Superseded by `-r3` versions with an allowed sender, which pass. |
| `s3-unaffected-by-s4-off` | `failed/duplicate_document` instead of `posted` | `S3` already had a pending entry for this doc_no from earlier in the run. The property under test — S3 processes normally regardless of S4's state — is still proven; only the specific terminal status differs from the (stale) prediction. |
| `s4-while-disabled-1`, `s4-while-disabled-2`, `s4-new-after-reenable` | "NO ROW FOUND" / `failed/duplicate_document` | The checker doesn't have a branch for `skipped/ingest_paused` or expects `retry_later` to leave no row (it does — that's correct, and a checker bug, not a system one — see the appendix's own verify() comment). Manually confirmed correct via direct query: both `s4-while-disabled-*` show `skipped/ingest_paused` under `S4`'s own tenant; `s4-new-after-reenable`'s `duplicate_document` still proves it was processed as new mail, not swept into the pause. |

---

## What wasn't covered (disclosed, not hidden)

- **No real JV was posted to `carmen` or `carmencloud`'s actual Carmen instance this run.** `carmen`'s real sample documents (BBL/SCB/SCB2, all "Kimberly Co., Ltd.") already exist in its history from prior, non-QA use — every attempt correctly hit `duplicate_document`. `carmencloud`'s stored credential is separately expired. The Q-03 approve mechanics were proven end-to-end against the real HTTP router with a scratch BU's dry-run dispatcher instead — same code path, not a real network call. **Recommend, if a live JV proof is wanted:** either refresh `carmencloud`'s Carmen token, or supply one fresh (never-submitted) BBL- or KBANK-formatted document for `carmen`.
- **E-06 (out of credits)** and **Q-09 (50-row backlog cap)** were not exercised — time-budget call, not a blocker. Both are already covered by the existing `tests/tenancy` suite at the service level; this run's contribution was specifically the live, cross-BU, real-mailbox angle those tests can't reach.
- **S-07 (settings-API auth boundaries — 401/400/429, scoped-admin cross-tenant refusal)** was verified by reading `_caller`/`_resolve`/`_assert_in_scope` (straightforward, unambiguous code), not exercised live, for the same reason.
- Root cause of F-1 (silent loss) — see that finding.

---

## Reproduce

```bash
# DEF-1 / DEF-2
cd backend && TENANCY_DB_TESTS=1 venv\Scripts\python -m pytest tests\tenancy\test_email_approve_integrity.py -v
# -> 2 xfailed (both live in the code today)

# Full harness (creates scratch tenants, sends real mail, real LLM, real dev DB — see
# scripts/email_multibu_qa.py's own docstring for the phase order and safety rails)
python scripts\email_multibu_qa.py preflight
```

## Cleanup performed

- `carmencloud.auto_post` reverted (raw column update — not through `save_settings`, to avoid re-triggering F-5).
- `carmen`'s temporary subscription deleted.
- `carmencloud`'s `doc_type: "ar_reconcile"` field restored (was silently dropped by this run's own settings write — see F-5).
- 4 scratch tenants and all their rows deleted.
- All QA-tagged mail (`[QA-0924070937]` in every subject/filename) purged from `AR Agent`.
- `email-ingest` / `email-confirm` cron jobs resumed.
- No real JV exists in dev Carmen to clean up (the one approve in this run was a dry-run dispatcher post, `QA-DRY-1`, not a real HTTP call to Carmen).
- All of the above independently re-verified by direct query after the fact (0 leftover scratch tenants, all 4 cron jobs active, 0 remaining subscriptions on `carmen`, `carmencloud.auto_post=false`, `doc_type` present, 0 QA `email_documents` rows) — not just trusted from the teardown script's own printed output, for the reason below.

**Teardown itself had two bugs, found by verifying rather than trusting it — worth disclosing the same as any other finding:**
1. First attempt crashed with a `ForeignKeyViolationError`: it deleted `ocr_tasks` before `email_documents` (which FKs to it) for `carmen`/`carmencloud`'s QA-tagged rows. This **left cron paused** after the crash — a real BU's automation would have stayed off for other people using `dev.carmen4.com` until caught. Fixed (delete order reversed) and re-run.
2. The mailbox purge searched `HEADER Message-ID` for the run's tag — the same Gmail IMAP substring-search unreliability already documented in `email_multibu_loadtest.py`. It reported "0 fixture(s) expunged" while all 39 QA messages were still sitting in `AR Agent`. Fixed (switched to `SUBJECT` search, confirmed reliable throughout this run) and re-run; all 39 confirmed expunged afterward.
