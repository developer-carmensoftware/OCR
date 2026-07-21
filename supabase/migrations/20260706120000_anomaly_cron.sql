-- Schedule anomaly-detection via pg_cron (Class B — pg_net HTTP call to FastAPI).
--
-- Background: anomaly-detection was the ONE job the retired Go cron_service ran
-- that pg_cron did not already cover (see 20260615000004_cron_jobs.sql, which
-- already schedules session-purge, daily-summary, daily-model-cost, monthly-summary
-- and pricing-sync). With the Go service removed, this job would otherwise not run
-- at all — this migration closes that gap.
--
-- Mirrors the pricing-sync Class-B block exactly: presents the Vault internal_job_token
-- as a Bearer header (backend verifies via HMAC constant-time compare) and reads the
-- app URL from system_configs. Runs at 01:40 UTC — after the daily summaries
-- (01:17/01:22) so anomaly detection scans fresh aggregates.
--
-- Prereqs (already established by 20260615000004_cron_jobs.sql):
--   - pg_cron + pg_net extensions
--   - vault.secrets 'internal_job_token' set to the real token (== INTERNAL_JOB_TOKEN)
--   - system_configs 'app.base_url' set to the public HTTPS app URL

-- Idempotent: drop any pre-existing schedule so re-applying is safe.
select cron.unschedule(jobname) from cron.job where jobname = 'anomaly-detection';

select cron.schedule(
    'anomaly-detection',
    '40 1 * * *',
    $$
    select net.http_post(
        url     := (
            select trim(both '"' from value)
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
