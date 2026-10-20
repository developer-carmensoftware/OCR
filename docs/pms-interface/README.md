# PMS Interface

> **Status, 2026-10-16.** Built on our side; one read from Carmen is still missing.
>
> | Part | State |
> |---|---|
> | **The hook, per-BU keys, `#/pms`** (CA-93 phase 1, CA-113/114/117/121) | Merged (PR #284). Live on QA (`carmen-ocr-backend-xntb`) since 2026-10-08. Not on prod yet (CA-118). |
> | **Processing, first version:** our own JV via `/gljv` (decision-log #42) | Merged (PR #286, #287). Live on QA. `pms-process` cron scheduled on dev. **Replaced by the row below.** |
> | **Processing, path B:** Carmen's engine posts by Carmen's config (decision-log #43) | Draft PR **#292**, branch `feat/pms-carmen-engine`. **Don't merge** until Carmen exposes the PMS setting under `/api/interface`. See [07-status.md](07-status.md#what-blocks-the-merge). |
>
> This folder describes **path B**, the code on `feat/pms-carmen-engine`. `main` and QA still
> run the first version until #292 merges.

## What it does, in one paragraph

A hotel's PMS (Comanche today) closes each day with a night audit and writes that day's
figures into Carmen's **Data Bank**. Carmen already has an engine that posts a Data Bank day
to the GL, driven by a per-PMS config and a per-BU **mapping table** (PMS row → department and
account). The engine refuses a day while any of its rows is missing from that table, and new
PMS codes keep appearing. Carmen's own table covered only 1 of 73 dev days in full. The PMS
interface removes that chore. Carmen sends us a four-field hook naming the day. We read the
day back and find the rows the table cannot place, and the AI suggests an account for each.
The day then waits in the AI JV Automation queue until a person ticks or replaces those
accounts. On Approve, the accounts go into Carmen's table and Carmen's engine posts the day.
**We decide no debit, credit or total.** Those are Carmen's per-PMS config (decision-log #43).

## Where this fits

PMS days are the **third source** of the AI JV Automation queue (`#/CreditCardOCR`), next to
email documents and manual scans. They use the same chips and the same reason ladder, and a
review modal in the email review's shell. The flow borrows from email automation wherever it
can:
- the review step and the `auto_post` rule (decision-log #24);
- the one stored Carmen credential per BU (decision-log #35, #38, #42);
- the ledger shape (`pms_events` copies `email_documents`'s columns).

| | Email automation | PMS interface |
|---|---|---|
| What starts it | pg_cron polls IMAP | Carmen POSTs a hook to `/api/v1/pms/events`. A 10-minute sweep picks up what is left |
| Which BU | the `+tag` in the address, read before any LLM call | the API key; the body never names a BU |
| What is read | a PDF attachment, by the vision LLM | a Data Bank day (JSON), by Carmen's API |
| LLM | vision extraction, then a GL suggestion | a GL suggestion, only for rows Carmen's table cannot place |
| Cost | one document per file, charged at the vision call | **none**: the BU pays for the interface separately |
| Where the mapping lives | ours (the BU's accounting config) | **Carmen's** mapping table |
| Who builds the JV | us (`post_gljv`) | **Carmen's engine** (`interfacePostGL/REVENUE`) |
| Ledger row | `email_documents`: message × attachment | `pms_events`: BU × day |
| Settings screen | `#/CreditCardOCR/email-settings` | `#/pms` |
| Carmen credential | `email_ingest_settings.carmen_token_enc` | **the same column** (decision-log #42) |
| `auto_post` | `email_ingest_settings.auto_post` | `pms_settings.auto_post` |

## Doc map

| File | Read this for |
|---|---|
| [01-requirements.md](01-requirements.md) | What the feature must do, for whom, and the business rules |
| [02-architecture.md](02-architecture.md) | How it works: sequence diagrams for the hook, one day, approve; the gate ladder; the state machine |
| [03-api-reference.md](03-api-reference.md) | Our 11 `/api/v1/pms` routes, plus the queue and admin ones, and every Carmen endpoint we call, with status codes and shapes |
| [04-data-model.md](04-data-model.md) | `pms_events`, `pms_settings`, `api_keys`, `review_payload`, the `reason_code` taxonomy, migration lineage |
| [05-operations.md](05-operations.md) | Cron, deploy order, observability, runbook, tests, known gaps |
| [06-decision-log.md](06-decision-log.md) | Decisions #39–#43 in brief, and what path A was |
| [07-status.md](07-status.md) | Jira (CA-93 and its subtasks), what Jira says against what is built, what Carmen still owes |

These documents live outside this folder:

| File | Audience | Covers |
|---|---|---|
| [`../PMS_INTEGRATION.md`](../PMS_INTEGRATION.md) | Carmen devs (English) | The hook contract: URL, key, body, responses, a test checklist, open questions |
| [`../email-automation/06-decision-log.md`](../email-automation/06-decision-log.md) #39–#43 | Us | The **canonical** PMS decisions. They share the email log's numbering, so add new PMS decisions there |

## Glossary

| Term | Meaning |
|---|---|
| **Data Bank** | Carmen's store of interface files. The PMS writes one row per day: `POST`/`PATCH /api/interface/PMS/{name}/{docType}` (Add / AddOrUpdate). `FileData` is a JSON object (`Transaction[]`, `Statistic[]`, `Information`). |
| **Hook** | Carmen's notification that a Data Bank day was written: `{InterfaceType, InterfaceName, DocType, DocDate}`. It carries no figures. |
| **Day key** | `PMS/Comanche/Daily/2026-10-07`, which is `pms_events.event_id`. There is one row per BU × day key. |
| **API key** | `cpk_…`, issued per BU at `#/pms`, scope `pms:events`. **The key is the tenant.** |
| **PMS setting** | The BU's GL interface setting in Carmen (`interfacePost/Setting/GL`), e.g. `Comanche.PMS`. Each section (`Revenue`, …) carries an INI file in base64 (`ConfigBase64`) and a counter account. |
| **Section** | The part of a setting the engine posts by. We use only `REVENUE`: one day, one JV. |
| **Spec** | What we read from the INI: where the rows are (`JsonKeys`), what keys the mapping (`Mapping_MapCode`), the amount field, `UseAccountMap`. `carmen_config.Spec` |
| **Mapping key** | The values of the key columns, in order, as a JSON array: `["100","Room Charge - VAT"]` for Comanche (`[Code][Description]`). So a tax row is its own key, and so is a renamed description. |
| **Mapping table** | Carmen's per-setting table: key columns → `DeptCode`/`AccCode`. Carmen's own screen edits it, and so does our Approve. **A PUT replaces it whole.** |
| **New row / new key** | A key of the day that has no account in the mapping table. Only these go to the AI and to the reviewer. |
| **Counter account** | The section's `DeptCode`/`AccCode`. The engine posts the day's remainder (its Summary line) there, and `interfacePostGL` requires it in the body. |
| **Engine** | `POST /api/interface/interfacePostGL/REVENUE`. Carmen's own posting, by its config. It answers without a JV number. |
| **Menu token / interface token** | The `<hash>\|<uuid>` token in Carmen's SSO link. It opens only `/api/interface/*`. Stored as the BU's credential. |
| **Web JWT** | Carmen's browser login (`Bearer eyJ…`). It opens everything **except** `/api/interface/*`. We never hold one. |
| **Park** | Set a day to `pending_review` with what the review needs in `review_payload`. |

## Source files

| Path | Role |
|---|---|
| `backend/app/routers/pms.py` | All 11 `/api/v1/pms/*` routes: the hook, the sweep, keys, a day's review, settings, credential |
| `backend/app/services/pms/process.py` | One day end to end (`process_event`), the sweep, the wake/requeue rules, `post_day` |
| `backend/app/services/pms/carmen_config.py` | Reads Carmen's PMS setting the way the engine does: INI, section, spec, rows, keys, the merged table. Pure. |
| `backend/app/services/pms/mapping.py` | The AI's suggestion for new rows, the BU's GL masters, the review `flags` |
| `backend/app/services/pms/review.py` | `get_day`, `approve`, `reject`, `recheck`, the auto-post settings |
| `backend/app/services/shared/api_keys.py` | Issue (cap 2), authenticate (sha256), revoke |
| `backend/app/services/shared/carmen.py` | `get_databank_day`, `get_pms_settings`, `get_pms_mapping`, `put_pms_mapping`, `post_pms_gl` |
| `backend/app/services/email_automation/credential.py` | The shared credential: `set_token`, `posting_target` |
| `backend/app/services/credit_card/activity.py` (`_pms_*`) | PMS days as queue rows |
| `backend/app/models/pms.py`, `models/schemas/pms.py` | ORM `PmsEvent`, `PmsSettings`; every request and response shape |
| `frontend/src/features/pms/pages/PmsPage.tsx` + `features/pms/api/` | `#/pms`: keys, auto-post, storing the link's token |
| `frontend/src/features/credit-card/pages/PmsReviewDocument.tsx` + `hooks/usePmsReview.ts` + `api/pmsReview.ts` | The review modal at `#/CreditCardOCR/review?pms=<id>` |
| `frontend/src/shared/components/apiKeys/` | Key dialogs and status line, shared with `#/admin/api-keys` |
| `frontend/src/shared/lib/reviewReasons.ts` | `reason_code` → the sentence the queue prints |
| `supabase/migrations/20261007000000_pms_events.sql`, `20261009000000_pms_processing.sql`, `20261015000000_pms_carmen_engine.sql` | Schema, the module row, the cron. Lineage in [04-data-model.md](04-data-model.md#migration-lineage) |
