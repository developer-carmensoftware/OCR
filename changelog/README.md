# Changelog

Human-readable log of what changed, **one file per day** (`YYYY-MM-DD.md`), newest day = highest date. Source of truth for writing release notes / status reports without digging through `git log`.

## Convention

- Add an entry the same day you make a meaningful change. One file per date.
- **Prefix every entry with its time** as `` `HH:MM` `` (24h, ICT +0700) — the time the change was made (committed entries use the commit time). A grouped block of related work can carry one timestamp on its heading.
- Group by area when useful (Backend / Frontend / DB / Infra).
- Note **uncommitted / in-progress** work in its own section so it's clear what's not yet shipped.
- Keep it terse — a bullet per change, link the commit hash when it exists. Reference files as needed.
- Backfilled entries (dates before this folder existed) are reconstructed from commit history — time = commit time, plus the short hash.

## User-facing release notes

This file is an **engineering** log — file paths, function names, English only. It is not what
users read. When a change is visible to a user, also add an entry to
[`frontend/src/content/releaseNotes.ts`](../frontend/src/content/releaseNotes.ts), which renders in
the in-app notification bell.

- **Not every deploy gets one.** Refactors, CI fixes and dependency bumps get a changelog line here
  and nothing there. That restraint is what keeps the cost near zero.
- **2-4 bullets, one line each**, describing what the user can now do or will now see.
- **Both EN and TH.** TypeScript will not compile with one missing.
- **The date is the identity** and matches this folder's file for that day. One entry per date —
  ship twice in a day and you edit that day's entry.
- **The version is a separate job from the date.** An entry's `version:` must equal the repo-root
  [`VERSION`](../VERSION) file in the same commit — `releaseNotes.test.ts` fails the PR if they
  disagree, and `deploy.yml` cuts the GitHub Release tag as `v$(cat VERSION)`. A date is never a
  version.
