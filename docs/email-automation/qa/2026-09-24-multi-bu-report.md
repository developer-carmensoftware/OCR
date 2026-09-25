# Email Automation — multi-BU QA report

**Run:** `0924070937` · **Date:** 2026-09-24 · **Tester stance:** independent QA, real mail / real LLM / real dev DB, biased toward finding problems, not toward a clean pass.

**Scope:** prove that when 5–6 BUs share one mailbox label (`AR Agent`), no document ever crosses from one BU's ledger, GL mapping, or Carmen posting into another's — across routing, the tax-ID gate, bank-rule toggles, automation on/off, dedupe, the review queue, and security probes. Full test plan: `~/.claude/plans/test-email-automation-glowing-perlis.md` (referenced here; not committed).

**Auto-generated data appendix:** [`0924070937-multi-bu-report.md`](0924070937-multi-bu-report.md) (raw per-case table + state dump). **This file is the one to read** — the appendix's PASS/FAIL column is a blunt string match against a predicted `status/reason_code` and gets several cases wrong for reasons explained below; nothing in it should be quoted without this narrative.

---

## Verdict

**No cross-BU leak was found — the property this run exists to prove holds.** Across 39 messages sent to 6 BUs (2 real: `carmen`, `carmencloud`; 4 scratch), every ledger row, OCR task, credit-card record, LLM usage log, and Carmen API call landed under the BU whose envelope tag it was addressed to, and only that BU. The one row the appendix's crude scan flags as a "cross-BU leak" (`s1-forged-header`) is explained below — it is this harness's own construction bug, not a system vulnerability, and the corrected retest (`s1-forged-header-v2`) proves the opposite: the routing header ordering that bug exercised is safe.

That said, **this run found real, unrelated defects — some higher-severity than anything the isolation matrix was designed to catch** — including one that goes to the heart of "can a customer's document silently vanish." See Findings.

> **Corrected 2026-09-24, after root-cause analysis** (same day, before this branch was pushed).
> The first version of this report called F-1 a bug in `fetch_unseen`, framed F-6 as "wrong
> order", and didn't know where F-5's field came from. All three were wrong or incomplete and
> are rewritten below; F-4 is added. Also: every mailbox number quoted during the run
> (296–334) was an IMAP **sequence number** — the diagnostics used `search`/`fetch`, not
> `uid` — the real UIDs were 366–404. No conclusion depended on the difference.

