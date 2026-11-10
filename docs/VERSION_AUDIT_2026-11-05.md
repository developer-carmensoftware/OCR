# Audit: what `0.1.0` contains (2026-11-05)

Applies the rules in [VERSIONING.md](VERSIONING.md) to everything built before `0.1.0`, measured from the
last state before versioning started (commit `b6032dd0`, 2026-07-27): 898 commits, 163 `feat` commits,
64 changelog days. `0.1.0` is the baseline that all later versions count from.

**Verdict: MINOR-level only.** Nothing in it broke a consumer that existed at the time, so no MAJOR is owed.

## Method (and its limit)

- Reference point = `b6032dd0`. A surface that did not exist there is *new*, not *changed*.
- Read every `feat` commit subject (`git log b6032dd0..HEAD --no-merges`), every `!:` commit, and
  grepped history and changelog for `breaking`, `contract`, `consent`, `rename`, `MAJOR`.
- **Limit:** this is commit-subject and changelog level, not a line-by-line diff of 898 commits. A
  change to an existing `/api/v1` response shape that no commit message or changelog flags would
  not be caught. Spot-check before release: `git diff b6032dd0..HEAD -- backend/app/models/schemas/`.

## MAJOR candidates, and why none holds

| Candidate | Date | Ruling |
|---|---|---|
| Five `!:` commits on the email-automation / Settings API (`ingest_address` reshaped, `no_gl_mapping` dropped from `status.blockers`, API key dropped, `host` → `uri`, `carmen_uri` dropped) | 08-05, 08-10 | Not MAJOR. The surface did not exist at the reference point, and the changelog records that the contract was changed "while no customer is live and nothing has been handed to the Carmen team" (08-06). No outside consumer was broken. `changelog/2026-08-05.md` flagged a *pending MAJOR*; this audit supersedes it for the reason above |
| `has_new` → `has_notification` on `GET /notifications` | 08-13 | Not MAJOR. The endpoint was added the same day as an interim poll substitute; no earlier shape was published |
| `GET /notifications` (`items` → `data`) and `GET /credits/orders` (now `Page[T]`, `{total, limit, offset, data}`): response shape of endpoints that existed at the reference point | after it | Not MAJOR. Only our own frontend calls them and it ships in the same deploy; no consumer outside this repo (found in the 2026-11-05 re-check, `git diff b6032dd0..HEAD -- backend/app/routers/`) |
| Consent re-prompt (`CONSENT_VERSION`) | `v2` set 2026-07-13 | Before the reference point; already in the baseline |
| Forced re-onboard | none found | — |
| Carmen **posting** contract (JV / invoice payloads) | none found | JV source names changed to the AI JV sources (CA-110, 10-07); additive from Carmen's side |

## MINOR: new user-visible capabilities (each alone justifies MINOR)

- **Email automation**: ingest, per-BU routing tag, review queue (approve/reject, auto-post), settings page at `#/CreditCardOCR/email-settings`, mailbox retention
- **AR reconciliation / KBANK settlement report**: parser, JV builder, settings screen, input-tax record
- **Late input-tax filing** (CA-111)
- **PMS interface**: webhook `POST /api/v1/pms/events`, day review/approve in the queue, derived settings from Carmen, posting through Carmen's engine (CA-93, CA-119)
- **Carmen-facing**: `GET /api/v1/carmen/ai-status` (+ v2), `/api/v1/carmen/pms` settings API
- **Billing**: Lite plan (฿290 / 100 docs), Micro top-up pack, plan change, per-page AP invoice charging, in-app purchase tutorial
- **AP invoice**: Polar Bear PACK-column invoices (CA-123)
- **Admin**: Email Automation page, API-keys page, `order_reviewer` role, server-side sort/filter/paging
- **Credit-card**: landing page is the activity queue, per-bank Description, payment-type dialog, draft persistence for wizard recovery

## Bumps nothing (internal; changelog only)

- Encryption at rest (review payloads, corrections, screenshots, contact details) and key rotation
- RLS on every public table, security headers and CSP, `/docs` gated by `EXPOSE_API_DOCS`
- Retention scrubs (filenames, error text, ingest mailbox)
- `features/` + `shared/` frontend layout, `scripts/` reorganisation, admin table/pager refactors

## Release record

1. `VERSION` = `0.1.0`.
2. Newest `releaseNotes.ts` entry is `version: '0.1.0'`, dated 2026-11-05: EN + TH, 7 bullets written as a launch announcement.
3. Git tag and GitHub Release `v0.1.0` on the merge of #341.
