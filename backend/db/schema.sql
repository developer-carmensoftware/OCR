-- ============================================================
-- Carmen AI Platform — Per-Tenant Database Schema
-- Architecture: Separate Schema per Tenant
--   Each tenant gets its own database: carmen_ai_{tenant}
--   e.g. carmen_ai_abc, carmen_ai_xyz
--
-- This file documents the schema for ONE tenant database.
-- Tables have NO tenant column — isolation is at the DB level.
--
-- To create a new tenant:
--   python -c "import asyncio; from app.database import provision_tenant; asyncio.run(provision_tenant('abc'))"
-- ============================================================

CREATE DATABASE IF NOT EXISTS carmen_ai_example
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE carmen_ai_example;

-- ── schema_migrations — tracks applied migrations ──────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
    name       VARCHAR(100) PRIMARY KEY,
    applied_at DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── ocr_tasks — file upload and processing metadata ───────────────────────

CREATE TABLE IF NOT EXISTS ocr_tasks (
    id                VARCHAR(36)  NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    status            ENUM('pending','processing','completed','failed')
                                   NOT NULL DEFAULT 'pending',
    ocr_engine        VARCHAR(100) NULL,
    error_message     TEXT         NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at      DATETIME     NULL,

    PRIMARY KEY (id),
    INDEX idx_ocr_tasks_status     (status),
    INDEX idx_ocr_tasks_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── credit_cards — credit card statement header (1 per task) ───────────────

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
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_credit_cards_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE CASCADE,
    INDEX idx_credit_cards_task_id     (task_id),
    INDEX idx_credit_cards_doc_no      (doc_no),
    INDEX idx_credit_cards_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── ap_invoices — AP invoice audit trail ──────────────────────────────────

CREATE TABLE IF NOT EXISTS ap_invoices (
    id                VARCHAR(36)  NOT NULL,
    task_id           VARCHAR(36)  NULL,
    user_id           VARCHAR(36)  NULL,
    vendor_name       VARCHAR(255) NULL,
    doc_no            VARCHAR(100) NULL,
    doc_date          VARCHAR(50)  NULL,
    original_filename VARCHAR(255) NULL,
    submitted_at      DATETIME     NULL        COMMENT 'NULL = pending',
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_ap_task (task_id),
    INDEX idx_ap_submitted_at (submitted_at),
    CONSTRAINT fk_ap_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── ocr_sessions — authenticated Carmen SSO sessions ──────────────────────

CREATE TABLE IF NOT EXISTS ocr_sessions (
    id                     VARCHAR(36)  NOT NULL,
    carmen_token_encrypted TEXT         NOT NULL COMMENT 'Fernet-encrypted Carmen token',
    user_id                VARCHAR(100) NULL,
    username               VARCHAR(100) NULL,
    bu                     VARCHAR(100) NULL,
    is_active              TINYINT(1)   NOT NULL DEFAULT 1,
    created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at           DATETIME     NULL,

    PRIMARY KEY (id),
    INDEX idx_session_user   (user_id),
    INDEX idx_session_bu     (bu),
    INDEX idx_session_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── mapping_history — confirmed GL account mappings ───────────────────────

CREATE TABLE IF NOT EXISTS mapping_history (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    bank_name       VARCHAR(100)  NOT NULL,
    field_type      VARCHAR(100)  NOT NULL,
    dept_code       VARCHAR(100)  NULL,
    acc_code        VARCHAR(100)  NULL,
    confirmed_count INT UNSIGNED  DEFAULT 1,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_mapping_bank_field_choice (bank_name, field_type, dept_code, acc_code),
    INDEX idx_mapping_bank (bank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── correction_feedback — user corrections for OCR learning ───────────────

CREATE TABLE IF NOT EXISTS correction_feedback (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    doc_no          VARCHAR(100)  NOT NULL,
    bank_type       VARCHAR(50)   NOT NULL,
    field_name      VARCHAR(100)  NOT NULL,
    original_value  TEXT          NULL,
    corrected_value TEXT          NULL,
    user_id         VARCHAR(100)  NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_correction_doc_field (doc_no, field_name),
    INDEX idx_feedback_bank_type  (bank_type),
    INDEX idx_feedback_field_name (field_name),
    INDEX idx_feedback_user       (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── llm_usage_logs — token usage + cost per LLM call ──────────────────────

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
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_llm_usage_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE SET NULL,
    INDEX idx_llm_usage_task_id  (task_id),
    INDEX idx_llm_usage_session  (session_id),
    INDEX idx_llm_usage_user     (user_id),
    INDEX idx_llm_usage_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── audit_logs — user action trail ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    session_id   VARCHAR(36)  NULL,
    user_id      VARCHAR(100) NULL,
    username     VARCHAR(100) NULL,
    bu           VARCHAR(100) NULL,
    action       VARCHAR(50)  NOT NULL COMMENT 'EXTRACT | SUBMIT | SUGGEST_GL | EXPORT | LOGIN | LOGOUT',
    resource     VARCHAR(50)  NULL     COMMENT 'CREDIT_CARD | AP_INVOICE',
    document_ref VARCHAR(255) NULL,
    ip_address   VARCHAR(45)  NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_audit_session    (session_id),
    INDEX idx_audit_user       (user_id),
    INDEX idx_audit_action     (action),
    INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── performance_logs — API request latency ────────────────────────────────

CREATE TABLE IF NOT EXISTS performance_logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    endpoint     VARCHAR(200) NOT NULL,
    method       VARCHAR(10)  NULL,
    duration_ms  DOUBLE       NOT NULL,
    status_code  INT          NULL,
    user_id      VARCHAR(100) NULL,
    document_ref VARCHAR(255) NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, created_at),
    INDEX idx_perf_endpoint   (endpoint),
    INDEX idx_perf_user       (user_id),
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


-- ── outbound_call_logs — every HTTP call to OpenRouter / Carmen ────────────

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
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, created_at),
    INDEX idx_outbound_service    (service),
    INDEX idx_outbound_session    (session_id),
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


-- ── daily_usage_summary — pre-aggregated daily metrics ────────────────────

CREATE TABLE IF NOT EXISTS daily_usage_summary (
    id                   INT          NOT NULL AUTO_INCREMENT,
    summary_date         DATE         NOT NULL,
    total_documents      INT          DEFAULT 0,
    total_submissions    INT          DEFAULT 0,
    total_llm_calls      INT          DEFAULT 0,
    total_tokens         BIGINT       DEFAULT 0,
    total_cost_usd       DECIMAL(12,4) DEFAULT 0,
    avg_llm_latency_ms   DOUBLE       DEFAULT 0,
    total_api_calls      INT          DEFAULT 0,
    avg_api_latency_ms   DOUBLE       DEFAULT 0,
    p95_api_latency_ms   DOUBLE       DEFAULT 0,
    total_errors         INT          DEFAULT 0,
    total_corrections    INT          DEFAULT 0,
    total_outbound_calls INT          DEFAULT 0,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_summary_date (summary_date),
    INDEX idx_summary_date (summary_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── model_pricing — LLM model pricing (synced from OpenRouter) ────────────

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

CREATE TABLE IF NOT EXISTS bu_usage (
    bu_name           VARCHAR(100) NOT NULL,
    monthly_calls     INT          DEFAULT 0,
    total_calls       BIGINT       DEFAULT 0,
    max_monthly_calls INT          DEFAULT 50,
    last_reset_month  VARCHAR(7)   NULL,
    updated_at        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (bu_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