> **Status 2026-09-25: all fixed and re-tested live.** DEF-1/DEF-2 (#251), F-3 (#252),
> F-1/F-4 (#253), F-6/F-5 (#254) are merged; F-1, F-3, F-6, DEF-1 and DEF-2 were re-run
> against real Gmail, a real LLM and the real router — **5/5 pass**. See
> [Re-test after fixes](#re-test-after-fixes-2026-09-25) at the end.

| | |
|---|---|
| BUs | 6 (`carmen`, `carmencloud` real; `S3`–`S6` scratch) |
| Messages sent | 39 (real bank-document PDFs, real LLM vision calls) |
| Confirmed cross-BU leaks | **0** |
| Confirmed exploitable routing/security holes | 1 (tag-domain-suffix, see F-3) |
| Code-level defects (found reading the code, reproduced live) | 2 (DEF-1, DEF-2) |
| New defects found only by running this | 4 (F-1 `\Seen`-as-queue design, F-3 tag boundary, F-5 field-drop, F-6 verdict precedence) + F-4 from code reading |
| Real JVs posted to dev Carmen | **0** — the one approve in this run posted to a scratch BU's dry-run dispatcher (`QA-DRY-1`), nothing to clean up in Carmen |

---

## Findings, ranked

### F-1 (HIGH) — `\Seen` is the ingest queue's only "not yet processed" marker, and anyone can set it

**What was observed, twice:** messages sitting in the mailbox became `\Seen` without the poller ever having returned them — so they got no `email_documents` row, no line in any poll summary, no log line, and `job_runs` still read `success`.

- Incident 1: of a 22-message burst, the 7 oldest (the first ~2 minutes of sending) were already `\Seen` when the first poll ran; the poll returned the other 15.
- Incident 2: one message (`s6-now-expired`), correctly held unread across three earlier polls, was `\Seen` by the next poll five minutes later.

**The poller is ruled out** (this was re-checked after the first version of this report blamed `fetch_unseen`):
- `mark_seen` stores `\Seen` per UID, only for messages the poll returned and reached a verdict on (`email_imap.py:530-555`). The lost messages were never returned, so no call ever named their UIDs.
- The only branch that flags without a verdict is the parse-failure branch (`email_imap.py:442-450`), which logs a warning. None was logged, and the same PDFs parsed fine on resend.
- No second poller ran: `cron.alter_job(active:=false)` took effect at 07:12 UTC (`cron.job_run_details` has no `email-ingest`/`email-confirm` dispatch after it), and `job_runs` holds only this run's own polls for the window.
- The confirmation sweep (which *does* set `\Seen` as a side effect — F-4) searches `FROM forwarding-noreply@google.com`, and Gmail's `FROM` search was checked to be exact: 17 hits, all genuinely from Google. It cannot have matched these bank-sender fixtures, and it was paused anyway.

**So something outside the code marked them read** — a person with the `AR Agent` label open in Gmail, a mail client syncing `project@`, or another deployment reading the same mailbox. Which one was not determined; nobody is known to have had it open.

**Why that is still a HIGH finding:** the pipeline decides what to look at by `SEARCH UNSEEN`, so `\Seen` is its only record of "decided". Any reader other than the poller therefore makes mail vanish silently and permanently — nothing is charged, nothing is logged, nothing appears in `#/admin/email`, `#/CreditCardOCR`, or the Extractions page. In production that includes the most likely reader of all: someone from support opening `AIAGENT@` to find out why a customer's document didn't arrive, which would erase exactly the mail they came to look for. (The original POC had ruled this out explicitly — "don't rely on `\Seen`, a human opening the mailbox breaks it"; the production design reintroduced it for the "what to fetch" decision.)

**Recommend:** a processed-marker only this system writes (an IMAP keyword such as `$OcrDone`), searched as `NOT KEYWORD $OcrDone` instead of `UNSEEN`, so reading the mailbox has no effect on ingestion.

### F-4 (LOW) — The confirmation sweep marks mail read despite saying it doesn't

Code reading, confirmed: `fetch_confirmations` fetches with `(RFC822)` (`email_imap.py:509`), which on Gmail sets `\Seen` as a side effect. Its docstring says "nothing is marked seen here", and `sweep_confirmations` (`email_ingest_service.py:369-371`) relies on confirmations for other tags being "left unseen so the document poll picks it up". They aren't: a confirmation for a BU outside the 24-hour waiting window is consumed and never recorded. Fix alongside F-1 (`BODY.PEEK[]`).

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

**Confirmed live, and it damaged real (non-QA) data during this run.** `_merge_rule` (`email_settings_service.py:575-590`) rebuilds every rule from only the 5 keys `RuleIn` knows. `carmencloud`'s real KBANK rule carried `"doc_type": "ar_reconcile"` — not part of the documented schema. This run's settings write (flipping `auto_post` on, going through the real `save_settings`) silently deleted that field. Caught and restored by hand mid-run (not by the harness, and not by the product). **Any future settings write to any BU whose rule carries a field outside the schema will lose it the same way.** Teardown was changed to a raw column update specifically to avoid re-triggering this.

**Origin (found afterwards):** `doc_type` is written by the unmerged `feat/detailed-cc-ar-reconciliation` branch, which makes it a first-class `RuleIn` field; that branch's code ran against the shared dev DB. So on `main` the root is version skew — code that doesn't know a field destroys it on the next save. The same will happen after that branch merges on any rollback: a settings save from older code would silently turn an AR-settlement rule back into a fee-invoice rule. **Recommend:** `_merge_rule` keeps the previous rule's keys it doesn't own.

### F-6 (MEDIUM) — A dead-token failure in GL suggestion masks the document's own verdict

Caught live: `r2-foreign-ktc` carried a TIN genuinely registered to another BU (the extracted `tax_ids` included S4's exact registered value), so it should have parked as `tax_id_mismatch`. It parked as `carmen_unauthorized` instead — `carmencloud`'s stored credential is separately expired.

**The ordering itself is deliberate** (corrected from the first version of this report, which called it a bug): the GL suggestion runs ahead of the tax-ID and duplicate checks so that a parked document still gets suggested mappings (`email_ingest_service.py:1052-1056`). The module docstring's pipeline order (`:3-12`) is simply stale.

**The real bug is verdict precedence.** The suggester re-raises Carmen 401/403 on purpose, so a dead token isn't mistaken for "mapping missing" (`:1367-1377`); the handler then parks the document as `carmen_unauthorized` (`:1212-1243`). The document-level verdicts (`tax_id_mismatch`, and `duplicate_document` / "Already posted") are never reached. The handler's own comment says why that's wrong: "401/403 is not a verdict on this document at all" (`:1224`). The reviewer is sent to reconnect a credential when the actual story is "this document belongs to someone else".
**Recommend:** decide the document-level verdict before the suggester runs; if the suggester then hits 401/403, still flag the token (BU-level), but park the document under its own verdict.

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
| `R1-own`, `cross-kimberly-s5`, `s3-own-kbank`, `s3-bay-inactive`, `s4-own-ktc`, `s4-own-paypal`, `s5-own-ghl` | "NO ROW FOUND" | These are F-1 incident 1 (marked read by something other than the poller before it ran). Real anomaly (see F-1) — but the *fixture prediction itself* isn't what's wrong; each was re-sent (`-r2`/`-r3`) and the resend's real outcome is what should be read. |
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
- Who or what marked the F-1 messages read — the poller is ruled out, the external reader is not identified (see that finding).

---

## Reproduce

```bash
# DEF-1 / DEF-2
cd backend && TENANCY_DB_TESTS=1 venv\Scripts\python -m pytest tests\tenancy\test_email_approve_integrity.py -v
# -> 2 xfailed on 2026-09-24; since #251 the xfails are gone and all 7 pass

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

---

## Re-test after fixes (2026-09-25)

**Run:** `0925035135` · `main` at `6268ef8` (#251–#254 merged) · same harness, new phases
`fixcheck-setup` → `send --wave fixcheck` → `poll` → `fixcheck` → `teardown`. The test used real
Gmail (`project@` / `AR Agent`), a real LLM and the real dev DB. The approve race went through the
real FastAPI router (`httpx.ASGITransport`). Every verdict below was read back from rows and IMAP
flags after the fact, never from a phase's printed summary.

**Result: 5/5 pass.**

| Case | Set-up that used to fail | Evidence after the fix | Result |
|---|---|---|---|
| **F-1** | Fixture APPENDed **already `\Seen`**, as if a person had opened it before the poll. `SEARCH UNSEEN` would have skipped it (the other three fixtures were unread). | `email_documents` row `pending_review`; the message now carries `$OcrDone \Seen` (UID 405) | PASS |
| **F-3** | `aragent+<S4 tag>@carmensoftware.com.evil.test` (the 09-24 attack) and `xaragent+<S4 tag>@carmensoftware.com` | Both logged "No ingest tag … dropped"; **0 rows**; poll `unrouted=2`; both flagged `$OcrDone` | PASS |
| **F-6** | KTC.pdf carrying S4's TIN, sent to `carmencloud`, whose Carmen token is dead. This is the same shape as 09-24's `r2-foreign-ktc`, which parked as `carmen_unauthorized`. | `pending_review / tax_id_mismatch` "Tax ID 0105556117534 is not in this BU's register". carmencloud's `carmen_token_verified_at` was set to a placeholder beforehand and came back **NULL**, so the suggester really met Carmen's 401 and still flagged the token. `email-token-health` was paused, so nothing else could have cleared it. | PASS |
| **DEF-1** | Two `POST …/approve` for the F-1 document fired with `asyncio.gather` through the real router. The dry-run Carmen post held 2 s, so both requests were in flight together. | HTTP `[200, 409]`. The 409 read "Another reviewer is posting this document right now" and came back while the winner was still posting. **1** `post_gljv` call. Row `posted`, `posting_started_at` NULL. | PASS |
| **DEF-2** | Both approve bodies carried `extracted.id` = **carmencloud's** card (the F-6 document). | S4's own card (by `task_id`) stamped; carmencloud's card `submitted_at` still NULL | PASS |

**Switch-over tool, exercised live.** Before the send, `scripts/imap_mark_done_backfill.py
--apply --seen-as-done` flagged 295 dev-mailbox messages (209 older than the window, 86 in-window
`\Seen`). A second dry run then reported 0 left, so it is idempotent. Only this run's 4 fixtures were
pending when the poll ran.

**Cost:** 2 vision calls (`gemini-2.5-flash-lite`), 12,650 tokens, **$0.0015**. The carmencloud
suggester stopped at Carmen's 401 before reaching any model.

**Isolation and cleanup, independently re-queried after teardown:**
- 0 QA rows, tasks, cards or LLM logs, and 0 scratch tenants.
- `carmencloud`: `verified_at` back to NULL, `auto_post=false`, and `docs_used` back to 18. Teardown now returns what the run charged a real BU.
- `carmen` untouched: its token was verified that morning and the run never used it.
- All 4 cron jobs active again.
- 0 fixtures left in `AR Agent`, and 0 messages pending in the folder.

**Limits, same as 09-24:**
- The JV post in DEF-1 went to S4's dry-run dispatcher. No real Carmen post was possible: carmen's fixtures collide with its own history, and carmencloud's token is dead.
- The *deployed* dev backend still runs pre-fix code. CD has been failing since at least 09-23 on an empty `SUPABASE_DB_URL` secret, so this proves the code on `main`, not what dev or prod currently serve.
- F-4 (confirmation sweep) was not re-run live. It needs a real Gmail forwarding-confirmation mail; the unit test covers it.
