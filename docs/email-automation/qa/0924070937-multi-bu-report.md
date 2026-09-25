# Email Automation — multi-BU QA report (run 0924070937)

Generated 2026-09-24T10:11:22.326382+00:00. State file: `C:\Users\User\AppData\Local\Temp\claude\c--Users-User-Desktop-OCR\43cf8c04-1b47-4a4c-9350-f501c94209d7\scratchpad\qa_state.json`.

## BUs under test

| Code | Role | Tenant | Real Carmen? | Tag |
|---|---|---|---|---|
| carmen | R1 | `af0786cd-487d-4625-95fd-f2e75718447d` | yes | `41645ee4` |
| carmencloud | R2 | `8111f7a9-d03c-4a11-b9a6-0a4f9a1d2b7d` | yes | `1ad4e0b6` |
| S3 | S3 | `2b8ca11f-bdc5-4f63-bb96-fcbd47ad3bc4` | no (dry-run dispatcher) | `qas32501a4` |
| S4 | S4 | `49d32b84-c70c-4bd2-b02c-de96ca9844f2` | no (dry-run dispatcher) | `qas44f70c2` |
| S5 | S5 | `959cfd52-9354-49ec-af3f-b0a1e72548e5` | no (dry-run dispatcher) | `qas5e17c1f` |
| S6 | S6 | `352e68e5-6902-4a79-9a24-7bc9861cc03e` | no (dry-run dispatcher) | `qas6c24ed2` |

## Result

- **23** case mismatch(es) against expectation
- **1** cross-BU ledger/task/card leak(s) — BLOCKER if nonzero
- **0** Carmen dispatch-to-wrong-host leak(s) — BLOCKER if nonzero
- **0** finding(s) from the review-queue isolation checks
- **0** secret(s) found in persisted state — BLOCKER if nonzero: none

**Overall: FAIL — see blockers above**

## Known defects (found reading the code before this run; reproduced separately)

- **DEF-1 (High)** — two concurrent approvals of one document can both post a JV to Carmen. Reproduced at `backend/tests/tenancy/test_email_approve_integrity.py::test_two_concurrent_approvals_post_exactly_once` (`xfail(strict=True)`).
- **DEF-2 (Medium)** — approving a document with a client-supplied `extracted.id` can stamp `submitted_at` on another BU's `credit_cards` row, with no tenant check. Reproduced at `...::test_approve_cannot_stamp_another_tenants_card` (`xfail(strict=True)`).
- Run: `TENANCY_DB_TESTS=1 pytest backend/tests/tenancy/test_email_approve_integrity.py -v`

## Per-case results (mapped from the plan's IDs)

