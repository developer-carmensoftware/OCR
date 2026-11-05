# Versioning & releases

One number, **SemVer `MAJOR.MINOR.PATCH`**, stored once in the repo-root [`VERSION`](../VERSION) file.
Everything else derives from it. Bumping is **manual**; nothing bumps for you.

## Current phase: `0.x.z`, until the PMS interface is complete

Reset on 2026-11-05 (was `1.0.2`; no tag or GitHub release ever existed, so no consumer pinned the old
numbers). The product counts as complete only when the **PMS interface** is complete, so we stay in
SemVer's initial-development range:

- Old `1.0.0 / 1.0.1 / 1.0.2` became `0.0.1 / 0.0.2 / 0.0.3` (same releases, renumbered). **`0.1.0` is everything shipped up to 2026-11-05** (email automation, settlement reports, PMS, new plans), recorded as one release-note entry. `VERSION` = `0.1.0`.
- **MINOR** (`0.X.0`) = a new user-visible capability **or** a breaking contract change. Both are allowed
  at `0.x`; there is no MAJOR below 1.0.0.
- **PATCH** (`0.1.X`) = fix, prompt tweak, perf, copy: unchanged.
- **`1.0.0`** is cut once, when the PMS interface is done and has passed QA. Its definition of done is
  written separately; do not release `1.0.0` before that document exists.
- Everything below ("What each digit means") applies in full from `1.0.0` on.

The audit in [VERSION_AUDIT_2026-11-05.md](VERSION_AUDIT_2026-11-05.md) found MINOR-level changes only since `1.0.2`;
all of it is folded into `0.1.0` rather than spread over later numbers. The next change after that is `0.1.1` (fix) or `0.2.0` (new capability).

## What each digit means (from 1.0.0)

| Digit | Bump when | Reset |
|---|---|---|
| **MAJOR** (`X.0.0`) | The change **breaks someone outside this repo**: the Carmen posting contract, the `/api/v1` response shape, a forced re-onboard | MINOR and PATCH → 0 |
| **MINOR** (`1.X.0`) | A **new user-visible capability**: a module, a bank, an admin page, a wizard step | PATCH → 0 |
| **PATCH** (`1.0.X`) | Bug fix, prompt tweak, perf, copy fix. Nothing new to learn | none |

No ceiling at 9: `1.0.10` is valid. Do not roll over into MINOR.

**Bumps nothing:** refactors, CI, dependency bumps, internal-only work (those get a
`changelog/` entry, not a release).

Example (once at 1.0.0): `1.0.0` → `1.0.1` (bug) → `1.0.2` (prompt) → `1.1.0` (new bank) → `1.1.1` (bug in that bank) → `2.0.0` (Carmen contract changes).

If a change fits two rows, take the higher one, and write the reason in that day's changelog.

## MINOR or MAJOR? Three questions, in order

A change is **MAJOR** only if the answer to **Q1 is yes** and **either Q2 or Q3 is yes**. Otherwise it is
MINOR (if it adds something users can see or do) or PATCH.

1. **Does an outside consumer already use this surface in a release we shipped?** Carmen calling our API,
   Carmen's posting contract, a customer's saved settings, a user's browser state. "Outside" = anything not
   in this repo. A surface that has never shipped, or that nobody outside has been handed (check the
   changelog and `docs/`), has no consumer: change it freely, it is not a break.
2. **Does a request, response, field, URL, status code or payload that worked before stop working?**
   Removing, renaming, retyping, making optional → required, or changing meaning all count.
   **Adding** an endpoint, an optional field or a new enum value does **not**.
3. **Must a person do something new to keep using it?** Re-onboard a BU, re-enter a credential, re-map settings.

A forced re-onboard is MAJOR even when the API is untouched (Q1 yes via the user, Q3 yes). A forced **re-consent** is deliberately *not*: it is one modal click, so a `CONSENT_VERSION` bump is MINOR (decided 2026-11-05).

### Examples from this repo

