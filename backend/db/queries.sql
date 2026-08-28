-- ============================================================
-- Carmen AI Platform — Useful Views & Queries (PostgreSQL)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. View all credit card headers
SELECT
    cc.id,
    t.host,
    t.bu_code,
    cc.bank_code,
    cc.company_name,
    cc.doc_no,
    cc.doc_date,
    cc.submitted_at
FROM credit_cards cc
JOIN tenants t ON t.id = cc.tenant_id
WHERE cc.deleted_at IS NULL;

-- 2. View specific bank type (e.g., KBANK)
SELECT * FROM credit_cards WHERE bank_code = 'KBANK' AND deleted_at IS NULL;

-- 3. View documents submitted today
SELECT * FROM credit_cards WHERE DATE(submitted_at) = CURRENT_DATE AND deleted_at IS NULL;

-- 4. Search by Document Number
SELECT * FROM credit_cards WHERE doc_no LIKE '%0001954%' AND deleted_at IS NULL;

-- 5. View credit card headers that are still pending submission (drafts)
SELECT
    cc.id,
    t.host,
    t.bu_code,
    cc.bank_code,
    cc.company_name,
    cc.doc_no,
    cc.doc_date,
    cc.created_at
FROM credit_cards cc
JOIN tenants t ON t.id = cc.tenant_id
WHERE cc.submitted_at IS NULL
  AND cc.deleted_at IS NULL
ORDER BY cc.created_at DESC;


-- ════════════════════════════════════════════════════════════
-- Summaries & Analytics
-- ════════════════════════════════════════════════════════════

-- 6. Total documents aggregated by bank
SELECT
    bank_code,
    COUNT(id) AS total_docs
FROM credit_cards
WHERE deleted_at IS NULL
GROUP BY bank_code
ORDER BY total_docs DESC;

-- 7. Daily LLM token and cost breakdown per tenant BU
SELECT
    tenant_id,
    DATE(created_at) AS log_date,
    model,
    COUNT(*)         AS total_calls,
    SUM(total_tokens) AS total_tokens_used,
    SUM(cost_usd)    AS total_cost_usd
FROM llm_usage_logs
GROUP BY tenant_id, DATE(created_at), model
ORDER BY log_date DESC, total_cost_usd DESC;

-- 8. Top API endpoint latencies (P95 and average duration)
SELECT
    endpoint,
    method,
    COUNT(*) AS request_count,
    ROUND(AVG(duration_ms)::numeric, 2) AS avg_latency_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::numeric, 2) AS p95_latency_ms
FROM performance_logs
GROUP BY endpoint, method
HAVING COUNT(*) > 5
ORDER BY p95_latency_ms DESC;


-- ════════════════════════════════════════════════════════════
-- System Administration & Maintenance
-- ════════════════════════════════════════════════════════════

-- 9. Active user sessions on Carmen SSO
SELECT
    s.id AS session_id,
    t.host,
    t.bu_code,
    s.username,
    s.last_used_at,
    s.created_at
FROM ocr_sessions s
JOIN tenants t ON t.id = s.tenant_id
WHERE s.is_active = TRUE
  AND s.deleted_at IS NULL
ORDER BY s.last_used_at DESC;

-- 10. List open bug reports per module category
SELECT
    module_id,
    category,
    status,
    COUNT(*) AS count
FROM bug_reports
WHERE deleted_at IS NULL
GROUP BY module_id, category, status
ORDER BY count DESC;


-- ════════════════════════════════════════════════════════════
-- Pilot / Beta adoption
-- ════════════════════════════════════════════════════════════
--
-- Run `SET timezone = 'UTC';` once per session before these. Prod columns are
-- created by Base.metadata.create_all (backend/db/schema.sql runs nothing), so
-- they may be timestamptz or naive-UTC depending on how the DB was first built;
-- a UTC session makes both compare correctly against now(). Thai office hours
-- (08:00-18:00 ICT = 01:00-11:00 UTC) never cross the UTC date line, so daily
-- and weekly buckets are unaffected.
--
-- The dev tenant is excluded everywhere below — it is our own testing, not a
-- customer, and it is usually the busiest row in the table. Widen to
-- `t.host <> 'dev.carmen4.com'` if more fake BUs appear on that host.

