# Architecture

How the pieces fit, and what happens, in order, for each flow. The diagrams are Mermaid, as in
[`../email-automation/02-architecture.md`](../email-automation/02-architecture.md).

## Diagram 1 — component map

```mermaid
flowchart LR
    PMS["Hotel PMS\n(Comanche)"] -->|"night audit: Add / AddOrUpdate"| DataBank["Carmen Data Bank"]
    DataBank -->|"hook {InterfaceType, InterfaceName, DocType, DocDate}\nBearer cpk_…"| API["FastAPI\nrouters/pms.py"]
    Cron["pg_cron\npms-process */10"] -->|"POST /api/v1/pms/process/run"| API

    API --> Proc["services/pms/process.py"]
    Proc -->|"read setting + INI"| CSetting["Carmen\ninterfacePost/Setting/GL"]
    Proc -->|"read the day"| DataBank
    Proc -->|"read mapping"| CMap["Carmen\ninterfacePost/mapping"]
    Proc -->|"new rows only"| LLM["Text LLM\n(OpenRouter, deny)"]
    Proc -->|"post"| Engine["Carmen engine\ninterfacePostGL/REVENUE"]

    Menu["Carmen menu item"] -->|"SSO link ?token=&bu=&user=&uri="| PmsPage["#/pms\nkeys · auto-post · credential"]
    PmsPage -->|"/api/v1/pms/keys, /settings, /credential"| API
    Queue["#/CreditCardOCR\nAI JV Automation queue"] -->|"review?pms=id"| Review["PmsReviewDocument"]
    Review -->|"/api/v1/pms/days/{id}/approve · reject"| API
    API --> Rev["services/pms/review.py"]
    Rev -->|"PUT mapping (whole table)"| CMap
    Rev -->|"post"| Engine

    API --> DB[("Postgres")]
    DB -.-> T1["pms_events"]
    DB -.-> T2["pms_settings"]
    DB -.-> T3["api_keys"]
    DB -.-> T4["email_ingest_settings\n(the shared credential)"]
    DB -.-> T5["llm_usage_logs · job_runs"]
```

