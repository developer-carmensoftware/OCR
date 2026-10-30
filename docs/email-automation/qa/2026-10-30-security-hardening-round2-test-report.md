# Security hardening, round 2 — verification test plan and report

**Date:** 2026-10-30 · **What was tested:** `main` after PRs #321 (headers, RLS, API docs flag),
#322 (retention) and #323 (key rotation), plus the fixes on `test/security-round2-verification`
· **Decision:** [#50](../06-decision-log.md#50-security-hardening-round-2--headers-api-map-rls-retention-key-rotation-2026-10-30)

## Verdict

**Every case that could run passes.** The campaign found **two defects in the shipped code**,
both now fixed on the branch. Each fix has a test that fails without it.

- **F-1: a BU-scoped admin could start a cross-tenant job.** Any admin holding `configs:write`
  could run the maintenance endpoints, whatever its BU scope.
- **F-2: the backfill and the key rotation restarted the retention clock.** The 90-day
  `email_documents` clock was reset on every row they touched.

It also found **one defect in the test harness**:
- **F-3:** the CSP sweep had silently skipped the review dialog and both PDF previews.

Still open:
- ~~The admin slip viewer has never been tested on QA with the CSP.~~ Tested the same day, with
  the user's admin login. It found **F-4**: slips load from MinIO, not the host the CSP
  allowed. That is fixed and the CSP enforced on `fix/csp-enforce-slip-host`; see
  [the slip viewer check](#the-slip-viewer-check-and-the-switch-to-enforcing).
- ~~`-xntb` serves `/openapi.json` as 404, because `EXPOSE_API_DOCS` is not set there.~~ Set by the user the same day: `/openapi.json`, `/docs` and `/redoc` answer 200 and list the new routes.
- On dev, the `updated_at` of the 364 rows the backfill encrypted was moved to 2026-10-30 (F-2).

| Layer | What | Result |
|---|---|---|
| A — build + regression | backend ruff/format/bandit/pytest · frontend lint/tsc/vitest/build · `db reset` + pgTAP · full tenancy suite (local) | **2022 pass** · **1092 pass**, build OK, inline-script hash = `vercel.json` · **3 / 3** · **110 pass**, 0 fail |
| B — new automated tests | B-1 … B-6 (pgTAP, integration, unit, real DB) | **all pass**; each red-checked against the code it guards |
| B-7 — real Gmail | the purge on a throwaway label, direct and through the endpoint | **5 / 5** and **6 / 6** |
| C — full system, local stack | headers sweep, CSP **enforced**, contact PII, retention, key rotation (4 phases), review payloads | **8/8 · 8/8 · 10/10 · 6/6 · 6+2+6+6 · 22/22** |
| D — deployed dev (`-xntb` + QA site) | routes, migrations, RLS/grants, crons, backfill, rotation, scrub, CSP sweep, smoke | **all pass**, except the docs flag (D-1) and the admin pages not being signed in (D-7) |

## Conditions

- **Local stack** (A, B, C): Supabase CLI in Docker. Every migration was applied from scratch
  (`db reset`), with the backend on 8011 and vite on 3011. Sign-in used the real Carmen SSO
  link for BU `carmen` (`dev.carmen4.com`).
  - The headers sweeps ran on the **production build** (`vite build --mode e2e`) served by
    `vite preview` with `vercel.json`'s headers.
  - BU carmen's GL setup was copied read-only from dev into the local DB for C-6, so the review
    dialog has accounts to build JV rows from.
- **Real mailbox** (B-7): `project@carmensoftware.com`, under the label `E2E-PURGE-TEST` only,
  created and deleted by the script. The ingest label `AR Agent` was never selected for writing.
- **Deployed dev** (D): `carmen-ocr-backend-xntb` (1.0.2 + #321–#323) and the QA site
  `ocr-tau-five.vercel.app`, against the dev database.
- **Nothing reached an LLM or Carmen.**
  - The sweeps answer every `/extract` inside the browser with an empty reading and refuse
    `/suggest`.
  - C-6 ran with `E2E_NO_POST=1`.
  - No credit was charged.
- **Writes to the dev database** in this campaign: only the D-3 backfill. The purge cron (D-5)
  ran on its own schedule.

## Findings

### F-1 — maintenance endpoints accepted a BU-scoped admin (fixed: `087cbed5`)

`require_maintenance_auth` (`routers/admin/deps.py`) let in the job token or any admin JWT
holding `configs:write`. Every route behind it acts on every BU at once:
- the encryption backfill and rotation;
- the mailbox purge;
- the summary rebuilds.

So an admin scoped to one BU could start a cross-tenant job. It now also requires
`admin.is_global`; otherwise 403. The job token is unchanged.

**Test:** `tests/integration/test_maintenance_job_auth.py` covers backfill, rotate and purge,
each against six callers (18 cases). The three BU-scoped cases fail without the fix.

### F-2 — the backfill and the rotation restarted the retention clock (fixed: `91e0b9ee`)

`fn_purge_email_documents` (daily) does two things, both keyed on **`updated_at`**:
- it scrubs a decided `email_documents` row at 90 days;
- it deletes the row at 2 years.

Both `encrypt_plaintext_columns` and `rotate_tokens` wrote through `update(model)`, so the ORM's
`onupdate` moved `updated_at` to *now* on every row they touched. On prod, the coming
`error_message` backfill, and every key rotation after it, would have kept each refused mail's
addresses for up to another 90 days. Both now write `SET updated_at = updated_at`, which stops
`onupdate`.

**Tests:** `test_d19` (backfill) and the rotation test seed a row with an 80-day-old
`updated_at`. Without the fix, the backfill moved it from 2026-08-11 to 2026-10-30.

**Found by D-3:** the dev backfill ran before the fix. On dev, the 364 rows it encrypted now
carry `updated_at` = 2026-10-30, so their scrub comes up to 90 days late. They were left as they
are: the old values cannot be recovered, only guessed. **Prod has not run the backfill.**
Deploy this fix first.

### F-3 — the CSP sweep skipped three screens without saying so (fixed: `4afe396d`)

`security_headers_ui.mjs` reported "no violation" for the review dialog and both PDF previews,
but never showed any of them:
- **The review dialog:** `isVisible()` does not wait, so the Review button was looked for before
  the queue loaded, and the dialog was skipped.
- **Both PDF previews:** the harness aborted `/extract`, which reset both wizards before the
  `blob:` preview was framed.

Extract is now answered in the browser, so it still never reaches the backend. The sweep opens
"View Document". A new check fails unless the dialog and both previews were actually on
screen. The screenshots confirm both PDFs render inside the `blob:` frame.

## Test cases

### A — build and regression

| ID | What | Result |
|---|---|---|
| A-1 | backend: ruff, format, bandit, full pytest | 2022 pass, 0 fail (110 real-DB skipped); bandit clean |
| A-2 | frontend: `npm run lint`, `tsc -b`, vitest, `npm run build` | lint 0 errors; 1092 pass; the built `index.html`'s inline script hashes to the sha256 in `vercel.json` |
| A-3 | `supabase db reset` + `supabase test db` | every migration applies; pgTAP 3/3 |
| A-4 | full tenancy suite, local Supabase | 110 pass, 0 fail, 3 skipped |

### B — new automated tests

| ID | Where | Case | Result |
|---|---|---|---|
| B-1 | pgTAP `security.test.sql` | a table created **after** the RLS migration gives `anon`/`authenticated` nothing (the `alter default privileges` half) | pass; red-checked |
| B-2 | `test_maintenance_job_auth.py` | backfill, rotate, purge × job token 200 · global admin 200 · BU-scoped admin 403 · admin without `configs:write` 403 · customer session 401 · nobody 401 | 18/18; scoped cases red before F-1 |
| B-3 | unit `test_key_rotation.py` | two old keys listed at once: tokens under either rotate to the primary | pass |
| B-4 | tenancy `test_key_rotation.py` | every column the rotation knows (see the list below) is seeded under the old key, and each must report stale, rotate, and read under the new key alone (+ F-2's clock check) | pass |
| B-5 | tenancy `test_review_payload_encryption.py` | backfill encrypts a plaintext `error_message`; the ORM reads it back (+ F-2's clock check) | pass |
| B-6 | tenancy `test_retention_scrub.py` | a row three weeks short of 12 months is not scrubbed | pass |
| B-7 | `scripts/qa/mailbox_purge_live.py` | see below | 5/5 direct, 6/6 via endpoint |

The columns B-4 seeds, each under the old key:
- the PMS payload;
- corrections;
- the bug screenshot;
- buyer name, tel and email;
- the contact email and owner emails;
- the BU credential, the session, and PDF passwords.

A column added later without a seed fails the count.

**B-7, on the real Gmail.** Three mails are APPENDed to `E2E-PURGE-TEST` with chosen
INTERNALDATEs: the day before the floor, the floor day, and today.

| ID | Expect | Result |
|---|---|---|
| L-1 | dry run counts only the day-before mail | 1 |
| L-2 | real run moves it, to `[Gmail]/Trash` | moved 1; found in Trash |
| L-3 | the floor-day mail and today's stay (the floor is the poll's `SINCE`) | both still in the label |
| L-4 | a second run moves nothing | 0 |
| L-5 | `--endpoint`: the run is a `job_runs` row, and `#/admin/jobs` lists it (retention_ui R-5) | row found; listed |

Cleanup removed every test mail from the label and the Trash, then the label itself. A first
run died on the script's own search before cleaning up; the next run cleaned up after it too.

### C — full system on the local stack

| ID | Harness | Result |
|---|---|---|
| C-1 | `security_headers_ui.mjs`, CSP Report-Only | **8/8** — 18 screens + review dialog + both `blob:` PDF previews, 0 reports; framing refused |
| C-2 | same, **CSP enforced** (`CSP_ENFORCE=1`; the preview sends the policy as `Content-Security-Policy`) | **8/8** — every screen renders, both PDFs display in their `blob:` frame, 0 violations; the probe inline script is still caught |
| C-3 | `contact_pii_ui.mjs` | 10/10 |
| C-4 | `retention_ui.mjs` (+ R-5, the Jobs page) | 6/6 |
| C-5 | `key_rotation_ui.mjs`, the whole runbook | key A 6/6 → **B alone** 2/2 unreadable as expected → B + old A 6/6 → rotate 23 tokens, 0 unreadable, recount 0 → **B alone** 6/6, every raw token under B. Then B→A the same way: 30 tokens, 0 unreadable |
| C-6 | `review_payload_ui.mjs` (`E2E_NO_POST=1`) | 22/22; `review_payload_e2e.py check` 11 values, 0 wrong; both reject reasons stored as tokens and read back in clear |

### D — deployed dev

| ID | What | Result |
|---|---|---|
| D-1 | the new routes on `-xntb` | `encryption/backfill` (now with `error_message`), `encryption/rotate` and `email-ingest/purge` answer. `/openapi.json` was 404 until the user set `EXPOSE_API_DOCS=true` the same day; since then 200, listing `encryption/backfill`, `encryption/rotate` and `email-ingest/purge` |
| D-2 | migrations, RLS, grants, crons | `20261030000000/100/200` recorded; 0 tables without RLS; 0 table and 0 routine grants to `anon`/`authenticated`; both crons active |
| D-3 | backfill through `-xntb` | dry run 364 `error_message` → applied → recount 0 |
| D-4 | rotation dry run | every column: stale 0, unreadable 0 |
| D-5 | the purge cron | ran 04:00 UTC, `succeeded`; `job_runs` success, **440** moved. Trash holds exactly those 440; `AR Agent` has 0 left before the floor |
| D-6 | the scrub cron | ran 04:20 UTC, `succeeded`; 0 rows scrubbed (the oldest task is from 2026-06) |
| D-7 | `security_headers_ui.mjs` on `ocr-tau-five.vercel.app` + `-xntb` | headers right; review dialog and both PDF previews reached; **0 CSP reports** on every customer screen. Admin pages showed only their sign-in form: a locally minted admin token is not `-xntb`'s, so they are covered by C-1/C-2, not here. One earlier run closed the page mid-sweep; it did not repeat |
| D-8 | QA smoke | SSO, queue, review dialog, email settings: pass. The API returns 90 decrypted reasons for BU carmen, none a raw token; no page error |

## Before enforcing the CSP

The policy as written holds on every screen with the CSP **enforced**, locally (C-2) and on the
real QA site in Report-Only (D-7):
- the PDF previews;
- the review dialog;
- the checkout;
- the admin dashboard.

**One screen was never tested: the admin slip viewer** (`SlipViewer.tsx`). It frames a
FileService presigned URL; `vercel.json` allows `https://api-oneapp.carmenteam.com` for that,
unconfirmed. **The check before the enforcing PR:** sign in to `#/admin` on QA, open an order
with an uploaded slip, and check the browser console for CSP reports.

### The slip viewer check, and the switch to enforcing

**Run on QA, 2026-10-30.** Playwright browser, with the user's admin login. Every order in "To
Post" was opened.

**F-4: the CSP allowed the wrong host for slips.**
- **The host:** every slip the browser loads comes from **`https://api-minio.carmenteam.com`**,
  the presigned MinIO URL FileService hands the backend. It never comes from
  `api-oneapp.carmenteam.com`, the FileService host the policy allowed.
- **What it broke:** all 5 PDF slips violated `frame-src` and all 6 image slips (jpg/png)
  violated `img-src`. Enforced as written, no admin could have seen a slip.
- **The other 4 orders:** they have no slip at all (`slip_uploaded_at` null), and their panel
  rightly reads "No slip uploaded yet". Opening each still fired a `slip-url` request that
  could only 404: a red console error that looks like a missing file. That request is gone too
  (`d4d195c7`).

**Fixed on `fix/csp-enforce-slip-host`** (`e268d9f7`): `img-src` and `frame-src` allow
`api-minio`, and the header is now `Content-Security-Policy`, i.e. enforced. The user confirmed
two things before the switch:
- prod uses the same FileService/MinIO;
- prod's frontend calls `carmen-ocr-backend.onrender.com`, already in `connect-src`.

| Check | Result |
|---|---|
| QA, **this exact policy enforced** (served through a Playwright route), real data | PDF slip renders in Chrome's viewer from `api-minio`; image slip loads 1600×1600; a slip-less order reads "No slip uploaded yet"; 12 admin pages signed in; proforma renders: **0 violations**. A probe inline script is blocked (`enforce`) |
| Local, the enforced build (`security_headers_ui.mjs`) | 8/8, 0 violations, dialog and both previews reached |
| `securityHeaders.test.ts` | enforced key, slip host in `img-src` and `frame-src`. Fails on the old `vercel.json` |
| Slip-less order, local | no `slip-url` request, no console error |

**Rollback:** rename the header back to `Content-Security-Policy-Report-Only` and redeploy the
frontend.

## After this branch

- **Merge before the prod backfill.** F-2 matters on prod the first time the `error_message`
  backfill runs. (Merged as #324.)
- ~~**`EXPOSE_API_DOCS=true` on `-xntb`.**~~ Done; the dev deploy check can read `/openapi.json` again.
- ~~**Enforce the CSP** once the slip viewer is checked.~~ Done on `fix/csp-enforce-slip-host`.
  After it deploys: open one slip on QA and one on prod.
