# Email Automation

> **Status: built, merged to `main`, live-tested end to end. But neither of the two cron
> jobs is scheduled yet** (`backend/app/routers/email_automation.py:380-406`) — in
> production, nothing polls the mailbox until someone schedules `email-ingest` and
> `email-token-health`, or curls the endpoints by hand. See
> [05-operations.md](05-operations.md#scheduling) for the exact SQL.

## What it does, in one paragraph

Banks email commission and fee reports to hotels. Today a user downloads the PDF and
uploads it into the Credit Card OCR wizard by hand. Email Automation removes that step for
one document type: the customer sets up a mail-forward rule once, and every report after
that is read, extracted, GL-mapped and posted to that business unit's Carmen ERP with no
human involved. Each business unit (BU) gets its own `AIAGENT+<tag>@carmensoftware.com`
address; the tag in the address — not the document's contents — is what tells the system
which BU's books to write to, and it is read for free, before any LLM call.

## Where this fits

This is the inbound half of a wider "documents in, JV out" pattern shared with the
Credit Card OCR wizard (`CLAUDE.md` → *Credit Card OCR (5-step wizard)*) — same extraction
code, same GL-mapping service, same Carmen posting call, same `credit_cards` table. What's
different is *how the document arrives* and *that nobody reviews it before it posts*.

## Doc map

| File | Read this for |
|---|---|
| [01-requirements.md](01-requirements.md) | What the feature must do, who it's for, the business rules |
| [02-architecture.md](02-architecture.md) | How it works — sequence diagrams for every flow, the cost/refund gate ladder |
| [03-api-reference.md](03-api-reference.md) | All 8 endpoints, auth model, error shapes |
| [04-data-model.md](04-data-model.md) | The two tables, migration lineage, the `reason_code` taxonomy |
| [05-operations.md](05-operations.md) | Env vars, cron, observability, runbook, tests, known gaps |
| [06-decision-log.md](06-decision-log.md) | What was decided, why, and what was tried and reverted |

Two documents live outside this folder because they have a different audience — the Carmen
ERP development team, not an OCR-app developer:

| File | Audience | Covers |
|---|---|---|
| [`../CARMEN_INTEGRATION.md`](../CARMEN_INTEGRATION.md) | Carmen devs (English) | The integration *contract*: why the API is shaped this way, the settings API, the proposed (unbuilt) webhooks, JV posting |
| [`../CARMEN_API_SPEC.md`](../CARMEN_API_SPEC.md) | Carmen devs (Thai) | Endpoint-by-endpoint reference for the 6 customer-facing routes, with the error-code table |

This folder is written for someone extending or debugging *our* side — the ingest
pipeline, the data model, the operational reality. It cross-links to those two rather than
repeating them; where this folder and `CARMEN_INTEGRATION.md` describe the same endpoint,
this folder adds the two cron-only routes neither of the above documents.

## Glossary

| Term | Meaning |
|---|---|
| **BU** / **tenant** | A business unit, identified by the pair `(host, bu_code)` — the same identity `/auth/exchange` resolves at login. One Carmen installation can have several BUs. |
| **Ingest tag** | Random 8-hex string issued to a BU the first time it successfully enables the feature, e.g. `a1b2c3d4`. Never reissued. |
| **Ingest address** | `AIAGENT+<tag>@carmensoftware.com` — the address the customer forwards mail to. `null` until a tag exists. |
| **Rule** | One BU's mapping of a bank to filename patterns, an optional sender hint, and an optional PDF password. Decides whether an attachment is processed at all. |
| **`owner_emails`** | Optional second admission layer — the customer's own addresses. Empty = accept any sender. |
| **Posting credential** | A per-BU Carmen API token with no expiry, used to post JVs with nobody logged in. |
| **Ledger** | The `email_documents` table — one row per (message, attachment) ever looked at; the dedupe key and the audit trail. |
| **Claim** | The atomic insert into the ledger that both dedupes and marks "processing has started" for one attachment. |
| **Arrival mode** | *Auto-forward* (a mailbox rule the bank's mail never touches a human) vs *manual forward* (an employee forwards it by hand). Both produce the same tag; only the sender identity and bank detection differ. |
| **Entitlement** | Whether the BU has a live monthly package — checked at write time and again on every poll, since a lapsed package doesn't rewrite settings. |

## Source files

| Path | Role |
|---|---|
| `backend/app/services/email_ingest_service.py` | IMAP poll + the whole per-document pipeline (1116 lines) — the core of the feature |
| `backend/app/services/email_settings_service.py` | Settings store, secrets, tag allocation, token health (730 lines) |
| `backend/app/routers/email_automation.py` | The Settings API + the two cron-triggered ingest routes (407 lines) |
| `backend/app/models/email_automation.py` | ORM: `EmailIngestSettings`, `EmailDocument` |
| `backend/app/models/schemas/email_automation.py` | Request payloads: `RuleIn`, `SettingsIn`, `TokenIn` |
| `frontend/src/pages/EmailSettings.tsx` + `frontend/src/hooks/email-settings/` + `frontend/src/lib/api/emailAutomation.ts` | The internal test surface at `#/email-settings` — see [02-architecture.md](02-architecture.md#frontend-surface) |
| `scripts/email_ingest_e2e.py` | End-to-end script against the real dev mailbox + database |
| `supabase/migrations/20260803000000_email_automation.sql` and six migrations after it | Schema — full lineage in [04-data-model.md](04-data-model.md#migration-lineage) |
