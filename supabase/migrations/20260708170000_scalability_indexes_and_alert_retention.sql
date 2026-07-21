-- Scalability remediation: two missing composite/partial indexes + a retention job
-- for anomaly_alerts (previously unbounded growth, no purge job of any kind).
--
-- Context: admin analytics query audit found ocr_tasks (never purged — 5-year legal
-- retention) had 5 single-column indexes and none covering the actual
-- `WHERE created_at range AND deleted_at IS NULL GROUP BY module_id, tenant_id,
-- DATE(created_at)` pattern used by 3 admin endpoints; anomaly_alerts had no index
-- on resolved_at at all, and (since the anomaly-detection cron started this week)
-- now grows daily with nothing to bound it. Matches ORM __table_args__ added to
-- OCRTask (app/models/business.py) and AnomalyAlert (app/models/observability.py)
-- in the same change.

-- ── ocr_tasks: composite partial index, matches the query shape exactly ──────────
create index if not exists ix_ocr_tasks_created_module_tenant_active
    on ocr_tasks (created_at, module_id, tenant_id)
    where deleted_at is null;

-- ── anomaly_alerts: partial index on the "open" filter every read hits ──────────
create index if not exists ix_anomaly_alerts_open_created
    on anomaly_alerts (created_at)
    where resolved_at is null;

-- ── anomaly_alerts retention: 90 days for RESOLVED alerts only ──────────────────
-- Shorter than the other log tables' 12 months — alerts are actionable-in-the-moment,
-- not a compliance record. Unresolved alerts are never purged either way.
-- Class A job (pure SQL, no HTTP) — mirrors the existing fn_*() + cron.schedule
-- pattern in 20260615000004_cron_jobs.sql exactly.
create or replace function fn_purge_resolved_alerts() returns void as $$
    delete from anomaly_alerts
     where resolved_at is not null
       and resolved_at < now() - interval '90 days';
$$ language sql;

-- Idempotent: drop any pre-existing schedule so re-applying is safe (matches the
-- pattern already used in 20260706120000_anomaly_cron.sql).
select cron.unschedule(jobname) from cron.job where jobname = 'anomaly-alerts-purge';

-- 03:15 UTC — after the 01:40 anomaly-detection run, clear of the other scheduled jobs.
select cron.schedule('anomaly-alerts-purge', '15 3 * * *',
    $$select fn_purge_resolved_alerts()$$);