All Carmen calls go to `{uri}/Carmen.API/api/interface/…` with the BU's stored menu token
(`carmen._base_url()`). That token opens nothing outside `/api/interface`, and that is why the
setting read is still blocked. See [Not built](#not-built) and [07-status.md](07-status.md).

## Diagram 2 — onboarding

```mermaid
sequenceDiagram
    participant User as BU user
    participant Carmen as Carmen (menu, PMS settings)
    participant Page as OCR #/pms
    participant API as OCR API

    User->>Carmen: open the AI → PMS menu item
    Carmen->>Page: #/pms?token=&bu=&user=&uri=
    Page->>API: POST /api/v1/auth/exchange (useCarmenSSO)
    Note over API: creates or finds the (host, bu) tenant.<br/>A first visit also gets consent + 30 signup credits
    Page->>API: PUT /api/v1/pms/credential {token}
    API->>Carmen: verify_token (GET /department)
    Note over API: stored Fernet-encrypted on email_ingest_settings.<br/>Days stopped for want of it go back to `received` and are kicked
    User->>Page: Create key
    Page->>API: POST /api/v1/pms/keys → 201 {key: "cpk_…"} (shown once)
    User->>Carmen: paste the key into Carmen's PMS settings
    User->>Page: auto-post on/off (default off)
    Page->>API: PUT /api/v1/pms/settings {auto_post}
```

`useCarmenSSO` keeps the link's token in `sessionStorage[CARMEN_POSTING_TOKEN_KEY]`.
`PostingSettings` (`PmsPage.tsx`) PUTs it before it reads anything, and removes it only once
the PUT succeeds. After a failure, a reload tries again: nothing else brings that token back.

## Diagram 3 — the hook

```mermaid
sequenceDiagram
    participant Carmen
    participant R as routers/pms.py
    participant DB as pms_events
    participant P as process.kick

    Carmen->>R: POST /api/v1/pms/events (Bearer cpk_…)
    R->>R: _pms_key: strip "bearer", sha256, live key + live tenant + scope pms:events
    Note over R: 401 on any miss (never says which).<br/>Stamps last_used_at / last_used_ip.
    R->>R: body ≤ 16 KB (413), strip BOM, PmsEventIn (422 names the field)
    R->>DB: INSERT … ON CONFLICT (tenant_id, event_id) DO NOTHING
    alt a new day
        DB-->>R: id
        R-->>Carmen: 202 {id, duplicate:false}
        R->>P: kick(id)
    else the same day again
        R->>DB: UPDATE updated_at = now()
        R->>DB: reset to received IF status ≠ posted AND no live review claim
        R-->>Carmen: 200 {id, duplicate:true}
        R->>P: kick(id) only if the reset happened
    end
```

The commit comes before `kick`, so a crash between them leaves a `received` row for the sweep.
`kick` holds a strong reference to its task (`_running`). Without it, asyncio could
garbage-collect the task while it is still running.

## Diagram 4 — one day (`process_event`)

```mermaid
sequenceDiagram
    participant W as process_event
    participant DB as pms_events
    participant C as Carmen /api/interface
    participant L as LLM

    W->>DB: _claim: status=received, attempts<3, lease free → processed_at=now, attempts+1
    W->>DB: _target: the BU's token + uri (email_ingest_settings)
    W->>C: GET interfacePost/Setting/GL
    W->>W: find_section(InterfaceName) → REVENUE → parse INI → spec_of
    W->>C: GET PMS/{name}/{docType}/Date/{docDate}
    W->>W: newest_day (LastModified) → rows_of → [{key, values, amount}]
    W->>C: GET interfacePost/mapping/{setting}/REVENUE/GL
    W->>W: table_of → new_keys
    opt there are new keys
        W->>C: accounts + departments (mapping.masters)
        W->>L: one call: new rows + up to 120 mapped rows as examples
        W->>W: keep only codes in the BU's chart (_validate_codes)
    end
    W->>W: payload {rows, mapped, guessed, flags, missing, ai, counter, databank_id, …}
    alt flags, or auto_post off
        W->>DB: park → pending_review
    else nothing new and auto_post on
        W->>C: POST interfacePostGL/REVENUE {Code, DateFrom=DateTo, DeptCode, AccCode, id:[databank_id]}
        W->>DB: posted (or parked with Carmen's words if it refused)
    end
```

Context for the duration of the day: `current_tenant_id` is set for the LLM log, and
`current_carmen_uri` for `carmen._base_url()`. Both are reset in `finally`.

## Diagram 5 — the gate ladder

Each step either moves on, **retries** (the row stays `received` with a `reason_code`, and
the sweep tries again once the 10-minute lease expires), **fails** (terminal) or **parks**.
"Retry" becomes `failed` on the third attempt.

```mermaid
flowchart TD
    A[claimed] --> B{credential stored?}
    B -->|"no"| Rno[retry: no_credential]
    B -->|"yes"| C{read the PMS setting}
    C -->|"error"| Rcfg[retry: carmen_config_unreadable]
    C -->|"ok"| D{active setting for InterfaceName, with an active REVENUE section?}
    D -->|"no"| Rset[retry: pms_setting_missing]
    D -->|"yes"| E{INI is a JSON-object layout?}
    E -->|"no"| Ffmt[FAILED: unsupported_pms_format]
    E -->|"yes"| F{read the Data Bank day}
    F -->|"401 / 403 / other"| Rdb[retry: carmen_unauthorized / carmen_forbidden / databank_unreachable]
    F -->|"ok"| G{a row with items under JsonKeys?}
    G -->|"no"| Rnf[retry: day_not_found]
    G -->|"yes"| H{items are objects?}
    H -->|"no"| Fun[FAILED: unreadable_day]
    H -->|"yes"| I{read the mapping table}
    I -->|"error"| Rcfg
    I -->|"ok"| J{new keys?}
    J -->|"yes"| K[masters + LLM]
    K -->|"401/403"| Rdb
    K -->|"other error / LLM empty"| L
    K -->|"ok"| L{flags or auto_post off?}
    J -->|"no"| L
    L -->|"yes"| Park[PARK: pending_review, reason null]
    L -->|"no"| M{interfacePostGL}
    M -->|"Result true / Code -200"| Posted[POSTED]
    M -->|"refused"| Prej[PARK: carmen_rejected + Carmen's words]
    M -->|"401/403"| Pauth[PARK: carmen_unauthorized / carmen_forbidden]
```

An unexpected exception anywhere is caught: the attempt retries as `processing_error`, so a
day is never stranded by an error nobody sees.

Two outcomes are terminal at once, without spending the attempts: `unsupported_pms_format` and
`unreadable_day`. Retrying cannot change either. Someone has to change Carmen's setting or the
PMS file, and then Carmen has to re-send the day.

## Diagram 6 — approve

```mermaid
sequenceDiagram
    participant U as Reviewer
    participant R as review.approve
    participant DB as pms_events
    participant C as Carmen /api/interface

    U->>R: POST /days/{id}/approve {mappings: {key: {dept, acc}}}
    R->>DB: claim: pending_review AND (posting_started_at null OR > 5 min old) → now
    Note over R: 404 not this BU's / not there · 409 someone else holds it or already handled it
    R->>C: GET mapping (fresh). Error → 503, nothing written
    R->>R: new_keys against the FRESH table. A key Carmen mapped meanwhile keeps Carmen's
    R->>R: every remaining key has dept + acc, else 400 "Pick an account for every new row"
    R->>C: accounts + departments → dept exists, acc exists, dept allows acc (else 400, naming the row)
    R->>C: PUT mapping = every row just read + the picks (merged_rows)
    R->>C: POST interfacePostGL/REVENUE
    alt Result true, or Code -200 Already Posted
        R->>DB: posted, review_payload null, reviewer recorded
        R->>DB: recheck: the BU's other parked days of this interface
    else refused (PostRefused) → 400 · unreachable → 503
        R->>DB: release the claim; the day stays parked
    end
```

**The PUT can land while the post fails.** The accounts are then in Carmen's table and the day
is still parked. Approving again is safe: the fresh table now has those rows, so nothing is
new, and the engine refuses a day it has already posted (`-200`, recorded as `already_posted`).

**The table is never written blind.** Carmen's PUT replaces the whole table, so a partial list
would delete the BU's other rows. That is why the GET comes first on every approve, and why a
failed GET stops everything.

## Diagram 7 — state machine

```mermaid
stateDiagram-v2
    [*] --> received: hook (202)
    received --> received: retry (reason set, attempts < 3)
    received --> failed: 3rd attempt, or unsupported_pms_format / unreadable_day
    received --> pending_review: park (new rows, auto_post off, Carmen refused)
    received --> posted: auto_post + nothing new + engine ok
    pending_review --> posted: approve
    pending_review --> rejected: reject
    pending_review --> received: requeue (auto-post BU, flags now empty)
    failed --> received: newer credential (WAKE_REASONS)
    pending_review --> received: repeat hook
    rejected --> received: repeat hook
    failed --> received: repeat hook
    posted --> [*]
```

A repeat hook never moves `posted`. It also leaves a `pending_review` day alone while a
reviewer's claim on it is live (less than 5 minutes old).

## The sweep, and the two wake rules

`run_pms_processing()`, called by pg_cron every 10 minutes and serialised by `_sweep_lock`,
does three things in order:

1. **`_requeue_ready_days`.** Some parked days belong to an `auto_post` BU, have no
   `reason_code` and have no `flags` left: an approve on another day mapped their last rows
   (`recheck`), or the BU turned auto-post on with days waiting. These go back to `received`
   and are **read again from scratch** before they post. A day parked *with* a reason
   (`carmen_rejected`, …) is left for a person.
2. **`_wake_for_new_credential`.** Some days are `received` or `failed` with a reason in
   `WAKE_REASONS` (`no_credential`, `carmen_unauthorized`, `carmen_forbidden`,
   `carmen_config_unreadable`). These go back with their attempts reset, but only once the BU's
   `carmen_token_verified_at` is newer than the day's `processed_at`. Any writer of the shared
   credential therefore wakes them: `#/pms`, the email settings, or the daily email
   token-health check. (`PUT /pms/credential` also wakes them at once, without the time test.)
3. **Process up to 50 `received` days**, oldest first, each through `process_event`, whose
   claim keeps the sweep and a `kick` from working one day twice.

A `job_runs` row (`pms-process`) is written only when the sweep did something or failed, the
same rule as the email poll. Idle runs do not bury other jobs on `#/admin/jobs`.

## Concurrency: three claims

| Claim | Column | Held for | Protects against |
|---|---|---|---|
| Processing lease | `processed_at` (+ `attempts`) | 10 min (`LEASE`) | the hook's `kick` and the sweep working one day at once; a dead worker stranding it |
| Review claim | `posting_started_at` | 5 min (`REVIEW_CLAIM_TTL`) | two reviewers posting one day; a repeat hook resetting a day mid-approve |
| Sweep lock | `asyncio.Lock` in-process | one sweep | overlapping cron calls on one instance (answers `{"status":"busy"}`) |

Carmen gives the final guard: `interfacePostGL` refuses a day it has already posted.

## Reading Carmen's config (`carmen_config.py`)

The BU's GL interface setting is a list of settings. Each has `InterfaceType`,
`InterfaceName`, `IsActive`, `Code` (e.g. `Comanche.PMS`) and `Configuration`, a map of
sections, each with `Active`, `ConfigBase64`, `DeptCode`, `AccCode` and `AccDesc`.

- **`find_section`** takes the active `PMS` setting whose `InterfaceName` matches the hook's
  (case-insensitive), then its active `REVENUE` section that has a config.
- **`decode` + `parse_ini`**: base64 → text (utf-8-sig, then utf-16, then cp874) → `[Section]`
  / `key=value`, with `;` comments. A repeated key keeps its last value.
- **`spec_of`** reads `[System]`. It requires `FileType=json`, `JsonType=jsonobject` and
  `JsonKeys` (`Transaction` for Comanche). It parses `Mapping_MapCode`, e.g.
  `[Code:Code][Description:Description]`, into (Data Bank field, table column) pairs, and reads
  `[Amount] JsonKeyName` and `UseAccountMap`. With `UseAccountMap=false`, no key is ever new.
- **`rows_of`** turns each item into `{key, values, amount}`. **It never adds, signs or
  balances**: `amount` is the string as written, kept for the reviewer to read.
- **`merged_rows`** builds the PUT body: every row just read, a pick filled in where one
  applies, then the picks the table did not have, appended.

The sides of the JV are in the same INI (`[DrCr]`; Comanche: `DrValue=-`, `CrValue=+`).
We deliberately do not read them: they are the engine's (decision-log #43).

## What the AI is asked (`mapping.suggest`)

One `call_text_llm` per day that has new keys (`module_id = pms_interface`), using the
suggestion model under the text-provider allowlist. The prompt carries:
- the new lines, as `<code> · <description>`, with their amounts;
- up to 120 of the BU's already-mapped rows, as examples of the house pattern;
- the departments;
- the accounts, filtered to `income` and `balancesheet` types when the chart types any.

It is told explicitly that **debit and credit are Carmen's, not its**.

The answer is filtered through the credit-card suggester's `_validate_codes`: unknown codes,
and pairs a department's `DefaultAccount` forbids, are dropped. An empty or failed answer
gives `{}`, and the rows park as `mapping_missing` for the reviewer to pick. The LLM is never
a reason a day stops.

## Frontend surface

| Screen | Files | What it does |
|---|---|---|
| `#/pms` | `features/pms/pages/PmsPage.tsx`, `features/pms/api/{pmsKeys,pmsSettings}.ts`, `shared/components/apiKeys/*` | Keys: list, create (shown once, Copy, closes only on Done), revoke with a "still in use" warning, create disabled at 2 active. A status line with the last call. The endpoint URL. **Posting**: the auto-post switch, which saves as it changes. A warning when no credential is stored. English only. Reached only from Carmen's menu (no Home tile, no in-app link) |
| Queue `#/CreditCardOCR` | `features/credit-card/pages/ReviewQueue.tsx`, `components/QueueRow.tsx`; backend `activity._pms_row` | A PMS day reads `PMS 05/09/2024` over `Comanche · Daily`. The chips are by status: `pending_review` → Review, `posted` → Posted, `rejected`/`failed` → Not posted. `received` is in no view. The reason reads "AI suggested mapping: 103, 729". A day Carmen had posted before we asked reads "Carmen had already posted it" |
| Review `#/CreditCardOCR/review?pms=<id>` | `features/credit-card/pages/PmsReviewDocument.tsx`, `hooks/usePmsReview.ts`, `api/pmsReview.ts` | The email review's shell. A note names the Carmen setting that posts the day. **Accounts** lists the new rows only: department and account selects, an **AI** tag, an amber **Unsure** tag for `confidence: low`, the AI's reason as a line of text, a **Checked** tick, and Undo. **Mapped in Carmen (N)** is folded underneath. The footer gives either the one blocking reason ("Pick an account for every new row." / "Check each account the AI picked (N left).") or what Approve writes. Ctrl/⌘+Enter approves. Reject takes an optional reason. Leaving with edits asks first. **No balance, no Dr/Cr, no JV lines** |
| Reason → sentence | `shared/lib/reviewReasons.ts`, `i18n/dict/pms.ts` | One phrase per `reason_code`. `no_credential` has a fix button to `#/pms`. The Carmen-setting reasons have none: they are fixed in Carmen |
| `#/admin/api-keys` | `features/admin/pages/ApiKeysPage.tsx` | Support view of every BU's keys: issue, revoke, last used |

## Not built

- **Reading the PMS setting with the menu token.** `GET interfacePost/Setting/GL` has no
  `/api/interface` twin, so today every day stops at `carmen_config_unreadable`. Carmen added
  the **mapping** GET there on 2026-10-15. The setting GET is the one left
  ([07-status.md](07-status.md#what-blocks-the-merge)).
- **A JV number** on the posted row: `jv_no` stays null because the engine's answer has none.
- **Token health for PMS-only BUs.** `sweep_token_health` walks only `enabled` email BUs.
- **A retention purge** for `pms_events`.
- **Layouts other than JSON object**, and sections other than REVENUE.
