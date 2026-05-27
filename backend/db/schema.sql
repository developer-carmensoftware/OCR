-- ============================================================
-- Carmen AI Platform — Single Database Schema (PostgreSQL)
-- Architecture: Single Database, Multi-Tenant via Columns / Foreign Keys
--   Database: carmen_ai (shared by all tenants)
--   Tenant isolation via: tenant_id referencing tenants.id
--
-- To initialize locally:
--   psql "$DATABASE_URL" -f schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── schema_migrations — tracks applied migrations ──────────────────────────

CREATE TABLE IF NOT EXISTS schema_migrations (
    name       VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);


-- ── plans — subscription plan definitions ──────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
    code               VARCHAR(20)  PRIMARY KEY,
    display_name       VARCHAR(100) NOT NULL,
    monthly_call_limit INTEGER      NOT NULL,
    is_active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    created_by         VARCHAR(100) NULL,
    updated_by         VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans(created_at);
CREATE INDEX IF NOT EXISTS idx_plans_created_by ON plans(created_by);


-- ── tenants — customer + business unit composite tenant rows ───────────────

CREATE TABLE IF NOT EXISTS tenants (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    host          VARCHAR(255) NOT NULL,
    bu_code       VARCHAR(100) NOT NULL,
    name          VARCHAR(255) NOT NULL,
    plan          VARCHAR(20)  NOT NULL DEFAULT 'free' REFERENCES plans(code),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    contact_email VARCHAR(255) NULL,
    notes         TEXT         NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP    NULL,
    deleted_by    VARCHAR(100) NULL,
    created_by    VARCHAR(100) NULL,
    updated_by    VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_host_bu_active
    ON tenants (host, bu_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_host ON tenants(host);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by);


-- ── admin_users — Hub admin staff (separate from Carmen ERP users) ────────

CREATE TABLE IF NOT EXISTS admin_users (
    id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email                 VARCHAR(255) NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    full_name             VARCHAR(255) NULL,
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    mfa_secret            VARCHAR(64)  NULL,
    last_login_at         TIMESTAMP    NULL,
    last_login_ip         VARCHAR(45)  NULL,
    failed_login_attempts INTEGER      NOT NULL DEFAULT 0,
    locked_until          TIMESTAMP    NULL,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at            TIMESTAMP    NULL,
    deleted_by            VARCHAR(100) NULL,
    created_by            VARCHAR(100) NULL,
    updated_by            VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_user_email_active
    ON admin_users (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_created_at ON admin_users(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_users_deleted_at ON admin_users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_admin_users_created_by ON admin_users(created_by);


-- ── roles — IAM Roles ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
    id          VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description TEXT         NULL,
    is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP    NULL,
    deleted_by  VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_roles_created_at ON roles(created_at);
CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles(deleted_at);


-- ── permissions — IAM Permissions ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions (
    id          VARCHAR(100) PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    resource    VARCHAR(50)  NOT NULL,
    action      VARCHAR(50)  NOT NULL,
    description TEXT         NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP             DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_created_at ON permissions(created_at);


-- ── role_permissions — mapping roles to permissions ────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       VARCHAR(50)  NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);


-- ── admin_user_roles — assign roles to admin users (tenant-scoped) ────────

CREATE TABLE IF NOT EXISTS admin_user_roles (
    user_id    UUID        NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    role_id    VARCHAR(50) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    tenant_id  VARCHAR(36) NOT NULL DEFAULT '',
    granted_by VARCHAR(36) NULL,
    expires_at TIMESTAMP   NULL,
    created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP            DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_roles_created_at ON admin_user_roles(created_at);


-- ── api_keys — API keys for external system integrations ──────────────────

CREATE TABLE IF NOT EXISTS api_keys (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           VARCHAR(100) NOT NULL,
    key_prefix     VARCHAR(12)  NOT NULL,
    key_hash       VARCHAR(255) NOT NULL,
    tenant_id      UUID         NULL REFERENCES tenants(id) ON DELETE SET NULL,
    scopes         JSON         NOT NULL,
    rate_limit_rpm INTEGER      NOT NULL DEFAULT 60,
    expires_at     TIMESTAMP    NULL,
    last_used_at   TIMESTAMP    NULL,
    last_used_ip   VARCHAR(45)  NULL,
    revoked_at     TIMESTAMP    NULL,
    revoked_by     VARCHAR(36)  NULL,
    revoke_reason  TEXT         NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    created_by     VARCHAR(100) NULL,
    updated_by     VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_api_key_hash_active
    ON api_keys (key_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);


-- ── api_key_usage — daily API key call and cost tracking ──────────────────

CREATE TABLE IF NOT EXISTS api_key_usage (
    api_key_id UUID          NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    usage_date TIMESTAMP     NOT NULL,
    calls      INTEGER       NOT NULL DEFAULT 0,
    errors     INTEGER       NOT NULL DEFAULT 0,
    tokens     BIGINT        NOT NULL DEFAULT 0,
    cost_usd   NUMERIC(12,4) NOT NULL DEFAULT 0.0000,
    created_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (api_key_id, usage_date)
);


-- ── system_configs — global database-driven settings ──────────────────────

CREATE TABLE IF NOT EXISTS system_configs (
    key_name         VARCHAR(100) PRIMARY KEY,
    value            JSON         NOT NULL,
    value_type       VARCHAR(20)  NOT NULL,
    category         VARCHAR(50)  NOT NULL,
    description      TEXT         NULL,
    is_secret        BOOLEAN      NOT NULL DEFAULT FALSE,
    requires_restart BOOLEAN      NOT NULL DEFAULT FALSE,
    default_value    JSON         NULL,
    validation_regex VARCHAR(500) NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    created_by       VARCHAR(100) NULL,
    updated_by       VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_system_configs_category ON system_configs(category);
CREATE INDEX IF NOT EXISTS idx_system_configs_created_at ON system_configs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_configs_created_by ON system_configs(created_by);


-- ── tenant_config_overrides — per-tenant override of system configs ───────

CREATE TABLE IF NOT EXISTS tenant_config_overrides (
    tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_name   VARCHAR(100) NOT NULL REFERENCES system_configs(key_name) ON DELETE CASCADE,
    value      JSON         NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) NULL,
    updated_by VARCHAR(100) NULL,
    PRIMARY KEY (tenant_id, key_name)
);


-- ── feature_flags — dynamic feature flags with rollout support ────────────

CREATE TABLE IF NOT EXISTS feature_flags (
    flag_key        VARCHAR(100) PRIMARY KEY,
    description     TEXT         NULL,
    enabled_global  BOOLEAN      NOT NULL DEFAULT FALSE,
    enabled_tenants JSON         NULL,
    rollout_pct     INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(100) NULL,
    updated_by      VARCHAR(100) NULL
);


-- ── quotas — call/cost quotas per tenant ──────────────────────────────────

CREATE TABLE IF NOT EXISTS quotas (
    id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    period        VARCHAR(50)   NOT NULL, -- 'daily' | 'monthly' | 'yearly'
    metric        VARCHAR(50)   NOT NULL, -- 'calls' | 'cost' | 'tokens'
    limit_value   NUMERIC(18,4) NOT NULL,
    soft_warn_pct NUMERIC(3,2)  NOT NULL DEFAULT 0.80,
    is_hard       BOOLEAN       NOT NULL DEFAULT TRUE,
    is_custom     BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP     NULL,
    deleted_by    VARCHAR(100)  NULL,
    created_by    VARCHAR(100)  NULL,
    updated_by    VARCHAR(100)  NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quota_tenant_period_metric_active
    ON quotas (tenant_id, period, metric) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quotas_tenant_id ON quotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotas_created_at ON quotas(created_at);
CREATE INDEX IF NOT EXISTS idx_quotas_deleted_at ON quotas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_quotas_created_by ON quotas(created_by);


-- ── quota_usage — live counters for active quotas ─────────────────────────

CREATE TABLE IF NOT EXISTS quota_usage (
    quota_id        UUID          NOT NULL REFERENCES quotas(id) ON DELETE CASCADE,
    period_key      VARCHAR(10)   NOT NULL, -- e.g., '2026-05' or '2026-05-14'
    used            NUMERIC(18,4) NOT NULL DEFAULT 0.0000,
    last_updated_at TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (quota_id, period_key)
);


-- ── model_pricing — LLM input/output pricing ──────────────────────────────

CREATE TABLE IF NOT EXISTS model_pricing (
    model_name          VARCHAR(255)  PRIMARY KEY,
    input_price_per_1m  NUMERIC(18,9) DEFAULT 0.000000000,
    output_price_per_1m NUMERIC(18,9) DEFAULT 0.000000000,
    source              VARCHAR(50)   DEFAULT 'manual',
    price_verified_at   TIMESTAMP     NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP              DEFAULT CURRENT_TIMESTAMP
);


-- ── modules — system OCR modules ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS modules (
    id           VARCHAR(50)  PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description  TEXT         NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order   INTEGER      DEFAULT 0,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP             DEFAULT CURRENT_TIMESTAMP
);


-- ── tenant_modules — modules enabled per tenant ────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_modules (
    tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id   VARCHAR(50) NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
    enabled_at  TIMESTAMP   NULL,
    disabled_at TIMESTAMP   NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP            DEFAULT CURRENT_TIMESTAMP,
    created_by  VARCHAR(100) NULL,
    updated_by  VARCHAR(100) NULL,
    PRIMARY KEY (tenant_id, module_id)
);


-- ── banks — bank registration ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banks (
    code              VARCHAR(20)  PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    display_name_th   VARCHAR(100) NULL,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    detection_pattern VARCHAR(500) NULL,
    sort_order        INTEGER      DEFAULT 0,
    icon_url          VARCHAR(500) NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP    NULL,
    deleted_by        VARCHAR(100) NULL,
    created_by        VARCHAR(100) NULL,
    updated_by        VARCHAR(100) NULL
);


-- ── prompt_templates — OCR/mapping/correction prompt configs ──────────────

CREATE TABLE IF NOT EXISTS prompt_templates (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_code    VARCHAR(20)  NULL REFERENCES banks(code) ON DELETE SET NULL,
    prompt_type  VARCHAR(50)  NOT NULL, -- PromptType enum
    version      INTEGER      NOT NULL,
    status       VARCHAR(50)  NOT NULL DEFAULT 'draft', -- PromptStatus enum
    content      TEXT         NOT NULL,
    notes        TEXT         NULL,
    published_at TIMESTAMP    NULL,
    published_by UUID         NULL REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMP    NULL,
    deleted_by   VARCHAR(100) NULL,
    created_by   VARCHAR(100) NULL,
    updated_by   VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_bank_type_version_active
    ON prompt_templates (bank_code, prompt_type, version) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prompt_templates_bank_code ON prompt_templates(bank_code);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_status ON prompt_templates(status);


-- ── ocr_sessions — end-user API sessions ──────────────────────────────────

CREATE TABLE IF NOT EXISTS ocr_sessions (
    id                     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id              UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    carmen_user_id         VARCHAR(36)  NULL,
    username               VARCHAR(100) NULL,
    carmen_token_encrypted TEXT         NOT NULL,
    carmen_uri             VARCHAR(500) NULL,
    is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
    last_used_at           TIMESTAMP    NULL,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at             TIMESTAMP    NULL,
    deleted_by             VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_ocr_sessions_tenant_id ON ocr_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ocr_sessions_carmen_user_id ON ocr_sessions(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_sessions_deleted_at ON ocr_sessions(deleted_at);


-- ── ocr_tasks — OCR task runs ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ocr_tasks (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id         VARCHAR(50)  NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    status            VARCHAR(50)  NOT NULL DEFAULT 'pending', -- TaskStatus enum
    ocr_engine        VARCHAR(100) NULL,
    error_message     TEXT         NULL,
    completed_at      TIMESTAMP    NULL,
    carmen_user_id    VARCHAR(36)  NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP    NULL,
    deleted_by        VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_ocr_tasks_tenant_id ON ocr_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ocr_tasks_module_id ON ocr_tasks(module_id);
CREATE INDEX IF NOT EXISTS idx_ocr_tasks_carmen_user_id ON ocr_tasks(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_tasks_deleted_at ON ocr_tasks(deleted_at);


-- ── credit_cards — credit card extraction records ─────────────────────────

CREATE TABLE IF NOT EXISTS credit_cards (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id           UUID         NOT NULL REFERENCES ocr_tasks(id) ON DELETE CASCADE,
    bank_code         VARCHAR(20)  NULL REFERENCES banks(code) ON DELETE SET NULL,
    company_name      VARCHAR(255) NULL,
    bank_company_name VARCHAR(255) NULL,
    doc_date          DATE         NULL,
    doc_no            VARCHAR(100) NULL,
    branch_no         VARCHAR(50)  NULL,
    submitted_at      TIMESTAMP    NULL,
    carmen_user_id    VARCHAR(36)  NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP    NULL,
    deleted_by        VARCHAR(100) NULL,
    created_by        VARCHAR(100) NULL,
    updated_by        VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_cards_tenant_id ON credit_cards(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_task_id ON credit_cards(task_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_bank_code ON credit_cards(bank_code);
CREATE INDEX IF NOT EXISTS idx_credit_cards_doc_date ON credit_cards(doc_date);
CREATE INDEX IF NOT EXISTS idx_credit_cards_doc_no ON credit_cards(doc_no);
CREATE INDEX IF NOT EXISTS idx_credit_cards_carmen_user_id ON credit_cards(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_deleted_at ON credit_cards(deleted_at);
CREATE INDEX IF NOT EXISTS idx_credit_cards_created_by ON credit_cards(created_by);



-- ── ap_invoices — accounts payable invoices ───────────────────────────────

CREATE TABLE IF NOT EXISTS ap_invoices (
    id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id           UUID         NOT NULL REFERENCES ocr_tasks(id) ON DELETE CASCADE,
    vendor_name       VARCHAR(255) NULL,
    doc_no            VARCHAR(100) NULL,
    doc_date          DATE         NULL,
    original_filename VARCHAR(255) NULL,
    submitted_at      TIMESTAMP    NULL,
    carmen_user_id    VARCHAR(36)  NULL,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP    NULL,
    deleted_by        VARCHAR(100) NULL,
    created_by        VARCHAR(100) NULL,
    updated_by        VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_ap_invoices_tenant_id ON ap_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_task_id ON ap_invoices(task_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_doc_date ON ap_invoices(doc_date);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_carmen_user_id ON ap_invoices(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_deleted_at ON ap_invoices(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ap_invoices_created_by ON ap_invoices(created_by);


-- ── mapping_history — learned GL mappings ──────────────────────────────────

CREATE TABLE IF NOT EXISTS mapping_history (
    id              SERIAL       PRIMARY KEY,
    tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_code       VARCHAR(20)  NOT NULL REFERENCES banks(code) ON DELETE CASCADE,
    field_type      VARCHAR(100) NOT NULL,
    dept_code       VARCHAR(100) NULL,
    acc_code        VARCHAR(100) NULL,
    confirmed_count INTEGER      NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP    NULL,
    deleted_by      VARCHAR(100) NULL,
    created_by      VARCHAR(100) NULL,
    updated_by      VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mapping_scope_active
    ON mapping_history (tenant_id, bank_code, field_type, dept_code, acc_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mapping_history_tenant_id ON mapping_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mapping_history_bank_code ON mapping_history(bank_code);
CREATE INDEX IF NOT EXISTS idx_mapping_history_created_at ON mapping_history(created_at);
CREATE INDEX IF NOT EXISTS idx_mapping_history_deleted_at ON mapping_history(deleted_at);
CREATE INDEX IF NOT EXISTS idx_mapping_history_created_by ON mapping_history(created_by);


-- ── correction_feedback — learned OCR corrections ─────────────────────────

CREATE TABLE IF NOT EXISTS correction_feedback (
    id              SERIAL       PRIMARY KEY,
    tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    doc_no          VARCHAR(100) NOT NULL,
    bank_code       VARCHAR(20)  NOT NULL REFERENCES banks(code) ON DELETE CASCADE,
    field_name      VARCHAR(100) NOT NULL,
    original_value  TEXT         NULL,
    corrected_value TEXT         NULL,
    carmen_user_id  VARCHAR(36)  NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP    NULL,
    deleted_by      VARCHAR(100) NULL,
    created_by      VARCHAR(100) NULL,
    updated_by      VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_correction_scope_active
    ON correction_feedback (tenant_id, doc_no, field_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feedback_tenant_id ON correction_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_doc_no ON correction_feedback(doc_no);
CREATE INDEX IF NOT EXISTS idx_feedback_bank_code ON correction_feedback(bank_code);
CREATE INDEX IF NOT EXISTS idx_feedback_field_name ON correction_feedback(field_name);
CREATE INDEX IF NOT EXISTS idx_feedback_carmen_user_id ON correction_feedback(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_deleted_at ON correction_feedback(deleted_at);
CREATE INDEX IF NOT EXISTS idx_feedback_created_by ON correction_feedback(created_by);


-- ── bu_accounting_configs — accounting config templates ───────────────────

CREATE TABLE IF NOT EXISTS bu_accounting_configs (
    id          SERIAL       PRIMARY KEY,
    tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bank_code   VARCHAR(20)  NULL REFERENCES banks(code) ON DELETE SET NULL,
    file_prefix VARCHAR(20)  NULL,
    file_source VARCHAR(20)  NULL,
    description VARCHAR(255) NULL,
    branch      VARCHAR(50)  NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP    NULL,
    deleted_by  VARCHAR(100) NULL,
    created_by  VARCHAR(100) NULL,
    updated_by  VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bu_accounting_config_active
    ON bu_accounting_configs (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bu_accounting_config_tenant_id ON bu_accounting_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bu_accounting_config_bank_code ON bu_accounting_configs(bank_code);
CREATE INDEX IF NOT EXISTS idx_bu_accounting_config_created_at ON bu_accounting_configs(created_at);
CREATE INDEX IF NOT EXISTS idx_bu_accounting_config_deleted_at ON bu_accounting_configs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bu_accounting_config_created_by ON bu_accounting_configs(created_by);


-- ── bu_accounting_mapping_entries — GL accounts configured ───────────────

CREATE TABLE IF NOT EXISTS bu_accounting_mapping_entries (
    id         SERIAL       PRIMARY KEY,
    config_id  INTEGER      NOT NULL REFERENCES bu_accounting_configs(id) ON DELETE CASCADE,
    field_type VARCHAR(100) NOT NULL,
    dept_code  VARCHAR(100) NULL,
    acc_code   VARCHAR(100) NULL,
    is_custom  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP    NULL,
    deleted_by VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bu_mapping_entry_active
    ON bu_accounting_mapping_entries (config_id, field_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bu_map_entry_config_id ON bu_accounting_mapping_entries(config_id);
CREATE INDEX IF NOT EXISTS idx_bu_map_entry_dept_code ON bu_accounting_mapping_entries(dept_code);
CREATE INDEX IF NOT EXISTS idx_bu_map_entry_acc_code ON bu_accounting_mapping_entries(acc_code);
CREATE INDEX IF NOT EXISTS idx_bu_map_entry_created_at ON bu_accounting_mapping_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_bu_map_entry_deleted_at ON bu_accounting_mapping_entries(deleted_at);


-- ── ap_vendor_column_mappings — column mapping rules per vendor ───────────

CREATE TABLE IF NOT EXISTS ap_vendor_column_mappings (
    id            SERIAL       PRIMARY KEY,
    tenant_id     UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_tax_id VARCHAR(30)  NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP    NULL,
    deleted_by    VARCHAR(100) NULL,
    created_by    VARCHAR(100) NULL,
    updated_by    VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ap_vendor_mapping_active
    ON ap_vendor_column_mappings (tenant_id, vendor_tax_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ap_vendor_map_tenant_id ON ap_vendor_column_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ap_vendor_map_vendor_tax_id ON ap_vendor_column_mappings(vendor_tax_id);
CREATE INDEX IF NOT EXISTS idx_ap_vendor_map_created_at ON ap_vendor_column_mappings(created_at);
CREATE INDEX IF NOT EXISTS idx_ap_vendor_map_deleted_at ON ap_vendor_column_mappings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ap_vendor_map_created_by ON ap_vendor_column_mappings(created_by);


-- ── ap_vendor_field_mapping_entries — fields mapped for column mapping ────

CREATE TABLE IF NOT EXISTS ap_vendor_field_mapping_entries (
    id          SERIAL       PRIMARY KEY,
    mapping_id  INTEGER      NOT NULL REFERENCES ap_vendor_column_mappings(id) ON DELETE CASCADE,
    column_name VARCHAR(255) NOT NULL,
    field_name  VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP    NULL,
    deleted_by  VARCHAR(100) NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ap_vendor_entry_active
    ON ap_vendor_field_mapping_entries (mapping_id, column_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ap_vendor_entry_mapping_id ON ap_vendor_field_mapping_entries(mapping_id);
CREATE INDEX IF NOT EXISTS idx_ap_vendor_entry_field_name ON ap_vendor_field_mapping_entries(field_name);
CREATE INDEX IF NOT EXISTS idx_ap_vendor_entry_created_at ON ap_vendor_field_mapping_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_ap_vendor_entry_deleted_at ON ap_vendor_field_mapping_entries(deleted_at);


-- ── bug_reports — user-submitted bug reports ──────────────────────────────

CREATE TABLE IF NOT EXISTS bug_reports (
    id              SERIAL       PRIMARY KEY,
    tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id       VARCHAR(50)  NOT NULL,
    category        VARCHAR(32)  NOT NULL,
    description     TEXT         NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'open',
    screenshot_b64  TEXT         NULL,
    screenshot_mime VARCHAR(16)  NULL,
    carmen_user_id  VARCHAR(36)  NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP             DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMP    NULL,
    deleted_by      VARCHAR(100) NULL,
    created_by      VARCHAR(100) NULL,
    updated_by      VARCHAR(100) NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_tenant_id ON bug_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_module_id ON bug_reports(module_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_carmen_user_id ON bug_reports(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_deleted_at ON bug_reports(deleted_at);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_by ON bug_reports(created_by);


-- ── llm_usage_logs — logs of LLM tokens and costs ─────────────────────────

CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id                BIGSERIAL     PRIMARY KEY,
    tenant_id         VARCHAR(36)   NOT NULL,
    task_id           VARCHAR(36)   NULL,
    module_id         VARCHAR(50)   NULL,
    carmen_session_id VARCHAR(36)   NULL,
    carmen_user_id    VARCHAR(36)   NULL,
    model             VARCHAR(100)  NOT NULL,
    prompt_tokens     INTEGER       NOT NULL DEFAULT 0,
    completion_tokens INTEGER       NOT NULL DEFAULT 0,
    total_tokens      INTEGER       NOT NULL DEFAULT 0,
    duration_ms       DOUBLE PRECISION NULL,
    cost_usd          NUMERIC(10,6) NULL,
    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP              DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_logs_tenant_id ON llm_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_logs_task_id ON llm_usage_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_llm_logs_module_id ON llm_usage_logs(module_id);
CREATE INDEX IF NOT EXISTS idx_llm_logs_session_id ON llm_usage_logs(carmen_session_id);
CREATE INDEX IF NOT EXISTS idx_llm_logs_user_id ON llm_usage_logs(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_llm_logs_created_at ON llm_usage_logs(created_at);


-- ── audit_logs — audit log trails ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id            BIGSERIAL    PRIMARY KEY,
    tenant_id     VARCHAR(36)  NULL,
    admin_user_id VARCHAR(36)  NULL,
    carmen_user_id VARCHAR(36) NULL,
    username      VARCHAR(100) NULL,
    session_id    VARCHAR(36)  NULL,
    ip_address    VARCHAR(45)  NULL,
    action        VARCHAR(50)  NOT NULL,
    resource      VARCHAR(50)  NULL,
    resource_id   VARCHAR(255) NULL,
    target_type   VARCHAR(50)  NULL,
    target_id     VARCHAR(100) NULL,
    before_value  JSON         NULL,
    after_value   JSON         NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP             DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_carmen_user ON audit_logs(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type ON audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);


-- ── performance_logs — request duration monitoring ────────────────────────

CREATE TABLE IF NOT EXISTS performance_logs (
    id             BIGSERIAL        PRIMARY KEY,
    tenant_id      VARCHAR(36)      NULL,
    endpoint       VARCHAR(200)     NOT NULL,
    method         VARCHAR(10)      NULL,
    duration_ms    DOUBLE PRECISION NOT NULL,
    status_code    INTEGER          NULL,
    carmen_user_id VARCHAR(36)      NULL,
    resource_id    VARCHAR(255)     NULL,
    created_at     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP                 DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_perf_logs_tenant_id ON performance_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_logs_endpoint ON performance_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_perf_logs_user ON performance_logs(carmen_user_id);
CREATE INDEX IF NOT EXISTS idx_perf_logs_created_at ON performance_logs(created_at);


-- ── outbound_call_logs — external endpoint call logging ───────────────────

CREATE TABLE IF NOT EXISTS outbound_call_logs (
    id                 BIGSERIAL        PRIMARY KEY,
    tenant_id          VARCHAR(36)      NULL,
    service            VARCHAR(50)      NOT NULL,
    url                VARCHAR(500)     NOT NULL,
    method             VARCHAR(10)      NULL,
    status_code        INTEGER          NULL,
    duration_ms        DOUBLE PRECISION NULL,
    request_size_bytes INTEGER          NULL,
    session_id         VARCHAR(36)      NULL,
    carmen_user_id     VARCHAR(36)      NULL,
    created_at         TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP                 DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbound_logs_tenant_id ON outbound_call_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outbound_logs_service ON outbound_call_logs(service);
CREATE INDEX IF NOT EXISTS idx_outbound_logs_session ON outbound_call_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_outbound_logs_created_at ON outbound_call_logs(created_at);


-- ── daily_usage_summary — aggregated metrics per day ──────────────────────

CREATE TABLE IF NOT EXISTS daily_usage_summary (
    id                   SERIAL         PRIMARY KEY,
    tenant_id            VARCHAR(36)    NOT NULL,
    module_id            VARCHAR(50)    NULL,
    summary_date         TIMESTAMP      NOT NULL,
    total_documents      INTEGER        DEFAULT 0,
    total_submissions    INTEGER        DEFAULT 0,
    total_llm_calls      INTEGER        DEFAULT 0,
    total_tokens         BIGINT         DEFAULT 0,
    total_cost_usd       NUMERIC(12,4)  DEFAULT 0.0000,
    avg_llm_latency_ms   DOUBLE PRECISION DEFAULT 0.00,
    total_api_calls      INTEGER        DEFAULT 0,
    avg_api_latency_ms   DOUBLE PRECISION DEFAULT 0.00,
    p95_api_latency_ms   DOUBLE PRECISION DEFAULT 0.00,
    total_errors         INTEGER        DEFAULT 0,
    total_corrections    INTEGER        DEFAULT 0,
    total_outbound_calls INTEGER        DEFAULT 0,
    created_at           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_summary_scope_module_date UNIQUE (tenant_id, module_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_tenant_id ON daily_usage_summary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_summary_module_id ON daily_usage_summary(module_id);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_usage_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_created_at ON daily_usage_summary(created_at);


-- ── daily_model_cost — model costs aggregated per day ─────────────────────

CREATE TABLE IF NOT EXISTS daily_model_cost (
    id           SERIAL         PRIMARY KEY,
    summary_date DATE           NOT NULL,
    tenant_id    VARCHAR(36)    NOT NULL,
    module_id    VARCHAR(50)    NULL,
    model_name   VARCHAR(100)   NOT NULL,
    call_count   INTEGER        DEFAULT 0,
    input_tokens BIGINT         DEFAULT 0,
    output_tokens BIGINT         DEFAULT 0,
    cost_usd     NUMERIC(12,6)  DEFAULT 0.000000,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_daily_model_cost UNIQUE (summary_date, tenant_id, module_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_daily_model_date ON daily_model_cost(summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_model_tenant ON daily_model_cost(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_model_module ON daily_model_cost(module_id);
CREATE INDEX IF NOT EXISTS idx_daily_model_created_at ON daily_model_cost(created_at);


-- ── monthly_usage_summary — aggregated metrics per month ───────────────────

CREATE TABLE IF NOT EXISTS monthly_usage_summary (
    id                   SERIAL         PRIMARY KEY,
    tenant_id            VARCHAR(36)    NOT NULL,
    module_id            VARCHAR(50)    NULL,
    summary_date         DATE           NOT NULL,
    total_documents      INTEGER        DEFAULT 0,
    total_submissions    INTEGER        DEFAULT 0,
    total_llm_calls      INTEGER        DEFAULT 0,
    total_tokens         BIGINT         DEFAULT 0,
    total_cost_usd       NUMERIC(12,4)  DEFAULT 0.0000,
    avg_llm_latency_ms   DOUBLE PRECISION DEFAULT 0.00,
    total_api_calls      INTEGER        DEFAULT 0,
    avg_api_latency_ms   DOUBLE PRECISION DEFAULT 0.00,
    p95_api_latency_ms   DOUBLE PRECISION DEFAULT 0.00,
    total_errors         INTEGER        DEFAULT 0,
    total_corrections    INTEGER        DEFAULT 0,
    total_outbound_calls INTEGER        DEFAULT 0,
    created_at           TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP              DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_monthly_summary_scope UNIQUE (tenant_id, module_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_tenant_id ON monthly_usage_summary(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_module_id ON monthly_usage_summary(module_id);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_date ON monthly_usage_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_created_at ON monthly_usage_summary(created_at);


-- ── anomaly_alerts — system/tenant performance/usage alerts ───────────────

CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id          BIGSERIAL     PRIMARY KEY,
    tenant_id   VARCHAR(36)   NOT NULL,
    module_id   VARCHAR(50)   NULL,
    metric      VARCHAR(50)   NOT NULL,
    severity    VARCHAR(50)   NOT NULL DEFAULT 'warn',
    threshold   NUMERIC(14,4) NULL,
    actual      NUMERIC(14,4) NULL,
    description TEXT          NULL,
    resolved_at TIMESTAMP     NULL,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP              DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_tenant ON anomaly_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_module ON anomaly_alerts(module_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_metric ON anomaly_alerts(metric);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_created_at ON anomaly_alerts(created_at);


-- ── job_runs — execution status of background cron jobs ───────────────────

CREATE TABLE IF NOT EXISTS job_runs (
    id             BIGSERIAL   PRIMARY KEY,
    job_name       VARCHAR(50) NOT NULL,
    tenant_id      VARCHAR(36) NULL,
    status         VARCHAR(50) NOT NULL DEFAULT 'running',
    started_at     TIMESTAMP   NOT NULL,
    completed_at   TIMESTAMP   NULL,
    rows_affected  INTEGER     NULL,
    error_message  TEXT        NULL,
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP            DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name ON job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_runs_tenant ON job_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_started ON job_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_job_runs_created_at ON job_runs(created_at);
