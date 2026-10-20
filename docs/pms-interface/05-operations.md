# Operations

## Config

PMS has **no env var of its own**. It depends on these:

| Setting | Why PMS needs it |
|---|---|
| `INTERNAL_JOB_TOKEN` (env) = `vault.secrets['internal_job_token']` | The `pms-process` cron's bearer for `/api/v1/pms/process/run` |
| `system_configs['app.base_url']` | The URL the cron posts to |
| `SESSION_ENCRYPTION_KEY` | Fernet key for the stored Carmen token (`email_ingest_settings.carmen_token_enc`) |
| `OPENROUTER_SUGGESTION_MODEL` + `LLM_TEXT_PROVIDER_ALLOWLIST` | The model that suggests accounts for new rows, pinned to allow-listed providers, with `data_collection: deny` |
| `ALLOWED_CARMEN_HOSTS` | `_safe_carmen_uri` refuses to store a credential for a Carmen origin outside it |
| `TRUST_PROXY` + `TRUSTED_PROXY_HOPS` | The client IP behind Render: `api_keys.last_used_ip`, and the **per-IP rate limit** the hook is subject to (120/min) |

**QA gap (CA-118).** `carmen-ocr-backend-xntb` has no `TRUST_PROXY`. On QA every caller is
Render's proxy (`10.25.16.5`), so `last_used_ip` is wrong and **every QA client shares one
120/min bucket**: a Carmen backfill could throttle every tester. Fix it in the Render
dashboard: set `TRUST_PROXY=true` and `TRUSTED_PROXY_HOPS=1`, redeploy, then check that a
hook's `last_used_ip` is a public IP.

## Environments

| | Backend | Database | PMS state |
|---|---|---|---|
| Local | `:8010` | dev (Supabase) | the branch you run |
| QA | `carmen-ocr-backend-xntb.onrender.com` | **dev** | `main`: phase 1 + path A processing |
| Prod | `carmen-ocr-backend` | `lhlncsjqxttcdegkqvid` | **none.** Prod has been missing migrations since 2026-09-02 and runs mid-September code; the release scope is undecided (CA-118) |

Test fixtures on dev:
- tenant **`pms-e2e`**, kept for future tests;
- Carmen's sandbox setting **`test.PMS`** on dev Carmen, whose mapping is emptied after each test;
- `carmencloud`'s Comanche Data Bank, which is real dev data. **Read it, but don't post to it.**

## Scheduling

One job, scheduled by `20261009000000_pms_processing.sql`:

```sql
select cron.schedule('pms-process', '*/10 * * * *', $$
  select net.http_post(
    url     := (select value #>> '{}' from system_configs where key_name = 'app.base_url' limit 1)
               || '/api/v1/pms/process/run',
    headers := jsonb_build_object('Content-Type', 'application/json',
               'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                              where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);
```

Check it from the **Supabase SQL Editor**. An ad-hoc script while `uvicorn` runs hits the
15-connection Supavisor cap.

```sql
select jobid, schedule, active from cron.job where jobname = 'pms-process';
select status, return_message, start_time from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'pms-process')
 order by start_time desc limit 10;
```

