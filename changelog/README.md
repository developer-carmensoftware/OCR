# Changelog

Human-readable log of what changed, **one file per day** (`YYYY-MM-DD.md`), newest day = highest date. Source of truth for writing release notes / status reports without digging through `git log`.

## Convention

- Add an entry the same day you make a meaningful change. One file per date.
- **Prefix every entry with its time** as `` `HH:MM` `` (24h, ICT +0700) — the time the change was made (committed entries use the commit time). A grouped block of related work can carry one timestamp on its heading.
- Group by area when useful (Backend / Frontend / DB / Infra).
- Note **uncommitted / in-progress** work in its own section so it's clear what's not yet
  shipped. Once it ships (even on a later day), replace that heading with a one-line
  `Shipped as PR #nnn (`hash`)` note instead of leaving "in progress" permanently true of
  work that finished — don't go back and edit older day files to add this after the fact,
  the entry is a record of that day, not a live status board.
- Keep it terse — a bullet per change, link the commit hash when it exists. Reference files as needed.
- Backfilled entries (dates before this folder existed) are reconstructed from commit history — time = commit time, plus the short hash.

## User-facing release notes

This file is an **engineering** log — file paths, function names, English only. It is not what
users read. User-visible changes are collected into a **monthly** entry in
[`frontend/src/shared/content/releaseNotes.ts`](../frontend/src/shared/content/releaseNotes.ts), shown
in the Changelog dialog the notification bell opens.

- **Not every deploy gets one.** Refactors, CI fixes and dependency bumps get a changelog line here
  and nothing there. That restraint is what keeps the cost near zero.
- **One entry per month, at most.** A PR between monthly cuts lists its user-visible bullets in its
  changelog file ("pending for the <month> release note"); the cut turns them into the entry. A
  month with nothing user-visible gets no entry.
- **New Features / Enhancements, each bullet `Name (Module): description`** (a baseline release that
  sums up the product, like 0.1.0, uses Key Features instead of New Features), Module as the screen
  names it (AI JV Automation, AP Invoice Processing, Plans & Credits). Fixes go under Enhancements.
- **Both EN and TH.** TypeScript will not compile with one missing.
- **The release date is the identity** (the notification bell's seen-key).
- **The version is a separate job from the date.** An entry's `version:` must equal the repo-root
  [`VERSION`](../VERSION) file in the same commit — `releaseNotes.test.ts` fails the PR if they
  disagree, and `deploy.yml` cuts the GitHub Release tag as `v$(cat VERSION)`. A date is never a
  version.
