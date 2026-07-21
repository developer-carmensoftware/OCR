-- Fix two SQL bugs that have silently disabled every HTTP cron job since day one,
-- plus partman maintenance. Found by reading cron.job_run_details on the live DB —
-- both fail deterministically, so these jobs have NEVER run successfully:
--
--   anomaly-detection | failed | ERROR: function pg_catalog.btrim(jsonb, unknown) does not exist
--   pricing-sync      | failed | (same)
--   keep-warm         | failed | (same — 20260715000000 inherited the bug by copying the pattern)
--   partman-maintain  | failed | ERROR: partman.run_maintenance_proc() is a procedure
--
-- Confirmed by net._http_response being EMPTY: not one HTTP request was ever sent.
-- The job_runs table has no anomaly-detection / pricing-sync row in its entire history,
-- while every Class-A (pure SQL) job has thousands. This was NOT the missing
-- INTERNAL_JOB_TOKEN — the SQL errored out long before the token was ever read.
--
-- Bug 1: system_configs.value is `jsonb`, and `trim(both '"' from value)` resolves to
--   btrim(jsonb, unknown), which does not exist. Use the jsonb -> text operator
--   `#>> '{}'`, which returns the string's content already unquoted (verified on the
--   live row: both `value #>> '{}'` and `trim(both '"' from value::text)` yield the
--   correct URL; `#>> '{}'` is the canonical form and doesn't depend on quote-trimming).
--
-- Bug 2: partman.run_maintenance_proc() is a PROCEDURE (it commits internally), so it
--   must be invoked with CALL, not SELECT. `CALL` is the documented pg_cron + pg_partman
--   pattern.
--
-- Urgency on Bug 2: premake=2 and the newest partition on every log table is
--   p20260801, so llm_usage_logs / audit_logs / performance_logs / outbound_call_logs
--   have runway only to the end of Aug 2026. After that, rows fall into the `_default`
--   partition — which then blocks partman from creating the proper partition later
--   (its range would overlap rows already sitting in default). Not a hard failure
--   today; a painful cleanup if it is left until it bites.

-- ── Class A: partman maintenance (SELECT -> CALL) ────────────────────────────
select cron.unschedule(jobname) from cron.job where jobname = 'partman-maintain';
select cron.schedule('partman-maintain', '23 2 * * *', $$call partman.run_maintenance_proc()$$);

-- ── Class B: HTTP jobs (jsonb -> text) ───────────────────────────────────────
select cron.unschedule(jobname) from cron.job where jobname = 'anomaly-detection';
select cron.schedule(
    'anomaly-detection',
    '40 1 * * *',
    $$
    select net.http_post(
        url     := (
            select value #>> '{}'
              from system_configs
             where key_name = 'app.base_url'
             limit 1
        ) || '/api/v1/admin/anomaly/run',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret
                  from vault.decrypted_secrets
                 where name = 'internal_job_token'
                 limit 1
            )
        ),
        body    := '{}'::jsonb
    );
    $$
);

select cron.unschedule(jobname) from cron.job where jobname = 'pricing-sync';
select cron.schedule(
    'pricing-sync',
    '0 */8 * * *',
    $$
    select net.http_post(
        url     := (
            select value #>> '{}'
              from system_configs
             where key_name = 'app.base_url'
             limit 1
        ) || '/api/v1/admin/pricing/sync',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || (
                select decrypted_secret
                  from vault.decrypted_secrets
                 where name = 'internal_job_token'
                 limit 1
            )
        ),
        body    := '{}'::jsonb
    );
    $$
);

select cron.unschedule(jobname) from cron.job where jobname = 'keep-warm';
select cron.schedule(
    'keep-warm',
    '*/10 * * * *',
    $$
    select net.http_get(
        url := (
            select value #>> '{}'
              from system_configs
             where key_name = 'app.base_url'
             limit 1
        ) || '/api/v1/health'
    );
    $$
);
