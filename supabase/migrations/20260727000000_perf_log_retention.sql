-- performance_logs: a retention ceiling, and drop the two indexes nothing reads.
--
-- Why a nightly DELETE and not partitioning: 20260721000000_legacy_prod_catchup.sql
-- deliberately deferred pg_partman and the partman-maintain job, because converting a
-- populated table to a partitioned one is a copy-and-swap that wants a maintenance
-- window. So the 12-month retention written in 20260615000001_partition_log_tables.sql
-- does not exist on prod — the table has grown with nothing to bound it. A DELETE gets
-- the ceiling today without waiting for that window.
-- ponytail: the ceiling of this approach is how long the DELETE takes. When a purge run
-- starts overrunning its cron slot, or dead-tuple bloat starts showing up in query
-- plans, move to partman — 20260615000001 is already written and waiting.
--
-- 90 days, not 12 months: raw rows exist to investigate an incident. The long-term
-- numbers live in daily_usage_summary / monthly_usage_summary, which never expire.

create or replace function fn_purge_performance_logs() returns void as $$
    delete from performance_logs
     where created_at < now() - interval '90 days';
$$ language sql;

-- Idempotent: drop any pre-existing schedule so re-applying is safe.
select cron.unschedule(jobname) from cron.job where jobname = 'perf-log-purge';

-- 03:40 UTC — after anomaly-alerts-purge (03:15), clear of every other job.
select cron.schedule('perf-log-purge', '40 3 * * *',
    $$select fn_purge_performance_logs()$$);

-- ── indexes nothing reads ────────────────────────────────────────────────────────
-- performance_logs is append-only and write-hot; every INSERT pays to maintain these.
--   carmen_user_id — no query filters or groups on it. Audited across
--     routers/admin/monitoring.py, services/usage_analytics_service.py,
--     services/summary_service.py and db/queries.sql: it is only ever selected out
--     for display on #/admin/performance.
--   endpoint — the only filter is `.contains()` (monitoring.py:178), i.e.
--     LIKE '%x%', which a btree cannot serve; /error-breakdown does GROUP BY endpoint,
--     which scans regardless. `if exists` because prod may never have had this one —
--     the catchup migration did not create it.
-- ix_performance_logs_tenant_created stays: it is the one the queries actually use.
drop index if exists ix_performance_logs_carmen_user;

drop index if exists ix_performance_logs_endpoint;
