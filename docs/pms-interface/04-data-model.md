# Data Model

Two PMS tables (`pms_events`, `pms_settings`, the latter per BU × PMS). One table borrowed from the baseline
(`api_keys`). One row shared with email automation (`email_ingest_settings`, for the
credential). ORM: `backend/app/models/pms.py`, and `APIKey` in `models/admin.py`.

**What each PMS row posts to is not stored here.** It lives in Carmen's mapping table
(decision-log #43). Our copy, `pms_code_mappings`, existed from 2026-10-09 to 10-15 and is
dropped.

## `pms_events`

One row per **BU × Data Bank day**: the hook, then the day's processing state. Its ledger
columns are the same shape as `email_documents`.

| Column | Type | Added by | Meaning |
|---|---|---|---|
| `id` | `uuid` PK | `20261007000000` | |
| `tenant_id` | `uuid not null` FK → `tenants` | `20261007000000` | From the key, never from the body |
| `event_id` | `varchar(100) not null` | `20261007000000` | The day key, `PMS/Comanche/Daily/2026-10-07` (`PmsEventIn.key`, ≤ 93 chars). The name predates Carmen's real hook |
| `type` | `varchar(50) not null` | `20261007000000` | `InterfaceType`, which is always `PMS` today |
| `payload` | `jsonb not null` | `20261007000000` | The hook as sent, in Carmen's field names. Processing reads `InterfaceName`, `DocType` and `DocDate` from it |
| `status` | `varchar(20) not null default 'received'` | `20261009000000` | `received` → `pending_review` → `posted` \| `rejected`. `failed` once the retries ran out. See [02 · state machine](02-architecture.md#diagram-7--state-machine) |
| `review_payload` | `jsonb` | `20261009000000` | Set only while the day is `pending_review`. **Cleared on every terminal transition**. Shape below |
| `jv_no` | `varchar(50)` | `20261009000000` | Always `null` since path B, because the engine returns no number. Path A wrote the JvhSeq here |
| `reason_code` | `varchar(50)` | `20261009000000` | Why the day stopped, or `already_posted`. [Taxonomy](#reason_code-taxonomy) |
| `error_message` | `text` | `20261009000000` | Carmen's own words (`carmen_words`), the reviewer's reject reason, or our sentence; ≤ 500 |
| `attempts` | `int not null default 0` | `20261009000000` | Processing attempts; at 3 a retryable reason becomes `failed`. Reset by a repeat hook or a wake |
| `processed_at` | `timestamptz` | `20261009000000` | The processing lease (10 min) and the last attempt's time. The wake rule compares it with `carmen_token_verified_at` |
| `posting_started_at` | `timestamptz` | `20261009000000` | The approve/reject claim (5 min). A repeat hook leaves the day alone while it is live |
| `reviewed_by` / `reviewed_by_name` / `reviewed_at` | `varchar(36)` / `varchar(100)` / `timestamptz` | `20261009000000` | The Carmen user who approved or rejected |
| `created_at` / `updated_at` | `timestamptz` | `20261007000000` | `updated_at` moves on every repeat hook: "when did we last hear of this day" |

**Indexes:** `uq_pms_events_event (tenant_id, event_id)` unique, which is what makes a repeat
a no-op. `ix_pms_events_tenant_status (tenant_id, status)` serves the queue. `ix_pms_events_created_at`
is in the migration only.

RLS is enabled and forced, with no policies, the same backstop as every table. The app role
bypasses it.

### `review_payload` (path B)

Written by `process._process`. Read by `review.get_day`, `review.approve`, `recheck`, and the
queue row (`activity._pms_row`).

```jsonc
{
  "interface_type": "PMS", "interface": "Comanche", "doc_type": "Daily", "doc_date": "2024-09-05",
  "setting_code": "Comanche.PMS", "post_type": "REVENUE",
  "counter": {"dept": "GEN", "acc": "1021001", "name": "…"},  // the section's counter account
  "key_columns": ["Code", "Description"],                    // Mapping_MapCode's table columns
  "rows": [{"key": "[\"100\",\"Room Charge\"]", "values": {…}, "amount": "153068.41"}],
  "mapped": {"<key>": {"dept", "acc", "name"}},   // Carmen's accounts for this day's keys, when read
  "guessed": {"<key>": {"dept", "acc", "confidence", "why"}},  // the AI's, for new keys
  "flags": ["mapping_missing", "mapping_guessed"],  // empty = may post unattended
  "missing": ["<key>"],                             // new, no usable AI pick
  "ai": ["<key>"],                                  // new, the AI's pick only
  "databank_id": 126, "last_modified": "…"
}
```

`flags` and `missing`/`ai` are recomputed by `recheck` after any approve of the same BU and
interface, so a day's queue row stops naming a code once someone approves that code on
another day. A path-A payload (signed rows, a balance, `jv_prefix`) cannot appear: migration
`20261015000000` cleared every unposted day's payload and sent it back to be read again.

## `pms_settings`

One row per BU × PMS, created on Carmen's first `PUT /api/v1/carmen/pms/settings` for that
PMS (decision-log #44). A missing row means `auto_post = false`.

| Column | Type | Meaning |
|---|---|---|
| `tenant_id` | `uuid`, PK part, FK → `tenants` | |
| `interface_name` | `varchar(40)`, PK part | The PMS: the hook's `InterfaceName`, lower-case. `process` looks it up with the day's name lower-cased |
| `auto_post` | `boolean not null default false` | On: a day with no new rows posts by itself. Off: every day waits. A day with new rows waits under either setting |
| `created_at` / `updated_at` / `created_by` / `updated_by` | | `TimestampMixin` + `WriterMixin` |

`jv_prefix` (added `20261009000000`) was dropped by `20261015000000`. The prefix is the
setting's `JvType` in Carmen. Until `20261016000000` the key was `tenant_id` alone (one
switch per BU, set on `#/pms`); that migration dropped those rows, so every PMS started off.

## `api_keys` (baseline table, first used by PMS)

| Column | Meaning for PMS |
|---|---|
| `key_hash` | `sha256(plaintext)`. Unique among live keys (`uq_api_key_hash_active … where revoked_at is null`), which is what `authenticate()` looks up |
| `key_prefix` | The first 12 characters (`cpk_` + 8), which is all anything ever shows |
| `tenant_id` | **The BU the key writes into** |
| `interface_name` | **The PMS the key is for** (lower-case). A hook naming another is a `403`. Null only on keys revoked by `20261016000000` |
| `scopes` | `["pms:events"]` |
| `name` | `"<pms> hook"`, e.g. `comanche hook` |
| `last_used_at` / `last_used_ip` | Stamped on every authenticated hook. Carmen's PMS setting reads it as `key.last_used_at`; `#/admin/api-keys` shows it as "Last call" |
| `revoked_at` / `revoked_by` / `revoke_reason` | Revocation; immediate |
| `expires_at` | Never set. Keys do not expire (decision-log #39) |
| `rate_limit_rpm` | Unused. The per-IP middleware limit applies |

**One live key per tenant and PMS** (decision-log #44): `issue()` revokes the live key of
that (tenant, PMS) and inserts the new one in the same transaction, and the partial unique
index `uq_api_keys_live_interface (tenant_id, interface_name) where revoked_at is null` makes
two generates at the same instant a `409` instead of two live keys. Until `20261016000000`
it was 2 live keys per tenant for any PMS, checked by count; that migration revoked them all.
`api_key_usage` exists but is still unused.

## The shared credential: `email_ingest_settings`

PMS stores nothing of its own for Carmen access (decision-log #42). It reads and writes the
BU's `email_ingest_settings` row:

| Column | Use |
|---|---|
| `carmen_token_enc` | The Carmen token, Fernet-encrypted. Any write from Carmen's PMS setting screen, or any email-settings visit, replaces it |
| `carmen_uri` | The Carmen origin. Empty falls back to `https://<tenants.host>` (`credential.posting_target`) |
| `carmen_token_verified_at` | Last proven. **The wake rule:** a `WAKE_REASONS` day whose `processed_at` is older goes back to `received` |

A BU that uses PMS and has never opened email settings still gets a row (`set_token`
creates it) with `enabled = false`. So the daily token-health sweep, which reads only
`enabled` rows, never checks a PMS-only BU's token.

## `reason_code` taxonomy

| Code | Set by | Status it leaves | Fixed by | Queue sentence |
|---|---|---|---|---|
| `no_credential` | process | `received` → `failed` at 3 | saving the PMS setting in Carmen (a write stores the token when none is held, #45) | No Carmen access is stored. Save this PMS setting in Carmen |
| `carmen_config_unreadable` | process | `received` → `failed` | **Carmen** exposing the setting GET under `/api/interface`. **Every day today** | Carmen doesn't let this access read its PMS settings yet |
| `pms_setting_missing` | process | `received` → `failed` | an active PMS setting for this `InterfaceName`, with an active REVENUE section, in Carmen | Carmen has no PMS posting setting for this interface |
| `unsupported_pms_format` | process | **`failed` at once** | Carmen's setting is not a JSON-object layout; needs code here | Carmen's PMS setting uses a file the AI can't read yet |
| `carmen_unauthorized` | process (Data Bank read, chart read, post) | `received` → `failed`, or `pending_review` when the post was refused | a fresh menu token | (email's phrase) |
| `carmen_forbidden` | the same | the same | the menu user's permissions in Carmen, e.g. `Inf.PMS.DataBank` View | Carmen denied this access |
| `databank_unreachable` | process | `received` → `failed` | Carmen being back | Could not reach Carmen's Data Bank |
| `day_not_found` | process | `received` → `failed` | the PMS writing the day; Carmen re-sending the hook | Carmen's Data Bank does not have this day |
| `unreadable_day` | process | **`failed` at once** | the PMS file | Could not read this day from the Data Bank |
| `processing_error` | process (any unexpected exception) | `received` → `failed` | us: read the log | Processing stopped with an error |
| `carmen_rejected` | process (auto-post refused) | `pending_review` | the reviewer, with Carmen's words on screen | (email's phrase, or Carmen's words) |
| `rejected_by_reviewer` | review | `rejected` | — | (email's phrase) |
| `already_posted` | process or review | `posted` | — (Carmen had posted the day itself) | "Carmen had already posted it" |

**`WAKE_REASONS`** = `no_credential`, `carmen_unauthorized`, `carmen_forbidden`,
`carmen_config_unreadable`. These are the reasons a fresher credential can cure.

**Review `flags`** (not reason codes, but they gate auto-post the same way):
`mapping_missing` (a new row with no usable AI pick) and `mapping_guessed` (a new row with
the AI's pick only). The names are the email queue's, so `QueueRow.reasonFor` prints them
unchanged. **There is no balance flag:** the sides are Carmen's.

## Migration lineage

| Migration | What it does |
|---|---|
| `20261007000000_pms_events.sql` | `pms_events` as an inbox: `event_id`, `type`, `payload`, the unique key, RLS |
| `20261009000000_pms_processing.sql` | The ledger columns on `pms_events`. Creates `pms_code_mappings` (path A) and `pms_settings` with `jv_prefix` and `auto_post`. Inserts the `modules` row `pms_interface` (sort 4). Schedules the **`pms-process`** cron (`*/10 * * * *` → `/api/v1/pms/process/run`) |
| `20261015000000_pms_carmen_engine.sql` | Path B: **drops `pms_code_mappings`** and `pms_settings.jv_prefix`. Sends every `pending_review`/`failed` day back to `received`, with its payload, reason, attempts and claim cleared. **Deploy the code first, then `db push`**: the old code reads both |
| `20261016000000_pms_settings_per_interface.sql` | Decision-log #44: `api_keys.interface_name`, **revokes every live key**, and adds `uq_api_keys_live_interface`. Empties `pms_settings` and re-keys it `(tenant_id, interface_name)`. Ships with `20261015000000`, in the same order |

`20261009000000` and `20261015000000` both modify `pms_events` with `if not exists` / `if
exists`, so re-running is safe. The table's comment from the first migration ("inbox only")
was replaced in the second.

## Deliberately not stored

- **The day's figures**, once it is done. The Data Bank is the source, and `review_payload` is
  cleared on `posted`, `rejected` and `failed`.
- **The mapping**, which is Carmen's table (decision-log #43).
- **The debit/credit rule and the counter**, which are Carmen's setting. Only a copy of the
  counter rides in the payload, for the review's note and the post body.
- **The key's plaintext.** Only its sha256 is kept.
- **A JV number**, which Carmen does not return.
- **Guest data**, which the Data Bank does not hold: rows are aggregated by transaction code.
