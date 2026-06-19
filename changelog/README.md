# Changelog

Human-readable log of what changed, **one file per day** (`YYYY-MM-DD.md`), newest day = highest date. Source of truth for writing release notes / status reports without digging through `git log`.

## Convention

- Add an entry the same day you make a meaningful change. One file per date.
- **Prefix every entry with its time** as `` `HH:MM` `` (24h, ICT +0700) — the time the change was made (committed entries use the commit time). A grouped block of related work can carry one timestamp on its heading.
- Group by area when useful (Backend / Frontend / DB / Infra).
- Note **uncommitted / in-progress** work in its own section so it's clear what's not yet shipped.
- Keep it terse — a bullet per change, link the commit hash when it exists. Reference files as needed.
- Backfilled entries (dates before this folder existed) are reconstructed from commit history — time = commit time, plus the short hash.
