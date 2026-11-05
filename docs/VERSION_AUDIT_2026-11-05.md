# Version audit: `1.0.2` → next release (2026-11-05)

Applies the rules in [VERSIONING.md](VERSIONING.md) to everything since `v1.0.2`
(commit `b6032dd0`, 2026-07-27): 898 commits, 163 `feat` commits, 64 changelog days.

**Verdict: MINOR.** Nothing since 1.0.2 broke a consumer that existed at the time.

> **Superseded numbering (same day):** the project was reset to `0.x.z` (see
> [VERSIONING.md](VERSIONING.md#current-phase-0xz-until-the-pms-interface-is-complete)). Old `1.0.2` is now
> `0.0.3`, and this MINOR verdict is folded into **`0.1.0`** (everything up to 2026-11-05), not `1.1.0`. The rest of this
> page keeps the original `1.x` wording as the record of the audit.

## Method (and its limit)

- Baseline = what 1.0.2 shipped. A surface that did not exist in 1.0.2 is *new*, not *changed*.
- Read every `feat` commit subject (`git log b6032dd0..HEAD --no-merges`), every `!:` commit, and
  grepped history and changelog for `breaking`, `contract`, `consent`, `rename`, `MAJOR`.
- **Limit:** this is commit-subject and changelog level, not a line-by-line diff of 898 commits. A
  change to an existing `/api/v1` response shape that no commit message or changelog flags would
  not be caught. Spot-check before release: `git diff b6032dd0..HEAD -- backend/app/models/schemas/`.

## MAJOR candidates, and why none holds

| Candidate | Date | Ruling |
|---|---|---|
| Five `!:` commits on the email-automation / Settings API (`ingest_address` reshaped, `no_gl_mapping` dropped from `status.blockers`, API key dropped, `host` → `uri`, `carmen_uri` dropped) | 08-05, 08-10 | Not MAJOR. The surface did not exist in 1.0.2, and the changelog records that the contract was changed "while no customer is live and nothing has been handed to the Carmen team" (08-06). No outside consumer was broken. `changelog/2026-08-05.md` flagged a *pending MAJOR*; this audit supersedes it for the reason above |
| `has_new` → `has_notification` on `GET /notifications` | 08-13 | Not MAJOR. The endpoint was added the same day as an interim poll substitute; no earlier shape was published |
| `GET /notifications` (`items` → `data`) and `GET /credits/orders` (now `Page[T]`, `{total, limit, offset, data}`): response shape of endpoints that existed at 1.0.2 | after 1.0.2 | Not MAJOR. Only our own frontend calls them and it ships in the same deploy; no consumer outside this repo (found in the 2026-11-05 re-check, `git diff b6032dd0..HEAD -- backend/app/routers/`) |
| Consent re-prompt (`CONSENT_VERSION`) | `v2` set 2026-07-13 | Before 1.0.2; already in the baseline |
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

## To release

1. `VERSION` = `0.1.0` (done 2026-11-05; was `1.1.0` before the reset)
2. Newest `releaseNotes.ts` entry is `version: '0.1.0'`, dated 2026-11-05 (done: the notes for 08-05 → 11-04
   that had been deferred are written as that one entry, EN + TH, 4 user-visible bullets)
3. Today's changelog entry, then merge to `main`
4. Note: the GitHub release step has never run (see VERSIONING.md → Status), so also create `v0.1.0`
   by hand if tags are wanted now
