-- Housekeeping found by measurement, not by reading code.
--
-- The SQL performance audit on 2026-08-19 (docs/SQL_PERFORMANCE_AUDIT.md, run from
-- backend/db/queries.sql items 15-24) established that the database is not a
-- performance problem: 18.5 minutes of total SQL execution across 68 days, a 0.019%
-- duty cycle, and not one application query in the top 20 consumers. So nothing here
-- rewrites a query or adds an index.
--
-- What it did find is waste and drift that a code read could not see. This migration
-- closes four of those. Each change is justified by a number in that report, not by a
-- hypothesis about what might be slow.


-- ── N1: cron.job_run_details had no retention ──────────────────────────────────
-- 17 MB and the largest object in this database — bigger than every business table
-- combined, on an instance whose biggest business table holds 342 rows. pg_cron does
-- not purge its own history; nothing else was ever going to.
--
-- 14 days, not 7: admin/email_ingest.py::_cron_health reads this table but uses only
-- max(start_time) and the newest status, so any window longer than a job's period is
-- safe. 14 covers a weekly cadence plus a week of investigation lag (~20k rows, ~5 MB).
-- The caveat that comes with any window: a job that has been idle longer than it reads
-- as "never ran" on #/admin/email. Every email-* job fires at least every 10 minutes,
-- so that cannot bite here.
create or replace function fn_purge_cron_history() returns void as $$
    delete from cron.job_run_details
     where end_time < now() - interval '14 days';
$$ language sql;

-- Idempotent: drop any pre-existing schedule so re-applying is safe (same pattern as
-- 20260706120000_anomaly_cron.sql and 20260708170000_scalability_indexes...).
select cron.unschedule(jobname) from cron.job where jobname = 'cron-history-purge';

-- 03:40 UTC — clear of every existing job (00:12, 01:17, 01:22, 01:40, 02:23, 03:00, 03:15).
select cron.schedule('cron-history-purge', '40 3 * * *',
    $$select fn_purge_cron_history()$$);


-- ── F3: carmen-webhook-push posted to a route that does not exist ──────────────
-- 20260811000000_carmen_notify_webhook.sql schedules this every minute against
-- /api/v1/admin/webhooks/push. That handler exists only on an unmerged branch — the
-- migration was restored (commit e72558b) to unblock `db push`, and it brought its
-- schedule with it. Measured cost: exactly 1,440 404s per day for six days
-- (2026-08-11 -> 08-17), ~8,860 junk rows in performance_logs.
--
-- Production is already clean: someone unscheduled it by hand on 08-17. This exists so
-- `db reset`, or a fresh environment, cannot resurrect it. Deliberately NOT done by
-- editing 20260811000000 — that file is applied, and editing an applied migration is
-- what broke `db push` on this project before.
--
-- Re-schedule this when the webhook branch merges, in the same change that ships the
-- handler.
select cron.unschedule(jobname) from cron.job where jobname = 'carmen-webhook-push';


-- ── N4: a cron job that exists in no migration ────────────────────────────────
-- `probe`, every minute, running `select 1`. It appears nowhere in supabase/ — almost
-- certainly left over from forcing a pg_cron launcher reload by hand from the SQL
-- Editor, which is a documented recurring workaround on this project (see the note at
-- the end of 20260817000000_email_ingest_cron.sql).
--
-- It costs no measurable CPU and 1,440 rows/day in cron.job_run_details — which is half
-- of N1's growth. Removing it is why the retention window above can be as short as it is.
select cron.unschedule(jobname) from cron.job where jobname = 'probe';


-- ── F7: an index that was never scannable ─────────────────────────────────────
-- idx_scan = 0 across an 89-day stats window, but the evidence that matters is not the
-- counter: the only handler that filters this column
-- (routers/admin/monitoring.py, GET /performance-logs) uses
-- `PerformanceLog.endpoint.contains(endpoint)`, which compiles to LIKE '%x%'. A btree
-- cannot serve a leading wildcard. This index could never have been used, at any data
-- volume, by the code that motivated it. /error-breakdown's `GROUP BY endpoint`
-- hash-aggregates and does not want it either.
--
-- Dropping the parent index cascades to every partition and stops new partitions from
-- inheriting it. ~1,128 kB reclaimed on the table that takes the most inserts in the
-- schema.
--
-- Scoped to this ONE index on purpose. 105 indexes measured cold, but the rest are
-- either 16 kB stubs (~1.7 MB combined, each costing a migration line plus an ORM
-- change) or the (tenant_id, created_at) pair — also cold, but the Performance page has
-- a tenant selector, so "unused for 89 days" is weaker evidence there. Left alone.
drop index if exists ix_performance_logs_endpoint;