-- 11. Adoption funnel — one row, the headline numbers
WITH t AS (
    SELECT id
    FROM tenants
    WHERE deleted_at IS NULL
      AND NOT (host = 'dev.carmen4.com' AND bu_code = 'carmencloud')
),
k AS (
    -- documents, not scans: an AP scan of 3 pages is 3 (see ocr_tasks.charged_docs)
    SELECT tenant_id, SUM(charged_docs) AS n, MAX(created_at) AS last_at
    FROM ocr_tasks
    WHERE deleted_at IS NULL
    GROUP BY tenant_id
)
SELECT
    (SELECT COUNT(*) FROM t)                                          AS bu_logged_in,
    COUNT(k.tenant_id)                                                AS bu_ever_extracted,
    COUNT(*) FILTER (WHERE k.n >= 5)                                  AS bu_ge_5_docs,
    COUNT(*) FILTER (WHERE k.n >= 20)                                 AS bu_ge_20_docs,
    COUNT(*) FILTER (WHERE k.last_at > NOW() - INTERVAL '7 days')     AS bu_active_7d,
    COUNT(*) FILTER (WHERE k.last_at > NOW() - INTERVAL '14 days')    AS bu_active_14d,
    ROUND(AVG(k.n), 1)                                                AS avg_docs,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY k.n)                  AS median_docs,
    MAX(k.n)                                                          AS max_docs,
    SUM(k.n)                                                          AS total_docs
FROM t
LEFT JOIN k ON k.tenant_id = t.id;
-- bu_logged_in vs bu_ever_extracted is the first drop-off: tenants is upserted
-- on every /auth/exchange, so a row exists from login alone with zero scans.

-- 12. Usage per BU — the main table
-- Read posted_to_carmen (not tried): extract-without-submit means they tried it
-- and did not trust the result. active_weeks = 1 means a one-day look, never a
-- habit. failed scans are refunded (refund_document), so a BU with many failures
-- keeps its allowance — but the wasted attempts are still in `tried`.
WITH k AS (
    SELECT
        tenant_id,
        COUNT(*)                                                 AS tried,
        COUNT(*) FILTER (WHERE status = 'completed')             AS ok,
        COUNT(*) FILTER (WHERE status = 'failed')                AS failed,
        COUNT(*) FILTER (WHERE module_id = 'credit_card_ocr')    AS cc,
        COUNT(*) FILTER (WHERE module_id = 'ap_invoice')         AS ap,
        COUNT(DISTINCT carmen_user_id)                           AS users,
        COUNT(DISTINCT created_at::DATE)                         AS active_days,
        COUNT(DISTINCT DATE_TRUNC('week', created_at))           AS active_weeks,
        MIN(created_at)::DATE                                    AS first_use,
        MAX(created_at)::DATE                                    AS last_use
    FROM ocr_tasks
    WHERE deleted_at IS NULL
    GROUP BY tenant_id
),
s AS (
    SELECT tenant_id, COUNT(*) AS submitted
    FROM (
        SELECT tenant_id FROM credit_cards
         WHERE submitted_at IS NOT NULL AND deleted_at IS NULL
        UNION ALL
        SELECT tenant_id FROM ap_invoices
         WHERE submitted_at IS NOT NULL AND deleted_at IS NULL
    ) x
    GROUP BY tenant_id
)
SELECT
    t.name,
    t.bu_code,
    t.host,
    t.created_at::DATE          AS first_login,
    COALESCE(k.tried, 0)        AS tried,
    COALESCE(k.ok, 0)           AS ok,
    COALESCE(k.failed, 0)       AS failed,
    COALESCE(s.submitted, 0)    AS posted_to_carmen,
    COALESCE(k.cc, 0)           AS credit_card,
    COALESCE(k.ap, 0)           AS ap_invoice,
    k.users,
    k.active_days,
    k.active_weeks,
    k.first_use,
    k.last_use,
    CURRENT_DATE - k.last_use   AS days_idle
FROM tenants t
LEFT JOIN k ON k.tenant_id = t.id
LEFT JOIN s ON s.tenant_id = t.id
WHERE t.deleted_at IS NULL
  AND NOT (t.host = 'dev.carmen4.com' AND t.bu_code = 'carmencloud')
