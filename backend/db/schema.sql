-- ============================================================
-- Carmen AI Platform — Single Database Schema
-- Architecture: Single Database, Multi-Tenant via Columns
--   Database: carmen_ai (shared by all tenants)
--   Tenant isolation via: host + bu columns
--
-- Hierarchy:
--   host  (ostin.carmenwork.com)  ← customer level
--     bu  (ostionwest)            ← business unit / tenant
--       user_id (jitra)           ← individual user
--
-- To initialise:
--   python -c "import asyncio; from app.database import ensure_db; asyncio.run(ensure_db())"
-- ============================================================

CREATE DATABASE IF NOT EXISTS carmen_ai
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE carmen_ai;

-- ── schema_migrations — tracks applied migrations ──────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
    name       VARCHAR(100) PRIMARY KEY,
    applied_at DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── ocr_tasks — file upload and processing metadata ──────────────────────
--   bu   : business unit that uploaded the file
--   host : Carmen instance hostname (e.g. 'ostin.carmenwork.com')

CREATE TABLE IF NOT EXISTS ocr_tasks (
    id                VARCHAR(36)  NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    status            ENUM('pending','processing','completed','failed')
                                   NOT NULL DEFAULT 'pending',
    ocr_engine        VARCHAR(100) NULL,
    error_message     TEXT         NULL,
    bu                VARCHAR(100) NULL,
    host              VARCHAR(255) NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at      DATETIME     NULL,

    PRIMARY KEY (id),
    INDEX idx_ocr_tasks_status     (status),
    INDEX idx_ocr_tasks_bu         (bu),
    INDEX idx_ocr_tasks_host       (host),
    INDEX idx_ocr_tasks_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── credit_cards — credit card statement header (1 per task) ─────────────
--   bu : inherited from the parent ocr_task for direct filtering

CREATE TABLE IF NOT EXISTS credit_cards (
    id               VARCHAR(36)  NOT NULL,
    task_id          VARCHAR(36)  NOT NULL,
    bank_name        VARCHAR(255) NULL,
    bank_type        ENUM('BBL','KBANK','SCB') NULL,
    doc_name         VARCHAR(255) NULL,
    company_name     VARCHAR(255) NULL,
    doc_date         VARCHAR(20)  NULL        COMMENT 'DD/MM/YYYY',
    doc_no           VARCHAR(100) NULL,
    merchant_name    VARCHAR(255) NULL,
    bank_companyname VARCHAR(255) NULL,
    branch_no        VARCHAR(50)  NULL,
    transactions     JSON         NULL        COMMENT '["Visa","Master",...]',
    submitted_at     DATETIME     NULL        COMMENT 'NULL = pending',
    bu               VARCHAR(100) NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_credit_cards_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE CASCADE,
    INDEX idx_credit_cards_task_id      (task_id),
    INDEX idx_credit_cards_doc_no       (doc_no),
    INDEX idx_credit_cards_bu           (bu),
    INDEX idx_credit_cards_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── ap_invoices — AP invoice audit trail ─────────────────────────────────
--   bu   : business unit
--   host : Carmen instance hostname

CREATE TABLE IF NOT EXISTS ap_invoices (
    id                VARCHAR(36)  NOT NULL,
    task_id           VARCHAR(36)  NULL,
    user_id           VARCHAR(36)  NULL,
    bu                VARCHAR(100) NULL,
    host              VARCHAR(255) NULL,
    vendor_name       VARCHAR(255) NULL,
    doc_no            VARCHAR(100) NULL,
    doc_date          VARCHAR(50)  NULL,
    original_filename VARCHAR(255) NULL,
    submitted_at      DATETIME     NULL        COMMENT 'NULL = pending',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_ap_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id),
    INDEX idx_ap_task         (task_id),
    INDEX idx_ap_user         (user_id),
    INDEX idx_ap_bu           (bu),
    INDEX idx_ap_host         (host),
    INDEX idx_ap_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── ocr_sessions — authenticated Carmen SSO sessions ─────────────────────
--   carmen_uri : full origin of the Carmen instance (e.g. 'https://ostin.carmenwork.com')
--                used to build Carmen API base URL and derive host

CREATE TABLE IF NOT EXISTS ocr_sessions (
    id                     VARCHAR(36)  NOT NULL,
    carmen_token_encrypted TEXT         NOT NULL COMMENT 'Fernet-encrypted Carmen token',
    user_id                VARCHAR(100) NULL,
    username               VARCHAR(100) NULL,
    bu                     VARCHAR(100) NULL,
    carmen_uri             VARCHAR(500) NULL     COMMENT 'Origin URI of the Carmen instance',
    is_active              TINYINT(1)   NOT NULL DEFAULT 1,
    created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at           DATETIME     NULL,

    PRIMARY KEY (id),
    INDEX idx_session_user   (user_id),
    INDEX idx_session_bu     (bu),
    INDEX idx_session_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── mapping_history — confirmed GL account mappings ──────────────────────
--   bu : unique key includes bu so mappings are isolated per business unit

CREATE TABLE IF NOT EXISTS mapping_history (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    bu              VARCHAR(100)  NULL,
    bank_name       VARCHAR(100)  NOT NULL,
    field_type      VARCHAR(100)  NOT NULL,
    dept_code       VARCHAR(100)  NULL,
    acc_code        VARCHAR(100)  NULL,
    confirmed_count INT UNSIGNED  DEFAULT 1,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_mapping_bu_bank_field_choice (bu, bank_name, field_type, dept_code, acc_code),
    INDEX idx_mapping_bu   (bu),
    INDEX idx_mapping_bank (bank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── correction_feedback — user corrections for OCR learning ──────────────
--   bu : unique key includes bu so corrections are isolated per business unit

CREATE TABLE IF NOT EXISTS correction_feedback (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    bu              VARCHAR(100)  NULL,
    doc_no          VARCHAR(100)  NOT NULL,
    bank_type       VARCHAR(50)   NOT NULL,
    field_name      VARCHAR(100)  NOT NULL,
    original_value  TEXT          NULL,
    corrected_value TEXT          NULL,
    user_id         VARCHAR(100)  NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_correction_bu_doc_field (bu, doc_no, field_name),
    INDEX idx_feedback_bu         (bu),
    INDEX idx_feedback_bank_type  (bank_type),
    INDEX idx_feedback_field_name (field_name),
    INDEX idx_feedback_user       (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── llm_usage_logs — token usage + cost per LLM call ─────────────────────
--   bu_name : business unit (kept as bu_name for backward compat)
--   host    : Carmen instance hostname for cross-tenant reporting

CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    task_id           VARCHAR(36)     NULL,
    usage_type        VARCHAR(50)     NULL COMMENT 'BANK_OCR | AP_INVOICE | MAPPING_SUGGESTION | AP_GL_SUGGESTION',
    model             VARCHAR(100)    NOT NULL,
    prompt_tokens     INT             NOT NULL DEFAULT 0,
    completion_tokens INT             NOT NULL DEFAULT 0,
    total_tokens      INT             NOT NULL DEFAULT 0,
    duration_ms       DOUBLE          NULL,
    cost_usd          DECIMAL(10,6)   NULL,
    session_id        VARCHAR(36)     NULL,
    user_id           VARCHAR(100)    NULL,
    bu_name           VARCHAR(100)    NULL,
    host              VARCHAR(255)    NULL,
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_llm_usage_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE SET NULL,
    INDEX idx_llm_usage_task_id    (task_id),
    INDEX idx_llm_usage_session    (session_id),
    INDEX idx_llm_usage_user       (user_id),
    INDEX idx_llm_usage_bu         (bu_name),
    INDEX idx_llm_usage_host       (host),
    INDEX idx_llm_usage_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── audit_logs — user action trail ───────────────────────────────────────
--   bu   : business unit
--   host : Carmen instance hostname

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    session_id   VARCHAR(36)  NULL,
    user_id      VARCHAR(100) NULL,
    username     VARCHAR(100) NULL,
    bu           VARCHAR(100) NULL,
    host         VARCHAR(255) NULL,
    action       VARCHAR(50)  NOT NULL COMMENT 'EXTRACT | SUBMIT | SUGGEST_GL | EXPORT | LOGIN | LOGOUT',
    resource     VARCHAR(50)  NULL     COMMENT 'CREDIT_CARD | AP_INVOICE',
    document_ref VARCHAR(255) NULL,
    ip_address   VARCHAR(45)  NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_audit_session    (session_id),
    INDEX idx_audit_user       (user_id),
    INDEX idx_audit_bu         (bu),
    INDEX idx_audit_host       (host),
    INDEX idx_audit_action     (action),
    INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── performance_logs — API request latency (partitioned) ─────────────────

CREATE TABLE IF NOT EXISTS performance_logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    endpoint     VARCHAR(200) NOT NULL,
    method       VARCHAR(10)  NULL,
    duration_ms  DOUBLE       NOT NULL,
    status_code  INT          NULL,
    user_id      VARCHAR(100) NULL,
    bu           VARCHAR(100) NULL,
    document_ref VARCHAR(255) NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, created_at),
    INDEX idx_perf_endpoint   (endpoint),
    INDEX idx_perf_user       (user_id),
    INDEX idx_perf_bu         (bu),
    INDEX idx_perf_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p_before_2026 VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p2026q1       VALUES LESS THAN (TO_DAYS('2026-04-01')),
    PARTITION p2026q2       VALUES LESS THAN (TO_DAYS('2026-07-01')),
    PARTITION p2026q3       VALUES LESS THAN (TO_DAYS('2026-10-01')),
    PARTITION p2026q4       VALUES LESS THAN (TO_DAYS('2027-01-01')),
    PARTITION p_future      VALUES LESS THAN MAXVALUE
);


-- ── outbound_call_logs — every HTTP call to OpenRouter / Carmen ───────────

CREATE TABLE IF NOT EXISTS outbound_call_logs (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    service              VARCHAR(50)  NOT NULL COMMENT 'openrouter | carmen',
    url                  VARCHAR(500) NOT NULL,
    method               VARCHAR(10)  NULL,
    status_code          INT          NULL,
    duration_ms          DOUBLE       NULL,
    request_size_bytes   INT          NULL,
    session_id           VARCHAR(36)  NULL,
    user_id              VARCHAR(100) NULL,
    bu                   VARCHAR(100) NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, created_at),
    INDEX idx_outbound_service    (service),
    INDEX idx_outbound_session    (session_id),
    INDEX idx_outbound_bu         (bu),
    INDEX idx_outbound_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(created_at)) (
    PARTITION p_before_2026 VALUES LESS THAN (TO_DAYS('2026-01-01')),
    PARTITION p2026q1       VALUES LESS THAN (TO_DAYS('2026-04-01')),
    PARTITION p2026q2       VALUES LESS THAN (TO_DAYS('2026-07-01')),
    PARTITION p2026q3       VALUES LESS THAN (TO_DAYS('2026-10-01')),
    PARTITION p2026q4       VALUES LESS THAN (TO_DAYS('2027-01-01')),
    PARTITION p_future      VALUES LESS THAN MAXVALUE
);


-- ── daily_usage_summary — pre-aggregated daily metrics per BU ────────────
--   unique per (bu, summary_date) — one row per business unit per day

CREATE TABLE IF NOT EXISTS daily_usage_summary (
    id                   INT           NOT NULL AUTO_INCREMENT,
    bu                   VARCHAR(100)  NULL,
    summary_date         DATE          NOT NULL,
    total_documents      INT           DEFAULT 0,
    total_submissions    INT           DEFAULT 0,
    total_llm_calls      INT           DEFAULT 0,
    total_tokens         BIGINT        DEFAULT 0,
    total_cost_usd       DECIMAL(12,4) DEFAULT 0,
    avg_llm_latency_ms   DOUBLE        DEFAULT 0,
    total_api_calls      INT           DEFAULT 0,
    avg_api_latency_ms   DOUBLE        DEFAULT 0,
    p95_api_latency_ms   DOUBLE        DEFAULT 0,
    total_errors         INT           DEFAULT 0,
    total_corrections    INT           DEFAULT 0,
    total_outbound_calls INT           DEFAULT 0,
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_summary_bu_date (bu, summary_date),
    INDEX idx_summary_bu   (bu),
    INDEX idx_summary_date (summary_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── model_pricing — LLM model pricing (synced from OpenRouter) ───────────

CREATE TABLE IF NOT EXISTS model_pricing (
    model_name            VARCHAR(255)  NOT NULL,
    input_price_per_1m    DECIMAL(18,9) DEFAULT 0,
    output_price_per_1m   DECIMAL(18,9) DEFAULT 0,
    source                VARCHAR(50)   DEFAULT 'manual',
    price_verified_at     DATETIME      NULL,
    updated_at            DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (model_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── bu_usage — per-BU usage tracking and rate limiting ───────────────────
--   host : Carmen instance hostname; nullable for backward compat

CREATE TABLE IF NOT EXISTS bu_usage (
    bu_name           VARCHAR(100) NOT NULL,
    host              VARCHAR(255) NULL,
    monthly_calls     INT          DEFAULT 0,
    total_calls       BIGINT       DEFAULT 0,
    max_monthly_calls INT          DEFAULT 50,
    last_reset_month  VARCHAR(7)   NULL        COMMENT 'e.g. 2026-05',
    updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (bu_name),
    INDEX idx_bu_usage_host (host)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Example dashboard queries
-- ============================================================

-- Usage by customer (host):
--   SELECT host, COUNT(*) FROM ocr_tasks GROUP BY host;

-- Usage by BU within a customer:
--   SELECT bu, COUNT(*) FROM ocr_tasks
--   WHERE host = 'ostin.carmenwork.com' GROUP BY bu;

-- LLM cost today per BU:
--   SELECT bu_name, host, SUM(cost_usd)
--   FROM llm_usage_logs
--   WHERE DATE(created_at) = CURDATE()
--   GROUP BY bu_name, host;

-- User activity:
--   SELECT username, COUNT(*) FROM audit_logs
--   WHERE host = 'ostin.carmenwork.com' AND bu = 'ostionwest'
--   GROUP BY username;
