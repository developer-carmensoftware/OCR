# Operations

## Config

All in `backend/app/config.py:193-206`, documented at `backend/.env.example:126-152`.

| Var | Default | Effect |
|---|---|---|
| `EMAIL_INGEST_ADDRESS` | `ocr@carmensoftware.com` | The bare mailbox address. Each BU's actual ingest address is `<user>+<tag>@<domain>` derived from this. |
| `IMAP_HOST` | `""` | **Empty disables the feature entirely** — `run_ingest()` returns `{"status": "disabled"}` without touching a mailbox. This is the master switch. |
| `IMAP_PORT` | `993` | |
| `IMAP_USER` | `""` | |
| `IMAP_PASSWORD` | `""` | |
| `IMAP_FOLDER` | `INBOX` | Quoted automatically before use (`_quoted_folder()`) so a folder name containing a space works |
| `IMAP_BATCH_SIZE` | `10` | Messages per poll, not per day. Sets the practical floor on the cron interval — see [Scheduling](#scheduling). The batch is taken from the **newest** matching UIDs, so held-back mail can never crowd out mail arriving now |
| `IMAP_HOLD_DAYS` | `14` | How far back `SEARCH … SINCE` looks, i.e. the retry window for mail handed back unread (BU switched off, package lapsed, module disabled, out of credits). Switch back on inside the window and the backlog replays; past it a held message drops out of every poll and stays in the mailbox for a person to find. Raising it also lengthens how long unwanted mail is re-fetched each poll; lowering it below the longest plausible poller outage means real mail can age out |
| `CARMEN_DEV_TOKEN` | `""` | Read **only** when `APP_DEBUG=true`. Never used in production — one shared credential would post every BU's JVs under the same identity, exactly what the per-BU token exists to avoid |

Shared vars this feature also depends on:

| Var | Role here |
|---|---|
| `MAX_FILE_SIZE_MB` | The IMAP `SEARCH … SMALLER` byte cap — the only size limit the ingest path has, since the interactive-upload size check in `file_service.py` is never called from this path |
| `SESSION_ENCRYPTION_KEY` | Fernet key for both secrets stored in `email_ingest_settings` (PDF passwords, Carmen token) |
| `INTERNAL_JOB_TOKEN` | Bearer token both `/email-ingest/*` routes accept via `require_maintenance_auth` |
| `ALLOWED_CARMEN_HOSTS` | SSRF allowlist — also gates the Settings API itself; a host not on the list gets `422 invalid_uri` on every call for that BU |

## Deployment gap

`render.yaml` declares **no** `IMAP_*` or `EMAIL_*` variable — grepping it for either
returns nothing. The live dev `.env` points `IMAP_HOST` at `imap.gmail.com` with folder
`ocr-test`, using a personal Gmail address as the shared mailbox. Before this goes to
production: add the `IMAP_*` / `EMAIL_INGEST_ADDRESS` vars to `render.yaml`, and provision
a real mailbox at the address customers are actually told to forward to
(`AIAGENT+<tag>@carmensoftware.com` per `../CARMEN_INTEGRATION.md §2.5`, not the dev Gmail
address).

## Scheduling

**Both jobs are scheduled** by `supabase/migrations/20260817000000_email_ingest_cron.sql`:
`email-ingest` every 10 minutes and `email-confirm` every minute. `email-token-health` is
the one still unscheduled. The SQL below is what the migration runs — reproduced because it
is also what you re-issue by hand when the launcher cache goes stale (see below), and it is
documented as a docstring on `check_token_health()` (`routers/email_automation.py`):

```sql
select cron.schedule('email-ingest', '*/10 * * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs
                 where key_name = 'app.base_url' limit 1)
               || '/api/v1/carmen/email-ingest/run',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret
            from vault.decrypted_secrets where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);

select cron.schedule('email-token-health', '15 2 * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs
                 where key_name = 'app.base_url' limit 1)
               || '/api/v1/carmen/email-ingest/health',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret
            from vault.decrypted_secrets where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);
```

**Schedule the ingest poll at 10 minutes, not 5.** Attachments within a message are
processed serially, so a full `IMAP_BATCH_SIZE` batch costs roughly
`batch × (one vision call + two Carmen posts)` ≈ 3–5 minutes. Some banks send commission
daily, which across ~100 BUs is ~300 messages a day arriving mostly in one overnight
window — comfortably inside a 10-minute poll's ~2,880/day capacity, without polls routinely
overlapping on a small instance.

**Use `value #>> '{}'`, never `trim(both '"' from value)`.** This exact substitution
silently disabled every HTTP-callback cron job for months — see
`supabase/migrations/20260715010000_fix_cron_sql_bugs.sql`. Copy the SQL above verbatim
rather than retyping it.

**If `job_run_details` stays empty after scheduling**, pg_cron's launcher may not have
reloaded after `supabase db push` applied the schedule (a recurring trap on this project —
see the `pgcron_stale_launcher_cache` memory note). Fix by re-issuing one `cron.schedule`
call directly from the Supabase SQL Editor.

## Observability today

| Where | What it shows |
|---|---|
| `#/admin/jobs` | One row per poll, `job_name = "email-ingest"`, `rows_affected` = documents posted that poll |
| `#/admin/anomalies` | `email_ingest_unrouted` — WARN, tenant `"system"`, raised when a single poll has ≥5 messages with no resolvable tag |
| `#/admin/anomalies` | `email_ingest_beyond_window` — WARN, tenant `"system"`, raised when any unseen mail is already older than `IMAP_HOLD_DAYS`. Deduped while the alert is open, so a standing backlog raises one alert, not one per poll. This is the only signal that a poller outage longer than the window ate real mail |
| `GET /api/v1/carmen/settings` | Per-BU `status.documents_total` / `status.last_received_at` (an aggregate `COUNT`/`MAX` over `email_documents`) |

**`#/admin/email` reads `email_documents`** — list, filter by `status` / `reason_code` /
tenant / date, per-row detail (error, Message-ID, bank, task), and the two manual buttons
(Poll documents, Check confirmations). The `held` and `beyond-window` counts appear in the
poll toast; neither leaves a row in the table, so the toast is where a growing backlog is
visible at all.

Straight to SQL only when you need something the page does not group by:

```sql
select message_id, attachment, status, reason_code, error_message, created_at
from email_documents
where tenant_id = :tenant_id
order by created_at desc
limit 50;
```

## Runbook

| Symptom | Likely cause | Check |
|---|---|---|
| Every poll shows `FAILED` on `#/admin/jobs` | IMAP folder name has a space and isn't being quoted, or credentials are wrong | Confirm `_quoted_folder()` is in the code path you're running (it should be — check the app version deployed); test `IMAP_USER`/`IMAP_PASSWORD` directly against `IMAP_HOST` |
| Zero messages, ever | `IMAP_HOST` empty (feature off), wrong `IMAP_FOLDER`, or the server rejected `SEARCH … SMALLER` and there's nothing unseen | Check `run_ingest()`'s return isn't `{"status":"disabled"}`; confirm the mailbox actually has unseen mail in that folder |
| Messages arrive but land as `unrouted` | The tag isn't present in `Delivered-To` / `X-Original-To` / `Envelope-To` / `Received: … for` | Dump the raw headers of one such message; confirm the customer copied the address from Carmen's screen rather than typing it |
| A BU's documents are all `no_rule_match` | `filename_patterns` too narrow for how this bank actually names its files | Point the customer at "start broad, narrow later" — `.pdf` accepts everything from that bank as an escape hatch |
| A previously-working BU starts failing with `carmen_rejected` | Carmen token was rotated or revoked on Carmen's side without the OFF/ON cycle | Run `POST /email-ingest/health`; check `verified_at` on `GET /settings/token` |
| `gmail_confirmed_at` stays null despite the customer insisting they set up the forward | Google changed the confirmation link format — `auto_confirm_forwarding()` targets an undocumented interface | Check application logs for `"Could not follow the confirmation link"`; this is the one failure mode that breaks silently by design |
| A BU switched the feature back on and nothing arrives | Their mail was held unread while off, and `IMAP_HOLD_DAYS` has since passed — or it was read by a person or a Gmail filter, which makes it invisible to `SEARCH UNSEEN` for good | The messages are still in the mailbox: mark them unread and poll. Held mail writes no `email_documents` row by design (a ledger row would dedupe it out of ever being retried), so the only live signal is the `held` count in the poll toast on `#/admin/email` |
| A customer forwarded something and there is no row at all | Their attachment was a type this module cannot read (`.xlsx`, `.rar`, a `.zip` of CSVs), or the mail named no file whatsoever | Filter `#/admin/email` on reason `unsupported_attachment` — since 2026-08-18 a mail whose every attachment was refused writes one `skipped` row per rejected filename, free. **Still no row?** Then the mail named no file at all (a "your statement is ready" notice), or it never reached us: check `unrouted` on that poll and the raw `Delivered-To` header |
| A credit was charged but nothing posted | Look at the `email_documents` row for that message — `reason_code` explains exactly which post-charge gate stopped it | Query as above; cross-reference against [04-data-model.md's taxonomy](04-data-model.md#reason_code-taxonomy) for whether it should have refunded |

## Testing

| Suite | Covers |
|---|---|
| `backend/tests/unit/test_email_ingest_routing.py` | Tag extraction (incl. the Gmail-omits-`Delivered-To` case), `To:` never used as a source, `resolve_by_tag`, `foreign_tax_id`, `gmail_confirm_code`, `sender_allowed`, `match_rules` |
| `backend/tests/unit/test_email_ingest_pipeline.py` | Happy path, `submitted_at` stamping, AI GL-mapping fill, refund behaviour, Carmen decline vs. transport failure, owner-address gate, no-rule-match cost, tax-ID parking, atomic claim dedupe, tag routing, Gmail confirm + off-Google link refusal, `run_ingest` summary/`job_runs`/unrouted alert, magic-byte gate, attachment cap, folder quoting, UID-not-sequence-number addressing, crash-mid-poll hand-back, unsupported-attachment rows, duplicate-filename disambiguation, beyond-window counting |
| `backend/tests/unit/test_email_settings_service.py` | Validation matrix, encrypted-password round trip, dev-token-only-in-debug, token never echoed, entitlement gates, SSRF origin, pattern requirement, bank-TIN rejection, tag lifecycle |
| `backend/tests/integration/test_email_automation_router.py` | `_caller` shapes, rate limiting, rejection memoization, `_resolve` proof semantics, `_tenant_host` spellings, route wiring |
| `scripts/email_multibu_loadtest.py` | Many documents from many BUs in one batch, against the dev DB and a real LLM: per-BU attribution of every row written, exact charging, tokens and USD per document, serial poll throughput vs the 10-minute tick, a concurrency probe, and the overlapping-poll guard. Carmen is a dry run — five `carmen_service` calls are patched, nothing is posted |

### Multi-BU load test

```bash
# 1. put real bank documents in backend/example_field/  (gitignored)
# 2. stop uvicorn — Supavisor caps the project at 15 connections
python scripts/email_multibu_loadtest.py --mode batch --bus 5 --gates --dry-check   # free rehearsal
python scripts/email_multibu_loadtest.py --mode batch --bus 5 --gates > report.md   # real LLM
python scripts/email_multibu_loadtest.py --mode concurrent --levels 1,2,4,8
python scripts/email_multibu_loadtest.py --mode overlap
python scripts/email_multibu_loadtest.py --mode cleanup     # only if a run died mid-way
```

`--dry-check` swaps both LLM calls for canned answers, so the harness itself can be proven
before any money is spent. Mail goes to a `LoadTest` folder the script creates — never
`AR Agent`, which the deployed cron is polling. Scratch tenants and their rows are deleted
in a `finally`, after the numbers have been printed. The script refuses to start if
`DATABASE_URL` points at production.

Run the whole feature's test surface:

```bash
cd backend && venv\Scripts\activate
pytest tests/unit/test_email_ingest_routing.py tests/unit/test_email_ingest_pipeline.py tests/unit/test_email_settings_service.py tests/integration/test_email_automation_router.py -q
```

If the process hangs silently at startup rather than failing, that's usually a stuck
Windows `Winmgmt` service on this machine, not a test problem — restart the service rather
than debugging the test suite.

**`scripts/email_ingest_e2e.py`** runs 17 free-path and 3 paid-path cases against the real
dev mailbox and database. It delivers test messages with IMAP `APPEND` rather than SMTP
(there is no SMTP send path in this codebase) specifically so it can write a `Delivered-To`
header the way a real inbound hop would. It asserts the free-path run leaves
`llm_usage_logs`, `ocr_tasks` and `credit_ledger` completely untouched, and mutates
`email_ingest_settings` via raw SQL before restoring it in a `finally` block. Running
ad-hoc scripts like this one against the dev database while `uvicorn` is also running can
hit Supabase's 15-connection session-pool cap (`EMAXCONNSESSION`) — connect on port `6543`
with `statement_cache_size=0` rather than raising the app's own pool size.

## Known gaps / roadmap

Everything below is a real, currently-absent piece — flagged here so it isn't rediscovered
by surprise.

- **`email-token-health` is not scheduled** — the other two are. See
  [Scheduling](#scheduling).
- **No webhooks to Carmen.** `../CARMEN_INTEGRATION.md §3` (`document.posted`,
  `document.failed`) is a proposal; nothing in this repo sends a signed outbound POST.
- **No retry of a failed document.** Single pass, one attempt, a human has to re-forward.
- **No retention or soft delete on `email_documents`**, against the project's convention
  for business tables. It grows for ever.
- **The admin-JWT auth path is unreachable from any UI.** `_caller()` accepts
  `Bearer <admin JWT>` specifically so operators can fix a customer's settings without a
  Carmen token, but `EmailSettings.tsx` only ever sends the raw Carmen token — there's no
  screen that exercises the admin branch.
- **No i18n on `#/email-settings`.** English-only by design (it's an internal test surface,
  not the customer-facing screen — Carmen owns that one).
- **Attachments within a message are processed serially**, not in parallel — this is what
  sets the ≥10-minute poll floor above. Parallelizing per-message is the documented next
  step if daily-commission-bank backlogs start showing up in `job_runs`.
- **No outbound SMTP anywhere in this codebase** — see
  [02-architecture.md — Not built](02-architecture.md#not-built).