ORDER BY COALESCE(k.tried, 0) DESC, t.created_at;

-- 13. Who is running out of documents
-- Nobody near empty means the cap is not the constraint — adoption is.
-- Two pools, charged in this order: the subscription's monthly allowance (resets each
-- cycle, never rolls over), then tenant_credits.balance (never expires; the 30 free
-- trial documents are granted into it at signup).
SELECT
    t.name,
    t.bu_code,
    s.plan_code,
    s.doc_allowance,
    s.docs_used,
    GREATEST(COALESCE(s.doc_allowance - s.docs_used, 0), 0) AS allowance_left,
    COALESCE(c.balance, 0)                                  AS credits,
    GREATEST(COALESCE(s.doc_allowance - s.docs_used, 0), 0)
        + COALESCE(c.balance, 0)                            AS docs_left,
    s.period_end
FROM tenants t
LEFT JOIN tenant_subscriptions s
       ON s.tenant_id = t.id
      AND s.status = 'active'
      AND s.period_start <= NOW()
      AND s.period_end   >  NOW()
LEFT JOIN tenant_credits c ON c.tenant_id = t.id
WHERE t.deleted_at IS NULL
  AND NOT (t.host = 'dev.carmen4.com' AND t.bu_code = 'carmencloud')
ORDER BY docs_left ASC;

-- 14. Weekly usage curve — is adoption growing or decaying
-- active_bu falling week over week is curiosity, not adoption.
SELECT
    DATE_TRUNC('week', k.created_at)::DATE AS week,
    COUNT(DISTINCT k.tenant_id)            AS active_bu,
    SUM(k.charged_docs)                    AS docs,
    ROUND(SUM(k.charged_docs)::NUMERIC / NULLIF(COUNT(DISTINCT k.tenant_id), 0), 1) AS docs_per_bu
FROM ocr_tasks k
JOIN tenants t ON t.id = k.tenant_id
WHERE k.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND NOT (t.host = 'dev.carmen4.com' AND t.bu_code = 'carmencloud')
GROUP BY 1
ORDER BY 1;


-- ============================================================
-- PERFORMANCE AUDIT (items 15-24)
-- ============================================================
-- The measurement pack behind docs/SQL_PERFORMANCE_AUDIT.md. Every number in
-- that report comes from one of these; re-run them to reproduce it or to take a
-- fresh reading next quarter.
--
-- HOW TO RUN: paste one item at a time into the Supabase SQL Editor.
--   Do NOT run this file with psql, and do NOT drive it from an ad-hoc Python
--   script while uvicorn is up — Supavisor caps this project at 15 server
--   connections and the app's pool already reserves 10. That is a documented
--   outage (docs/LOAD_TEST_REPORT_V2.md 6.1), not a theoretical risk.
--
-- Every statement here is read-only: no RESET, no ALTER, no DROP. Keep it that
-- way — pg_stat_statements_reset() would destroy the baseline this pack exists
-- to establish.
--
-- Item -> metric -> what it decides:
--   15  M0  is the DB even measurable yet
--   16  M1  latency trend per endpoint per week   (is it getting worse?)
--   17  M2  CPU attribution per query             (what actually burns the box)
--   18  M3  table size + growth rate              (how long until it hurts)
--   19  M4  indexes nothing has ever used         (gate for dropping any index)
--   20  M5  RAM: cache hit ratio + sort spill     (does the working set fit?)
--   21  M6  seq-scan ratio                        (missing index?)
--   22  M7  dead cron / 404 storms
--   23  M8  connection-pool pressure
--   24  M9  dead tuples + autovacuum lag
-- ------------------------------------------------------------


-- ────────────────────────────────────────────────────────────
-- 15. [M0] Is the DB ready to be measured?  RUN THIS FIRST.
--
-- ext_installed = 0 -> pg_stat_statements is off. Turn it on in
-- Dashboard > Database > Extensions, then wait one FULL working day before
-- trusting items 17 and 20: the counters start empty, and a half-day window
-- makes a nightly cron job look like the biggest consumer on the box.
SELECT
    COUNT(*) FILTER (WHERE extname = 'pg_stat_statements') AS ext_installed,
    COUNT(*) FILTER (WHERE extname = 'pg_partman')         AS partman_installed,
    COUNT(*) FILTER (WHERE extname = 'pg_cron')            AS cron_installed
