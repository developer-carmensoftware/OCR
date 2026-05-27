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