| Change | Q1 | Q2 | Q3 | Level |
|---|---|---|---|---|
| New credit-card bank (e.g. KTC, GHL) | n/a | no | no | MINOR |
| New plan / top-up pack (Lite, Micro) | n/a | no | no | MINOR |
| New admin page, new role (`order_reviewer`) | n/a | no | no | MINOR |
| New Carmen-facing endpoint (`GET /carmen/ai-status`, `POST /pms/events`) | no (new) | no | no | MINOR |
| New optional field added to an existing response | yes | no | no | MINOR |
| Email automation: whole feature, review queue, settings screen | n/a | no | no | MINOR |
| Email/Settings API `host` → `uri`, `ingest_address` reshaped (08-05, 08-10) | **no**: nothing handed to Carmen yet | yes | no | **not a break** (MINOR with the feature) |
| Same rename **after** Carmen is calling it | yes | yes | no | MAJOR |
| `has_new` → `has_notification` the day `GET /notifications` was added (08-13) | no | yes | no | not a break |
| Same rename after Carmen polls it | yes | yes | no | MAJOR |
| Drop a field Carmen reads from `ai-status` | yes | yes | no | MAJOR |
| Change what the JV / invoice posted to Carmen contains or how it is shaped | yes | yes | no | MAJOR |
| Bump `CONSENT_VERSION` (one modal click; decided not a break) | n/a | no | no | MINOR |
| Force every BU to re-save its Carmen token | yes | no | yes | MAJOR |
| Bug fix, prompt tweak, slow query, wording | n/a | no | no | PATCH |
| Encrypt a column at rest, add RLS, add CSP | n/a | no | no | none (internal) |
| Rename folders, move components, CI, dependency bump | n/a | no | no | none (refactor) |

A prompt tweak that changes **what is extracted** (a different number lands in the same field) is PATCH
if it fixes a misread, and MINOR if it newly supports a document layout.

### Edge cases decided

- **Pre-consumer breaks are free.** Until a surface has shipped to someone outside, rewrite it as needed
  and record in the changelog that nobody had it. This is the ruling used in
  [VERSION_AUDIT_2026-11-05.md](VERSION_AUDIT_2026-11-05.md).
- **Internal DB migrations never bump**, unless a person has to do something after them (Q3).
- **Behaviour users notice but nothing breaks** (new default sort, new wording, a moved button) is PATCH,
  or MINOR if there is a new capability behind it.
- **At `0.x`** the MAJOR outcome above becomes MINOR (see *Current phase*); the three questions are still
  asked, so the changelog line still says "breaking".

## How to bump (one PR, one commit)

1. Edit [`VERSION`](../VERSION), e.g. `0.1.0` → `0.2.0` (at `0.x`) or `1.0.2` → `1.1.0` (from 1.0.0).
2. Add the matching `version: '0.2.0'` to the **newest** entry in
   [`frontend/src/shared/content/releaseNotes.ts`](../frontend/src/shared/content/releaseNotes.ts)
   (2–4 bullets, EN + TH). `releaseNotes.test.ts` fails if the two disagree.
3. Add today's [`changelog/YYYY-MM-DD.md`](../changelog/) entry (CI's `changelog-check` requires it, and the release uses it as its notes).
4. Merge to `main`.

Not every PR bumps. Batch several PRs into one release and park the pending note in the
changelog until you cut it.

## What derives from `VERSION`

| Where | How |
|---|---|
| Backend | `backend/app/config.py` `_read_version()` → `app_version` → `GET /api/version` (and `/docs` where `EXPOSE_API_DOCS=true`). `APP_VERSION` env overrides, but it is an override, not the source |
| Frontend | `vite.config.ts` / `vitest.config.js` bake it in as `__APP_VERSION__`, shown on Home |
| GitHub | `deploy.yml` step *Create release from changelog*, on push to `main` only |

## The GitHub release / tag

On a push to `main`, the last step of [`deploy.yml`](../.github/workflows/deploy.yml):

1. `tag = v$(cat VERSION)` (e.g. `v0.1.0`).
2. No `changelog/<today ICT>.md` → skip, silently.
3. `gh release view $tag` already exists → skip (VERSION was not bumped, so this deploy is not a release; not an error).
4. Otherwise `gh release create $tag --title $tag --notes-file changelog/<today>.md`. GitHub creates the tag on the head commit of `main`.

Consequences: bump `VERSION` **on a day that has a changelog file**, and only the first deploy after the bump creates the release.

> **Status (2026-11-05):** the step has never run. The Deploy workflow has never passed (secrets/Render not
> configured), and it is the last step of that job. `git tag` is empty and the repo has no GitHub releases.
> Until Deploy passes (or the step is moved to its own workflow), a bump only changes the number inside the app.
> Backfill a tag by hand with `gh release create vX.Y.Z --target <commit> --title vX.Y.Z --notes-file <file>`.

## Dates are not versions

`changelog/YYYY-MM-DD.md` filenames and the release-note `date` (its identity and the notification
bell's seen-key) keep their own jobs. A date is never a version, and a version is never a date.