FROM pg_extension;

-- 15b. How long has pg_stat_statements been accumulating?
-- A window shorter than one working day makes item 17 meaningless. Record
-- pgss_window in the report's Method section — it is what makes the numbers
-- interpretable by anyone reading them later.
SELECT
    i.stats_reset                             AS pgss_reset_at,
    NOW() - i.stats_reset                     AS pgss_window,
    (SELECT COUNT(*) FROM pg_stat_statements) AS statements_tracked,
    (SELECT stats_reset FROM pg_stat_database
      WHERE datname = CURRENT_DATABASE())     AS table_stats_reset_at
FROM pg_stat_statements_info i;


-- ────────────────────────────────────────────────────────────
-- 16. [M1] Latency trend per endpoint per week.
--
-- This is the only metric that shows DIRECTION rather than a snapshot, and it
-- needs no new instrumentation: performance_logs has been recording every
-- request since 2026-06-15. A flat p95 across weeks while the tables grow means
-- the query is index-bound and fine. A rising p95 at flat call volume means the
-- cost is coming from the data, not the traffic — which is the failure mode this
-- whole audit is looking for.
--
-- Budget: p95 < 1500 ms for /admin/*, < 800 ms for wizard endpoints.
SELECT
    DATE_TRUNC('week', created_at)::DATE AS week,
    endpoint,
    COUNT(*)                             AS calls,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 0) AS p50_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 0) AS p95_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 0) AS p99_ms,
    ROUND(MAX(duration_ms)::NUMERIC, 0)  AS max_ms
FROM performance_logs
WHERE created_at >= NOW() - INTERVAL '12 weeks'
GROUP BY 1, 2
HAVING COUNT(*) >= 20          -- fewer than 20 calls/week: percentiles are noise
ORDER BY endpoint, week;

-- 16b. Same, narrowed to the endpoints under suspicion, so the slope is readable
-- without scrolling. These four are the ones that read partitioned log tables.
SELECT
    endpoint,
    DATE_TRUNC('week', created_at)::DATE AS week,
    COUNT(*)                             AS calls,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 0) AS p50_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 0) AS p95_ms
FROM performance_logs
WHERE created_at >= NOW() - INTERVAL '12 weeks'
  AND endpoint IN (
        '/api/v1/admin/llm-usage',
        '/api/v1/admin/performance-logs',
        '/api/v1/admin/tenants',
        '/api/v1/admin/usage-summary'
      )
GROUP BY 1, 2
ORDER BY endpoint, week;


-- ────────────────────────────────────────────────────────────
-- 17. [M2] CPU attribution — which queries actually burn the box.
--
-- pct_cpu is the share of ALL execution time on this database. That share, not
-- mean_ms, is what says "this one query is the problem": a 40 ms query called
-- 100k times costs more than a 4 s query called twice.
--
-- Budget: no single query > 5% of total_exec_time.
--         mean_exec_time < 100 ms on the wizard path, < 2000 ms for admin.
-- stddev_ms >> mean_ms is its own signal: the plan is data-dependent, so the
-- average is describing a query that never actually runs.
SELECT
    -- round(double, int) does not exist in Postgres — the ::NUMERIC cast is required.
    ROUND((100 * s.total_exec_time
           / NULLIF(SUM(s.total_exec_time) OVER (), 0))::NUMERIC, 1) AS pct_cpu,
    s.calls,
    ROUND(s.total_exec_time)::BIGINT AS total_ms,
    ROUND(s.mean_exec_time::NUMERIC, 1)   AS mean_ms,
    ROUND(s.stddev_exec_time::NUMERIC, 1) AS stddev_ms,
    ROUND(s.max_exec_time::NUMERIC, 1)    AS max_ms,
    s.rows,
    LEFT(REGEXP_REPLACE(s.query, '\s+', ' ', 'g'), 140) AS query
FROM pg_stat_statements s
WHERE s.query NOT LIKE '%pg_stat_statements%'
ORDER BY s.total_exec_time DESC
LIMIT 20;

-- 17b. Slow per call rather than expensive in aggregate — the ones that block a
-- pool connection long enough to matter. With only 10 connections, a 5 s query
-- run four times concurrently is a quarter of the pool.
SELECT
    s.calls,
    ROUND(s.mean_exec_time::NUMERIC, 0) AS mean_ms,
    ROUND(s.max_exec_time::NUMERIC, 0)  AS max_ms,
    s.rows / NULLIF(s.calls, 0)         AS rows_per_call,
    LEFT(REGEXP_REPLACE(s.query, '\s+', ' ', 'g'), 140) AS query
FROM pg_stat_statements s
WHERE s.mean_exec_time > 500
  AND s.query NOT LIKE '%pg_stat_statements%'
ORDER BY s.mean_exec_time DESC
LIMIT 20;


-- ────────────────────────────────────────────────────────────
-- 18. [M3] Table size, index weight, and growth rate.
--
-- pct_index > 50 means more than half the table's bytes are indexes — every
-- INSERT pays for all of them. Cross-check the suspects against item 19.
SELECT
    relname                                       AS table_name,
    n_live_tup                                    AS est_rows,
    PG_SIZE_PRETTY(PG_TABLE_SIZE(relid))          AS heap,
    PG_SIZE_PRETTY(PG_INDEXES_SIZE(relid))        AS indexes,
    PG_SIZE_PRETTY(PG_TOTAL_RELATION_SIZE(relid)) AS total,
    ROUND(100.0 * PG_INDEXES_SIZE(relid)
          / NULLIF(PG_TOTAL_RELATION_SIZE(relid), 0), 0) AS pct_index
FROM pg_stat_user_tables
ORDER BY PG_TOTAL_RELATION_SIZE(relid) DESC
LIMIT 25;

-- 18b. Growth rate, read straight off the monthly partitions of the four log
-- tables. Each child is one calendar month, so the byte deltas between children
-- ARE the growth curve — no estimation needed. This feeds the headroom formula
-- in docs/SQL_PERFORMANCE_AUDIT.md.
SELECT
    parent.relname                                AS parent_table,
    child.relname                                 AS partition,
    PG_SIZE_PRETTY(PG_TOTAL_RELATION_SIZE(child.oid)) AS total,
    PG_TOTAL_RELATION_SIZE(child.oid)             AS bytes
FROM pg_inherits i
JOIN pg_class parent ON parent.oid = i.inhparent
JOIN pg_class child  ON child.oid  = i.inhrelid
WHERE parent.relname IN ('llm_usage_logs', 'performance_logs',
                         'audit_logs', 'outbound_call_logs')
ORDER BY parent.relname, child.relname;


-- ────────────────────────────────────────────────────────────
-- 19. [M4] Indexes nothing has ever used.
--
-- THE GATE FOR DROPPING ANY INDEX. Do not drop one that is not on this list,
-- and check 15b's table_stats_reset_at first: idx_scan = 0 since a reset five
-- minutes ago proves nothing.
--
-- UNIQUE and PRIMARY are excluded on purpose — they enforce constraints whether
-- or not a query ever reads them, so "unused" is not a reason to drop them.
-- A partial unique index (e.g. uq_credit_cards_submitted_doc) is the duplicate
-- guard itself; dropping it re-opens a customer-visible double-post bug.
SELECT
    ui.relname                                      AS table_name,
    ui.indexrelname                                 AS index_name,
    ui.idx_scan,
    PG_SIZE_PRETTY(PG_RELATION_SIZE(ui.indexrelid)) AS size,
    PG_RELATION_SIZE(ui.indexrelid)                 AS bytes
FROM pg_stat_user_indexes ui
JOIN pg_index x ON x.indexrelid = ui.indexrelid
WHERE ui.idx_scan = 0
  AND NOT x.indisunique
  AND NOT x.indisprimary
ORDER BY PG_RELATION_SIZE(ui.indexrelid) DESC;


-- ────────────────────────────────────────────────────────────
-- 20. [M5] RAM — does the working set still fit in memory?
--
-- This is the direct answer to "are we ignoring RAM?". Two independent signals:
--   heap_hit_pct  — < 99% means reads are going to disk, i.e. the hot data no
--                   longer fits shared_buffers. It degrades gradually and is
--                   invisible in endpoint latency until it is already bad.
--   temp spill    — a sort that outgrows work_mem writes to disk. Any dashboard
--                   query with temp_blks_written > 0 is doing exactly what an
--                   unbounded ORDER BY ... LIMIT over a partitioned table does.
SELECT
    relname,
    heap_blks_read,
    heap_blks_hit,
    ROUND(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS heap_hit_pct,
    ROUND(100.0 * idx_blks_hit  / NULLIF(idx_blks_hit  + idx_blks_read,  0), 2) AS idx_hit_pct
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY heap_blks_read DESC
LIMIT 25;

-- 20b. Which queries spill sorts to disk, and which read the most blocks per
-- call. Budget: temp_kb_per_call = 0.
SELECT
    s.calls,
    ROUND(s.mean_exec_time::NUMERIC, 1) AS mean_ms,
    s.temp_blks_written,
    ROUND(s.temp_blks_written * 8.0 / NULLIF(s.calls, 0), 1) AS temp_kb_per_call,
    s.shared_blks_read,
    ROUND(s.shared_blks_read::NUMERIC / NULLIF(s.calls, 0), 0) AS blks_read_per_call,
    LEFT(REGEXP_REPLACE(s.query, '\s+', ' ', 'g'), 140) AS query
FROM pg_stat_statements s
WHERE (s.temp_blks_written > 0 OR s.shared_blks_read > 0)
  AND s.query NOT LIKE '%pg_stat_statements%'
ORDER BY s.temp_blks_written DESC, s.shared_blks_read DESC
LIMIT 20;

-- 20c. Database-wide totals + the settings that decide them. Record work_mem
-- and shared_buffers in the report: a temp spill is only meaningful next to the
-- work_mem it overflowed.
SELECT
    d.blks_read,
    d.blks_hit,
    ROUND(100.0 * d.blks_hit / NULLIF(d.blks_hit + d.blks_read, 0), 2) AS cache_hit_pct,
    d.temp_files,
    PG_SIZE_PRETTY(d.temp_bytes)             AS temp_bytes,
    d.deadlocks,
    d.xact_rollback,
    CURRENT_SETTING('work_mem')              AS work_mem,
    CURRENT_SETTING('shared_buffers')        AS shared_buffers,
    CURRENT_SETTING('max_connections')       AS max_connections
FROM pg_stat_database d
WHERE d.datname = CURRENT_DATABASE();


-- ────────────────────────────────────────────────────────────
-- 21. [M6] Seq-scan ratio on tables big enough for it to matter.
--
-- Below ~10k rows a seq scan is usually the CORRECT plan, so scanning small
-- tables is not a finding. rows_per_seq_scan is the one to read: a large number
-- means each scan walks the whole table, which is what a missing index on a
-- range filter looks like.
--
-- Budget: seq_pct < 5% for tables over 10k rows.
SELECT
    relname,
    n_live_tup,
    seq_scan,
    idx_scan,
    ROUND(100.0 * seq_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS seq_pct,
    seq_tup_read,
    ROUND(seq_tup_read::NUMERIC / NULLIF(seq_scan, 0), 0)       AS rows_per_seq_scan
FROM pg_stat_user_tables
WHERE n_live_tup > 10000
ORDER BY seq_tup_read DESC;


-- ────────────────────────────────────────────────────────────
-- 22. [M7] Dead cron jobs and 404 storms.
--
-- A scheduled job pointed at a route that no longer exists costs a pg_net
-- worker round-trip, an app request, and one performance_logs row per firing —
-- and a per-minute schedule makes that 1,440 rows/day of pure noise that every
-- other query in this pack then has to scan past.
SELECT
    DATE_TRUNC('day', created_at)::DATE AS day,
    endpoint,
    COUNT(*) AS hits
FROM performance_logs
WHERE status_code = 404
  AND created_at >= NOW() - INTERVAL '14 days'
GROUP BY 1, 2
HAVING COUNT(*) > 50
ORDER BY 1 DESC, hits DESC;

-- 22b. Cron health from pg_cron's own books. An 'active' job with no run
-- details in 24h means the launcher never reloaded — a recurring trap on this
-- project; fix by re-issuing one cron.schedule from the SQL Editor.
SELECT
    j.jobname,
    j.schedule,
    j.active,
    COUNT(*) FILTER (WHERE d.status = 'succeeded')  AS ok_24h,
    COUNT(*) FILTER (WHERE d.status IS NOT NULL
                       AND d.status <> 'succeeded') AS failed_24h,
    MAX(d.start_time)                               AS last_run
FROM cron.job j
LEFT JOIN cron.job_run_details d
       ON d.jobid = j.jobid
      AND d.start_time >= NOW() - INTERVAL '24 hours'
GROUP BY j.jobname, j.schedule, j.active
ORDER BY j.jobname;


-- ────────────────────────────────────────────────────────────
-- 23. [M8] Connection-pool pressure. SNAPSHOT — run it during peak, not at 3am.
--
-- The app's pool is 5 + 5 overflow = 10, and Supavisor caps this project at 15
-- server connections. 'idle in transaction' rows are the dangerous ones: they
-- hold a slot while doing no work.
SELECT
    state,
    wait_event_type,
    wait_event,
    COUNT(*)                        AS conns,
    MAX(NOW() - state_change)       AS longest_in_state
FROM pg_stat_activity
WHERE datname = CURRENT_DATABASE()
GROUP BY 1, 2, 3
ORDER BY conns DESC;

-- 23b. One-line headroom against the Supavisor cap.
SELECT
    COUNT(*)                                          AS total_conns,
    COUNT(*) FILTER (WHERE state = 'active')          AS active,
    COUNT(*) FILTER (WHERE state = 'idle')            AS idle,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_txn
FROM pg_stat_activity
WHERE datname = CURRENT_DATABASE();


-- ────────────────────────────────────────────────────────────
-- 24. [M9] Dead tuples and autovacuum lag.
--
-- Bloat makes every scan more expensive without changing a single query, so it
-- shows up as "everything got slower" with no code change to blame. Soft-delete
-- tables never DELETE, but they do UPDATE (deleted_at, submitted_at), and every
-- UPDATE in Postgres leaves a dead tuple behind.
SELECT
    relname,
    n_live_tup,
    n_dead_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;


-- ============================================================
-- INPUT TAX (ACTX) COVERAGE (item 25)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 25. Did the input-tax record follow the JV?
--
-- One credit-card statement should produce TWO Carmen documents: the GLJV, then
-- the ACTX input-tax record claiming the VAT the bank charged. A day where
-- jv_posts > actx_posts is a day some VAT was not claimed.
--
-- This is the baseline for the 2026-08-25 fix (blank TaxId + rejections reported
-- as success). Run it once over the weeks BEFORE the deploy, then again after —
-- the gap should shrink toward the statements that genuinely carry no VAT.
--
-- Two things it cannot tell you, both by design of what is logged:
--   * Carmen answers HTTP 200 and puts its verdict in the body, which
--     outbound_call_logs does not store. A rejected ACTX still counts as a post
--     here, so this UNDERSTATES the gap.
--   * A user pressing "Discard" on step 6 and a blocked/failed post look the
--     same — both are simply an absent call.
-- A zero-VAT statement legitimately has no ACTX, so the gap is never expected to
-- reach zero. Watch the trend, not the absolute.
SELECT
    DATE_TRUNC('week', created_at)::DATE AS week,
    COUNT(*) FILTER (WHERE url LIKE '%/gljv' AND method = 'POST')        AS jv_posts,
    COUNT(*) FILTER (WHERE url LIKE '%/inputTaxRec' AND method = 'POST') AS actx_posts,
    COUNT(*) FILTER (WHERE url LIKE '%/gljv' AND method = 'POST')
      - COUNT(*) FILTER (WHERE url LIKE '%/inputTaxRec' AND method = 'POST') AS gap,
    -- After the fix a non-2xx here is a real rejection surfaced by post_input_tax
    -- rather than a body nobody read; before it, this column is all zeroes.
    COUNT(*) FILTER (WHERE url LIKE '%/inputTaxRec' AND status_code >= 400) AS actx_http_errors
FROM outbound_call_logs
WHERE service = 'carmen'
  AND created_at >= NOW() - INTERVAL '90 days'
GROUP BY 1
ORDER BY 1;