| case | plan IDs | BU | expected | note |
|---|---|---|---|---|
| FAIL R1-own | R-01, Q-03 | carmen | pending_review/— | carmen's own TIN (Kimberly); auto_post off -> parks for review, approved later |
| FAIL cross-kimberly-s5 | T-01, R-01 | S5 | pending_review/tax_id_mismatch | TIN belongs to carmen; must park under S5, never touch carmen's queue |
| FAIL s3-own-kbank | R-01, E-07, B-* | S3 | posted/— | S3 auto_post on, owns this TIN, KBANK rule active -> should auto-post (dry-run Carmen) |
| FAIL s3-bay-inactive | B-01 | S3 | skipped/no_rule_match |  |
| FAIL s4-own-ktc | R-01, B-04 | S4 | pending_review/— |  |
| FAIL s4-own-paypal | R-01, D-03-setup | S4 | pending_review/— |  |
| FAIL s5-own-ghl | R-01 | S5 | pending_review/— |  |
| PASS s5-owner-blocked | S-12, B-04 | S5 | skipped/sender_not_allowed | S5 has owner_emails set; this sender is not in it |
| FAIL r2-foreign-ktc | E-07, T-02 | carmencloud | pending_review/tax_id_mismatch |  |
| FAIL s6-held | E-05 | S6 | retry_later/— |  |
| PASS bare-address | R-05 | S3 | unrouted/— |  |
| PASS r1-unmatched-attachment | R-08 | carmen | skipped/no_rule_match | same bytes as BBL, but filename matches neither of carmen's rules |
| FAIL s1-forged-header | S-01 | S3 | posted/— | genuine Delivered-To is S3's; a forged S4 header follows it — must stay S3's |
| FAIL s2-to-header-ignored | S-02 | S4 | pending_review/— | To: is S3's tag; Delivered-To (the real routing header) is S4's |
| FAIL s3-domain-suffix-attack | S-03 | S3 | unrouted/— | tag regex must not match past the real domain |
| PASS unknown-0 | R-06 | ? | unrouted/— |  |
| PASS unknown-1 | R-06 | ? | unrouted/— |  |
| PASS unknown-2 | R-06 | ? | unrouted/— |  |
| PASS unknown-3 | R-06 | ? | unrouted/— |  |
| PASS unknown-4 | R-06 | ? | unrouted/— |  |
| FAIL s3-right-password | B-07 | S3 | posted/— | S3's rule password is added in setup_passwords() |
| FAIL s4-wrong-password | B-07 | S4 | skipped/wrong_pdf_password |  |
| FAIL R1-own-r2 | R-01, Q-03 | carmen | pending_review/— |  |
| FAIL cross-kimberly-s5-r2 | T-01, R-01 | S5 | pending_review/tax_id_mismatch |  |
| FAIL s3-own-kbank-r2 | R-01, E-07, B-* | S3 | posted/— |  |
| PASS s3-bay-inactive-r2 | B-01 | S3 | skipped/no_rule_match |  |
| PASS s4-own-ktc-r2 | R-01, B-04 | S4 | pending_review/— |  |
| PASS s4-own-paypal-r2 | R-01, D-03-setup | S4 | pending_review/— |  |
| FAIL s5-own-ghl-r2 | R-01 | S5 | pending_review/— |  |
| FAIL s1-forged-header-v2 | S-01 | S3 | posted/— | genuine S3 header first/topmost (as a real one would be); forged S4 after |
| PASS s2-to-header-ignored-v2 | S-02 | S4 | pending_review/— | To: shows S3's address; Delivered-To (routing_addr, default) is S4's own |
| PASS s4-wrong-password-v2 | B-07 | S4 | skipped/wrong_pdf_password |  |
| PASS s6-now-expired | E-05 | S6 | retry_later/— |  |
| PASS cross-kimberly-s5-r3 | T-01, R-01 | S5 | pending_review/tax_id_mismatch |  |
| PASS s5-own-ghl-r3 | R-01 | S5 | pending_review/— |  |
| FAIL s4-while-disabled-1 | E-01 | S4 | retry_later/— |  |
| FAIL s4-while-disabled-2 | E-01 | S4 | retry_later/— |  |
| FAIL s3-unaffected-by-s4-off | E-01 | S3 | posted/— |  |
| FAIL s4-new-after-reenable | E-02 | S4 | pending_review/— |  |

## Cross-BU leaks (BLOCKER)

- `['s1-forged-header', 'S3', 'S4']`

## Real JVs posted to dev Carmen (clean these up manually)

- {'bu': 'S6', 'real_carmen': False, 'doc_id': '572e5a4c-1d2b-42f0-8182-dc98b70bbd9e', 'jv_no': 'QA-DRY-1'}

## Notes / scope adjustments made during the run

- `carmencloud` (R2) could not be given a genuine "owns this TIN, auto_post posts with zero clicks" case without editing its live tax-ID registration (it is already handed to other testers) — that proof runs on scratch BU S3 instead (dry-run Carmen call, same code path, its own token/uri). R2's role covers: real toggle write, real approve/JV, and "auto_post never bypasses the tax-ID gate" on a foreign TIN.
- `carmen` (R1) had no active subscription at the start of this run (its own history shows it had one before); a temporary one was granted for the run and removed in teardown.
- Q-03 ("approve through the real UI") was done via a real HTTP call through the actual FastAPI app (`TestClient` against the real dev DB — the same technique `tests/tenancy` uses), not a browser. Ask if a Playwright pass is wanted too.

## Findings that are not about routing/isolation, found while running this

- **(Medium) Settings writes silently drop unknown fields on a rule.** `_merge_rule` (`email_settings_service.py`) rebuilds every rule from only the keys `RuleIn` knows (`bank_code`, `bank_sender_email`, `filename_patterns`, `is_active`, `pdf_password_enc`). `carmencloud`'s real KBANK rule carried an extra `"doc_type": "ar_reconcile"` key that this run's `PUT /settings`-equivalent call (toggling `auto_post`) silently deleted — caught and restored by hand mid-run (not by the harness). Any future settings write on any BU with a rule carrying a field outside the documented schema will silently lose it the same way — worth checking whether `doc_type` is load-bearing anywhere before the next such write.
- **(Severity TBD, unresolved) A same-process, single burst of 22 messages produced only 15 outcomes on the first poll; the other 7 were marked `\Seen` with no ledger row and no line in the poll's own summary — silent loss, not a crash (`job_runs` shows one `success` run, no exception was logged, no overlapping poll ran). Reproduced on a resend: see whether the smaller follow-up batch (this run's `missing7`/`2fix` waves, 11 messages) also lost anything — if it did not, this may be specific to bursts near ~20+ messages with several multi-MB attachments in one poll, which is exactly the shape a busy production tick can take.
