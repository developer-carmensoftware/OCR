# Review payloads encrypted at rest — test plan and report

**Date:** 2026-10-29 · **Branch:** `feat/encrypt-review-payload` (PR #319) · **Decision:**
[#49](../06-decision-log.md#49-review-payloads-are-encrypted-at-rest-and-the-old-rows-on-request-2026-10-29)
· **Harness:** `scripts/qa/review_payload_e2e.py` (data) + `scripts/qa/review_payload_ui.mjs` (browser)

## Verdict

**Every case passes.** Two defects were found while testing, both introduced by the change
itself, and both are fixed on the branch. Each fix has a test that fails without it.

- **F-1:** a cleared payload was the JSON value `null`, not SQL NULL.
- **F-2:** a row encrypted under another key was never cleared.

| Layer | What | Result |
|---|---|---|
| Unit | `EncryptedJSON`: what is stored, the round trip, legacy rows, other key, SQL NULL, change detection, the `doc_type` SQL filter | **10 / 10** |
| Integration | `POST /admin/review-payloads/encrypt`: job token, dry run, refused otherwise | **3 / 3** |
| Backend suite | everything, mock DB | **1960 pass**, 0 fail (97 real-DB skipped) |
| Real DB (dev) | every reader and writer of both columns, against Postgres | **9 / 9** |
| Real DB, whole tenancy suite | regression | all pass but one, a known dev-data failure (below) |
| Browser E2E | queue, review dialog, reject, settlement sample, PMS day, backfill call | **25 / 25** |
| Rollback compatibility | the `main` backend reading encrypted rows | **5 / 5**, inside the 25 |
| Table check | what each seeded row holds, before and after the run | **6 / 6 rows right**, both times |

## Conditions

- **Dev database.** BU `carmen` (`dev.carmen4.com`). It has a posting credential and BAY / SCB /
  KBANK mappings, and QA does not use it.
- **Three servers:**
  - the branch backend on 8010;
  - the `main` backend (a worktree of `origin/main`) on 8011;
  - vite on 3010, proxying to 8010.

  All of them used the transaction pooler (6543), so the session cap was never at risk.
- **Sign-in** was through the real Carmen SSO link, as a Carmen user does.
- **Seeded data**, with no LLM call and no credit. Every row was removed afterwards (`clear`).
  - Three email documents written through the app's own model, so they are encrypted: BAY,
    SCB, and a KBANK settlement report.
  - One plaintext document, written with raw SQL the way a row parked before 2026-10-29 sits.
  - One document encrypted under a **different** key: a rotated key, or a backend run with the
    CI dummy key.
  - One PMS day.
- **No new JV in Carmen.** E-05 (approve) posted real JV 1593 in an earlier run, so this run
  set `E2E_NO_POST=1` instead of posting the same document number twice. The approve path's
  decryption is also covered against Postgres by D-04.

## Test cases

### Real DB — `tests/tenancy/test_review_payload_encryption.py`

These run against Postgres because the mock-DB suite cannot see the stored bytes, JSONB
operators, or what the ORM actually writes.

| ID | Case | Checks |
|---|---|---|
| D-01 | Backfill | dry run counts and writes nothing; apply encrypts exactly that many; second call finds 0 |
| D-02 | Settlement sample | `doc_type` SQL filter still finds an encrypted KBANK report |
| D-03 | Pipeline writer | `_park_for_review` stores a token; `_already_pending` (duplicate guard) still reads it |
| D-04 | Approve / finish | `_claim_for_review` returns it decrypted, with `doc_type`; `_finish` leaves **SQL NULL** |
| D-05 | PMS | `_park` → `get_day` → `recheck` → `_claim`: encrypted at every write, readable at every read |
| D-07 | Another key | reads as None; queue row shows zeros; `GET` the document is not a 500; backfill leaves it; **`_finish` clears it** |
| D-08 | Race | a row `_finish` clears while the backfill runs stays NULL (not resurrected) |
| D-09 | Size | 300 Thai line items round-trip through Postgres intact |
| D-10 | Old JSON `null` | a row the old `_finish` left as JSON `null` is neither counted nor touched by the backfill |

### Browser E2E — `scripts/qa/review_payload_ui.mjs`

| ID | Case | Expected → result |
|---|---|---|
| E-01 | Seed | 5 email documents + 1 PMS day → **done** |
| E-02 | Table, before | encrypted rows hold only `enc` (+ `doc_type` for email) and decrypt with our key; legacy row plaintext; foreign row unreadable → **6 / 6** |
| E-03 | Queue | BAY 15,000 / 2 lines, KBANK 2 lines, legacy 3,000, SCB listed — figures come out of the decrypted payload → **pass** |
| E-04 | BAY dialog | doc no, payment types as JV rows, 10,000 + 5,000, Balanced, Approve open → **pass** |
| E-05 | Approve, input tax unticked | posted, owes input tax, settled as keyed → **skipped this run** (JV 1593 in the earlier run) |
| E-06 | Reject SCB with a reason | rejected, reason stored → **pass** |
| E-07 | Settlement sample | KBANK payment types from the encrypted report → **pass** |
| E-08 | Legacy row | opens on its own data → **pass** |
| E-09 | Backfill endpoint | dry run counts and writes nothing (dev: 8 = 7 real + 1 seeded); no token → 401 → **pass** |
| E-10 | PMS day | review shows its rows; reject → **pass** |
| E-12 | PMS queue row | 2 lines, `mapping_missing`, unmapped `729` → **pass** |
| E-13 | Another key | lists with no figures; dialog opens ("There is nothing to post", Approve off); reject works → **pass** |
| E-14 | Page errors | none through the whole run → **pass** |
| C-01 | `main` backend | queue 200, encrypted row degrades to 0 lines, legacy row in full, document `GET` 200, review list 200 → **5 / 5** |
| E-02b | Table, after | rejected rows (SCB, foreign, PMS) **SQL NULL**; pending rows still `enc` → **6 / 6** |

## Findings

**F-1 — a cleared payload was JSON `null`, not SQL NULL (fixed).**
- **What was wrong.** The plain `JSON` type stores Python `None` as the JSON value `null`, so
  `_finish` "cleared" rows into something `IS NOT NULL` still matches. Dev holds 77 such rows.
  The new backfill counted them as plaintext: its first dry run reported 86 rows where 7 were
  real.
- **The fix.**
  - `EncryptedJSON` uses `none_as_null=True`.
  - The backfill only selects `jsonb_typeof = 'object'`.
- **Tests.** Unit `test_a_cleared_payload_is_sql_null_not_json_null`, D-04 and D-10.
- **Existing rows.** The 77 are left as they are: they hold nothing and nothing reads them.

**F-2 — a row encrypted under another key was never cleared (fixed).**
- **What was wrong.** Such a row reads as `None`. So `_finish`'s `row.review_payload = None`
  looked like no change to the ORM, the UPDATE left the column out, and the token stayed in a
  rejected row for good. The table check after the first E2E run caught it: the foreign row was
  `rejected` but still held `enc`.
- **The fix.** `EncryptedJSON.compare_values` never calls two `None`s equal, so assigning
  `None` always writes NULL. It sits on the type, so it covers every ORM writer, not only
  `_finish`. The PMS writers already use Core `update()`, which always writes the column.
- **Tests.** Unit `test_assigning_none_is_always_a_change` and D-07. D-07 failed with the fix
  removed.

**Known, not this change.** `test_carmen_live::test_two_bus_do_not_share_one_carmen_credential`
fails on dev: `carmen`, `carmencloud` and `pms-e2e` hold one credential. That is dev data.

## Not covered, and why

- **Backfill apply on the whole dev DB.** It would encrypt QA's waiting rows while `-xntb` still
  runs `main`, which shows them with no figures. Apply is covered tenant-scoped by D-01 and D-08.
  It runs for real after the deploy, through the endpoint.
- **Prod.** Not touched.

## Deploy and rollback

- **Order.** Deploy, then call `POST /api/v1/admin/review-payloads/encrypt?dry_run=true`, then
  call it again without `dry_run`. Once per environment, dev before prod. On dev today the dry
  run should count about 7.
- **Rollback.** Rolling back after the backfill is safe but blind, as C-01 shows. `main` answers
  200 everywhere, but encrypted rows show no figures and their dialog has nothing to post until
  the code rolls forward. Nothing is lost: the ciphertext stays in the row.

## Rerun

```bash
python scripts/qa/review_payload_e2e.py seed
# backend from the branch on 8010, vite on 3010; optionally `main` on 8011 for C-01
E2E_NO_POST=1 OLD_API_URL=http://localhost:8011 node scripts/qa/review_payload_ui.mjs
python scripts/qa/review_payload_e2e.py check   # exit 1 if any row holds what it should not
python scripts/qa/review_payload_e2e.py clear
TENANCY_DB_TESTS=1 python backend/tests/tenancy/_run.py backend/tests/tenancy/test_review_payload_encryption.py
```
