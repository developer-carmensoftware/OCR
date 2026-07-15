-- Keep-warm ping (Class B — pg_net HTTP call to FastAPI).
--
-- Why: the backend runs on a Render plan that sleeps after ~15 minutes idle and takes
-- ~50s to cold-start. Two consequences this fixes:
--   1. The first real user request of a quiet period eats the whole cold start.
--   2. Worse — the Class-B cron jobs (anomaly-detection 01:40 UTC, pricing-sync every
--      8h) fire precisely during low-traffic windows, so they hit a sleeping service
--      and can time out. A job that never lands is a job that silently never ran.
--
-- Every 10 minutes is inside the ~15-minute idle window, so the service never sleeps.
--
-- /api/v1/health is unauthenticated (it is the platform health check, render.yaml
-- healthCheckPath) and is on the rate-limiter skip list, so this ping needs no Vault
-- secret and cannot exhaust anyone's bucket. If system_configs 'app.base_url' is unset
-- the post targets '/api/v1/health' with no host and is a harmless no-op — the same
-- failure mode as the other Class-B jobs, and the same fix (set app.base_url).
--
-- This is a workaround for the free plan, not a permanent design: on a paid always-on
-- instance it is redundant and can simply be unscheduled.

-- Idempotent: drop any pre-existing schedule so re-applying is safe.
select cron.unschedule(jobname) from cron.job where jobname = 'keep-warm';

select cron.schedule(
    'keep-warm',
    '*/10 * * * *',
    $$
    select net.http_get(
        url := (
            select trim(both '"' from value)
              from system_configs
             where key_name = 'app.base_url'
             limit 1
        ) || '/api/v1/health'
    );
    $$
);
