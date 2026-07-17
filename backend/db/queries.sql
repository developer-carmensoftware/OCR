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
    SELECT tenant_id, COUNT(*) AS n, MAX(created_at) AS last_at
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
-- habit. failed counts against quota too — consume_quota() decrements before the
-- LLM call, so a BU with many failures never really had its full allowance.
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

-- 13. Who is hitting the quota ceiling
-- Nobody near 80% means the cap is not the constraint — adoption is.
SELECT
    t.name,
    t.bu_code,
    q.period,
    q.metric,
    u.period_key,
    u.used,
    q.limit_value,
    ROUND(100 * u.used / NULLIF(q.limit_value, 0), 0) AS pct,
    u.last_updated_at
FROM quota_usage u
JOIN quotas  q ON q.id = u.quota_id AND q.deleted_at IS NULL
JOIN tenants t ON t.id = q.tenant_id AND t.deleted_at IS NULL
WHERE NOT (t.host = 'dev.carmen4.com' AND t.bu_code = 'carmencloud')
ORDER BY pct DESC NULLS LAST;

-- 14. Weekly usage curve — is adoption growing or decaying
-- active_bu falling week over week is curiosity, not adoption.
SELECT
    DATE_TRUNC('week', k.created_at)::DATE AS week,
    COUNT(DISTINCT k.tenant_id)            AS active_bu,
    COUNT(*)                               AS docs,
    ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT k.tenant_id), 0), 1) AS docs_per_bu
FROM ocr_tasks k
JOIN tenants t ON t.id = k.tenant_id
WHERE k.deleted_at IS NULL
  AND t.deleted_at IS NULL
  AND NOT (t.host = 'dev.carmen4.com' AND t.bu_code = 'carmencloud')
GROUP BY 1
ORDER BY 1;