If `job_run_details` stays empty after a `db push` that scheduled the job, the pg_cron
launcher has not reloaded. Run one `cron.schedule(...)` from the SQL Editor; see
[`../email-automation/05-operations.md`](../email-automation/05-operations.md#scheduling).

The cron is a backstop. The hook starts processing at once (`process.kick`). The sweep
catches only what a restart, an outage or a missing credential left behind, so on a healthy
day it does nothing and writes no `job_runs` row.

## Releasing path B (PR #292)

**Order matters.** Migration `20261015000000` drops `pms_code_mappings` and
`pms_settings.jv_prefix`, which the running path-A code reads. `20261016000000` (decision-log
#44, stacked on #292) re-keys `pms_settings` and revokes every live key, so it ships in the
same release: after it, Carmen's PMS setting screen must generate each BU's key again.

1. Carmen exposes the setting GET under `/api/interface`
   ([07-status.md](07-status.md#what-blocks-the-merge)). Until then, merging only moves every
   day to `carmen_config_unreadable`.
2. Merge #292 (with its changelog). Add the batched release note in `releaseNotes.ts`, and
   bump `VERSION` (MINOR) with it.
3. **Deploy the backend.**
4. **Then `supabase db push`.** Every unposted day returns to `received`, and the next sweep
   reads it through the engine path. Every BU-wide key is revoked and every auto-post switch
   is off until Carmen's PMS setting screen sets them again.
5. Check: on `#/admin/jobs`, `pms-process` has a fresh row. The queue shows the days parked
   with the new review (no balance, the Carmen setting named).

## Observability today

| Question | Where |
|---|---|
| Is Carmen calling? Which key? From where? | `#/admin/api-keys`: PMS, **Last call**, `last_used_ip`. Carmen's PMS setting reads the same as `key.last_used_at` (`GET /api/v1/carmen/pms/settings`) |
| Did the hook reach us, and how did we answer? | `performance_logs` for `/api/v1/pms/events`, attributed to the BU (`request.state.tenant_id`) |
| What happened to a day? | The queue `#/CreditCardOCR` (Review / Posted / Not posted), or SQL below |
| Is the sweep running? | `#/admin/jobs`, `job_name = 'pms-process'` (only runs that did something or failed) |
| What did the AI cost? | `#/admin/llm-logs`, or `llm_usage_logs` where `module_id = 'pms_interface'` |
| What did Carmen say? | `pms_events.error_message`: Carmen's own sentence, via `carmen_words`. Backend logs are prefixed `[pms]` |

```sql
-- One BU's days, newest first
select event_id, status, reason_code, attempts, processed_at, updated_at, left(error_message, 120)
  from pms_events
 where tenant_id = (select id from tenants where bu_code = 'carmencloud')
 order by created_at desc limit 20;

-- Everything that stopped, by cause
select reason_code, status, count(*) from pms_events
 where status in ('received', 'failed', 'pending_review') and reason_code is not null
 group by 1, 2 order by 3 desc;
```

## Runbook

| Symptom | Likely cause | Fix |
|---|---|---|
| Carmen gets `401 Invalid API key` | wrong or revoked key (a newer one was generated?), a key of a deleted or inactive tenant, or the scheme mangled | `#/admin/api-keys` → is a key active for this BU and PMS? Is its prefix the one Carmen stored? Generate a new one from Carmen's PMS setting |
| Carmen gets `403 This key is for PMS '…'` | the hook's `InterfaceName` is not the PMS the key was generated for | Carmen sends each PMS's hook with that PMS's own key |
| Carmen gets `422` naming `DocDate` | a number or `dd/MM/yyyy` sent as the date | [`PMS_INTEGRATION.md` §3](../PMS_INTEGRATION.md#3-request-body) |
| Carmen gets `429` | more than 120/min from one IP, or QA's shared bucket | Pace a backfill under 2/s; fix `TRUST_PROXY` on QA |
| Every day stops at `carmen_config_unreadable` | the menu token cannot read `interfacePost/Setting/GL` | **Expected until Carmen adds the GET.** Nothing to do per day: the wake rule retries once a credential is re-proven |
| `carmen_forbidden` with "Permission Name = Inf.PMS.DataBank \| Action = View" | the menu user's role in Carmen lacks Data Bank View | The BU's Carmen admin grants it, then saves the PMS setting in Carmen. That save replaces the held token even if it still answers (#45) |
| `carmen_unauthorized` with "SecurityToken has Expired" | the stored token died | Save the PMS setting in Carmen (or open email settings from Carmen's menu). The days wake on their own |
| `no_credential` | no write from Carmen's PMS setting yet (keys made before #44, or an admin-only setup) | Save the PMS setting in Carmen: a write stores the token when none is held (#45) |
| `pms_setting_missing` | no **active** PMS setting whose `InterfaceName` matches the hook's, or its REVENUE section is inactive or has no config | Fix it in Carmen's interface settings, then have Carmen re-send the day |
| `unsupported_pms_format` | the setting's file is CSV, fixed-width or another layout | Code change in `carmen_config.spec_of`; until then, post in Carmen |
| `day_not_found` | the hook came before the Data Bank row had rows, or the day is empty | It retries 3 times, 10 minutes apart. After that, have Carmen re-send the hook |
| Approve → `503` "Couldn't read Carmen's … mapping" | Carmen down, or the token | Nothing was written. Try again |
| Approve → `400` "Carmen didn't post the day: …" | Carmen's verdict: a closed period, "Mapping is incomplete.", "Account code is empty" (the counter) | Read Carmen's words. The accounts may already be in Carmen's table; approving again is safe |
| A day posted but shows no JV number | the engine does not return one | Expected until Carmen ships ask D (in progress since 2026-10-20). Find the JV in Carmen by date and source CMRV |
| Re-run one day by hand | — | Prefer Carmen re-sending the hook. Otherwise run `update pms_events set status='received', attempts=0, processed_at=null, review_payload=null, reason_code=null, error_message=null where id = '…' and status <> 'posted';`, then the next sweep, or `POST /api/v1/pms/process/run` with the job token |

**Never PUT Carmen's mapping table by hand with a partial list.** It replaces the whole table.

## Testing

```bash
cd backend && venv\Scripts\activate
pytest tests/unit/test_pms_carmen_config.py tests/unit/test_pms_process.py tests/unit/test_pms_review.py \
       tests/unit/test_api_keys.py tests/integration/test_pms_*.py
```

| File | Covers |
|---|---|
| `unit/test_pms_carmen_config.py` | INI parsing, `find_section`, `spec_of` (JSON only), `rows_of`, `new_keys`, `merged_rows` (the whole table goes back) |
| `unit/test_pms_process.py` | The gate ladder: each reason code, park vs post, `post_day`'s reading of Carmen's answers, requeue, wake |
| `unit/test_pms_review.py` | Approve: a fresh read, Carmen's mapping winning over a stale pick, chart checks, PUT then post, claim release; reject; `recheck` |
| `unit/test_api_keys.py` | Hashing, issue (revokes the key of the same BU and PMS, stores only the hash, a concurrent generate is a `409`), authenticate (stamps `last_used` only on success), admin revoke |
| `integration/test_pms_webhook.py` | The hook: auth forms, another PMS's key → `403`, sender variants (camelCase, BOM, `pms`, any content type), the 16 KB boundary, `422`s, repeat → `200` + reset |
| `integration/test_pms_carmen.py` | Carmen's Settings API: `pms` lower-cased into every write, credential stored + days woken on Carmen writes only, the key once, `DELETE` without a key → `404`, tenant creation (Carmen path only, trial with the row), the `#/pms` routes gone |
| `integration/test_pms_review_api.py` | `/days/{id}`, approve and reject over HTTP |
| `integration/test_pms_process_run.py` | `/process/run` auth |
| `frontend/src/features/admin/pages/ApiKeysPage.test.tsx` | `#/admin/api-keys`: the PMS column, no create, revoke with a reason |

**End-to-end runs so far.** Details are in the Jira comments and in `changelog/2026-10-0[7-9].md`
and `2026-10-1[4-5].md`.

| Date | What | Result |
|---|---|---|
| 2026-10-07 | A simulated menu link for a new BU (`pms-e2e`): tenant, consent, key, events, rotation, isolation | passed. Found CA-121 (fixed) |
| 2026-10-08 | The hook against QA over HTTPS | 15/16. The fail is QA's `TRUST_PROXY` |
| 2026-10-09 | Path A against dev Carmen | JV 1124 / Voucher 24090001, Dr = Cr 226,085.51 |
| 2026-10-14 | **Path B pre-E2E** on `test.PMS`: 32 rows, AI picked all 32, Approve PUT + post | **JV 1142** (Normal, 23 lines, Dr = Cr 319,343.88), voided afterwards |
| 2026-10-15 | Browser test of the path-B review, 1440 and 390, light and dark | passed. Approve not pressed (it would post to dev Carmen) |

The real end to end is **CA-120**: a real Carmen menu click and real hooks. It needs CA-115
(Carmen) and CA-118 (release).

## Known gaps

| Gap | Effect | Upgrade path |
|---|---|---|
| **The setting GET under `/api/interface`** (Carmen) | Every day stops at `carmen_config_unreadable` | Carmen adds it. Our call already uses that path (`carmen._PMS_CONFIG_PATH`) |
| Token health skips PMS-only BUs | A dead token is found only when a day fails | Extend `sweep_token_health` to BUs with a live PMS key |
| No retention purge for `pms_events` | Rows accumulate, about 1 per BU per day, with no payload once done | Decide a period; a cron like email's retention |
| No JV number | The queue cannot link to the JV | **Carmen is adding `JvhSeq` and `JvhNo` to `interfacePostGL`'s answer** (ask D, agreed 2026-10-20). Then `post_day` stores it in `jv_no` ([07-status.md](07-status.md#what-we-still-owe)) |
| Approve: a Carmen error while reading the chart (`mapping.masters`) is not wrapped | `500` instead of `503`. The claim is still released, and nothing is written (it comes before the PUT) | Wrap it like the mapping read |
| The 403 Data Bank refusal retries 3× a day via the wake rule | Noise in the row's attempts while the permission is missing | Accept; it stops once the permission is granted |
| Only JSON-object layouts, only REVENUE | Opera, GuestLine, Hotelogix and Custom fail `unsupported_pms_format` | A reader per layout in `carmen_config.rows_of` |
| `event_id` keeps `InterfaceName`'s casing | `Comanche` and `COMANCHE` are two rows for one day; the engine refuses the second post (`-200`) | Accepted (decision-log #44): Carmen sends one casing. Lower-casing it would split the days already stored |
| PMSs that Carmen's own post API fetches (no Data Bank, no hook) | Such a PMS never reaches us: nothing calls it, and its key would never be used | Carmen lists the PMS kinds (the same for every BU); then a plan of its own (decision-log #44) |
| `carmen.py`'s comment says neither config read has an `/api/interface` twin | Stale since 2026-10-15: the mapping GET has one | Update the comment on the next code change there |
