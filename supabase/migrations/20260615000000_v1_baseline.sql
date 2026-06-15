-- V1 Baseline — clean squash of 219 custom app migrations into one authoritative DDL.
-- Greenfield: no production data. Generated manually (Docker not running for db diff).
-- Replaces: custom _MIGRATIONS runner in backend/app/migrations.py (deleted in backend cutover).
--
-- Covers: all plain tables from schemas/10_identity.sql through schemas/60_analytics.sql.
-- EXCLUDES: log tables (partitioned, see 20260615000001_partition_log_tables.sql),
--           seeds (see 20260615000002_seed_control_plane.sql + 20260615000003_seed_billing_config.sql),
--           pg_cron/pg_net/pgvector (see later migrations).
--
-- All previously reverted migrations (211-213), no-op markers (001, 199, 201-205), and
-- already-dropped tables (business_units, mapping_history, ap_vendor_field_config) are
-- simply absent — they have no place in a clean v1.

-- ── Extensions ────────────────────────────────────────────────────────────────
-- Enable here so subsequent migrations can use gen_random_uuid() etc.
-- pg_cron / pg_net / pg_partman / vector are enabled in their own migrations
-- so they appear in the audit trail with clear intent.
-- gen_random_uuid() is built-in to PG 13+ (no extension needed).


-- ── Enum types ────────────────────────────────────────────────────────────────
-- SQLAlchemy SAEnum creates native PG types with the Python class name lowercased.
-- We define them once here (IF NOT EXISTS guard) so re-runs are safe.

do $$ begin create type taskstatus         as enum ('pending', 'processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin create type alertseverity      as enum ('info', 'warn', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin create type jobstatus          as enum ('running', 'success', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin create type prompttype         as enum ('ocr', 'mapping', 'correction');
exception when duplicate_object then null; end $$;

do $$ begin create type promptstatus       as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin create type quotaperiod        as enum ('daily', 'monthly', 'yearly', 'lifetime');
exception when duplicate_object then null; end $$;

do $$ begin create type quotametric        as enum ('calls', 'tokens', 'cost_usd', 'documents');
exception when duplicate_object then null; end $$;

do $$ begin create type creditledgerreason as enum ('topup', 'consumption', 'admin_adjust', 'refund');
exception when duplicate_object then null; end $$;

do $$ begin create type creditorderstatus  as enum ('pending', 'awaiting_review', 'paid', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin create type billingdocumenttype as enum ('proforma', 'tax_invoice');
exception when duplicate_object then null; end $$;


-- ── IDENTITY ──────────────────────────────────────────────────────────────────

create table plans (
    code                varchar(20)  primary key,
    display_name        varchar(100) not null,
    monthly_call_limit  integer      not null,
    is_active           boolean      not null default true,
    created_at          timestamptz  not null default now(),
    updated_at          timestamptz           default now(),
    created_by          varchar(100),
    updated_by          varchar(100)
);
create index ix_plans_created_at on plans (created_at);


create table tenants (
    id            uuid         primary key default gen_random_uuid(),
    host          varchar(255) not null,
    bu_code       varchar(100) not null,
    name          varchar(255) not null,
    plan          varchar(20)  not null default 'free' references plans (code),
    is_active     boolean      not null default true,
    contact_email varchar(255),
    notes         text,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz           default now(),
    deleted_at    timestamptz,
    deleted_by    varchar(100),
    created_by    varchar(100),
    updated_by    varchar(100)
);
create index ix_tenants_host       on tenants (host);
create index ix_tenants_created_at on tenants (created_at);
create index ix_tenants_deleted_at on tenants (deleted_at);
create unique index uq_tenants_host_bu_active on tenants (host, bu_code) where deleted_at is null;


-- ── ADMIN RBAC ────────────────────────────────────────────────────────────────

create table admin_users (
    id                     uuid         primary key default gen_random_uuid(),
    email                  varchar(255) not null,
    password_hash          varchar(255) not null,
    full_name              varchar(255),
    is_active              boolean      not null default true,
    mfa_secret             varchar(64),
    last_login_at          timestamptz,
    last_login_ip          varchar(45),
    failed_login_attempts  integer      not null default 0,
    locked_until           timestamptz,
    created_at             timestamptz  not null default now(),
    updated_at             timestamptz           default now(),
    deleted_at             timestamptz,
    deleted_by             varchar(100),
    created_by             varchar(100),
    updated_by             varchar(100)
);
create index ix_admin_users_created_at on admin_users (created_at);
create index ix_admin_users_deleted_at on admin_users (deleted_at);
create unique index uq_admin_user_email_active on admin_users (email) where deleted_at is null;


create table roles (
    id          varchar(50)  primary key,
    name        varchar(100) not null,
    description text,
    is_system   boolean      not null default false,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz           default now(),
    deleted_at  timestamptz,
    deleted_by  varchar(100)
);
create index ix_roles_created_at on roles (created_at);
create index ix_roles_deleted_at on roles (deleted_at);


create table permissions (
    id          varchar(100) primary key,
    name        varchar(255) not null,
    resource    varchar(50)  not null,
    action      varchar(50)  not null,
    description text,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz           default now()
);
create index ix_permissions_resource   on permissions (resource);
create index ix_permissions_created_at on permissions (created_at);


create table role_permissions (
    role_id       varchar(50)  not null references roles (id),
    permission_id varchar(100) not null references permissions (id),
    primary key (role_id, permission_id)
);
create index ix_role_permissions_permission_id on role_permissions (permission_id);


create table admin_user_roles (
    user_id    uuid        not null references admin_users (id),
    role_id    varchar(50) not null references roles (id),
    tenant_id  varchar(36) not null default '',
    granted_by varchar(36),
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz          default now(),
    primary key (user_id, role_id, tenant_id)
);
create index ix_admin_user_roles_created_at on admin_user_roles (created_at);
create index ix_admin_user_roles_role_id    on admin_user_roles (role_id);


-- ── API KEYS (roadmap) ────────────────────────────────────────────────────────

create table api_keys (
    id              uuid         primary key default gen_random_uuid(),
    name            varchar(100) not null,
    key_prefix      varchar(12)  not null,
    key_hash        varchar(255) not null,
    tenant_id       uuid         references tenants (id),
    scopes          jsonb        not null default '[]',
    rate_limit_rpm  integer      not null default 60,
    expires_at      timestamptz,
    last_used_at    timestamptz,
    last_used_ip    varchar(45),
    revoked_at      timestamptz,
    revoked_by      varchar(36),
    revoke_reason   text,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz           default now(),
    created_by      varchar(100),
    updated_by      varchar(100)
);
create index ix_api_keys_key_prefix  on api_keys (key_prefix);
create index ix_api_keys_tenant_id   on api_keys (tenant_id);
create index ix_api_keys_expires_at  on api_keys (expires_at);
create index ix_api_keys_revoked_at  on api_keys (revoked_at);
create index ix_api_keys_created_at  on api_keys (created_at);
create unique index uq_api_key_hash_active on api_keys (key_hash) where revoked_at is null;


create table api_key_usage (
    api_key_id  uuid           not null references api_keys (id),
    usage_date  date           not null,
    calls       integer        not null default 0,
    errors      integer        not null default 0,
    tokens      bigint         not null default 0,
    cost_usd    numeric(12, 4) not null default 0,
    created_at  timestamptz    not null default now(),
    updated_at  timestamptz             default now(),
    primary key (api_key_id, usage_date)
);
create index ix_api_key_usage_created_at on api_key_usage (created_at);


-- ── MODULES ───────────────────────────────────────────────────────────────────

create table modules (
    id           varchar(50)  primary key,
    display_name varchar(100) not null,
    description  text,
    is_active    boolean      not null default true,
    sort_order   integer               default 0,
    created_at   timestamptz  not null default now(),
    updated_at   timestamptz           default now()
);
create index ix_modules_created_at on modules (created_at);


create table tenant_modules (
    tenant_id   uuid        not null references tenants (id),
    module_id   varchar(50) not null references modules (id),
    enabled     boolean     not null default true,
    enabled_at  timestamptz,
    disabled_at timestamptz,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz          default now(),
    created_by  varchar(100),
    updated_by  varchar(100),
    primary key (tenant_id, module_id)
);
create index ix_tenant_modules_created_at on tenant_modules (created_at);


-- ── BANK CMS ──────────────────────────────────────────────────────────────────

create table banks (
    code              varchar(20)  primary key,
    name              varchar(100) not null,
    display_name_th   varchar(100),
    is_active         boolean      not null default true,
    detection_pattern varchar(500),
    sort_order        integer               default 0,
    icon_url          varchar(500),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz           default now(),
    deleted_at        timestamptz,
    deleted_by        varchar(100),
    created_by        varchar(100),
    updated_by        varchar(100)
);
create index ix_banks_created_at on banks (created_at);
create index ix_banks_deleted_at on banks (deleted_at);


create table prompt_templates (
    id           uuid         primary key default gen_random_uuid(),
    bank_code    varchar(20)  references banks (code),
    prompt_type  prompttype   not null,
    version      integer      not null,
    status       promptstatus not null default 'draft',
    content      text         not null,
    notes        text,
    published_at timestamptz,
    published_by uuid         references admin_users (id),
    created_at   timestamptz  not null default now(),
    updated_at   timestamptz           default now(),
    deleted_at   timestamptz,
    deleted_by   varchar(100),
    created_by   varchar(100),
    updated_by   varchar(100)
);
create index ix_prompt_templates_bank_code  on prompt_templates (bank_code);
create index ix_prompt_templates_status     on prompt_templates (status);
create index ix_prompt_templates_created_at on prompt_templates (created_at);
create index ix_prompt_templates_deleted_at on prompt_templates (deleted_at);
create unique index uq_prompt_bank_type_version_active
    on prompt_templates (bank_code, prompt_type, version) where deleted_at is null;


-- ── CONFIGURATION ─────────────────────────────────────────────────────────────

create table system_configs (
    key_name          varchar(100) primary key,
    value             jsonb        not null,
    value_type        varchar(20)  not null,
    category          varchar(50)  not null,
    description       text,
    is_secret         boolean      not null default false,
    requires_restart  boolean      not null default false,
    default_value     jsonb,
    validation_regex  varchar(500),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz           default now(),
    created_by        varchar(100),
    updated_by        varchar(100)
);
create index ix_system_configs_category   on system_configs (category);
create index ix_system_configs_created_at on system_configs (created_at);


create table tenant_config_overrides (
    tenant_id  uuid         not null references tenants (id),
    key_name   varchar(100) not null references system_configs (key_name),
    value      jsonb        not null,
    created_at timestamptz  not null default now(),
    updated_at timestamptz           default now(),
    created_by varchar(100),
    updated_by varchar(100),
    primary key (tenant_id, key_name)
);
create index ix_tenant_config_overrides_created_at on tenant_config_overrides (created_at);


create table feature_flags (
    flag_key        varchar(100) primary key,
    description     text,
    enabled_global  boolean      not null default false,
    enabled_tenants jsonb,
    rollout_pct     integer      not null default 0,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz           default now(),
    created_by      varchar(100),
    updated_by      varchar(100)
);
create index ix_feature_flags_created_at on feature_flags (created_at);


-- ── QUOTAS ────────────────────────────────────────────────────────────────────

create table quotas (
    id            uuid          primary key default gen_random_uuid(),
    tenant_id     uuid          not null references tenants (id),
    period        quotaperiod   not null,
    metric        quotametric   not null,
    limit_value   numeric(18, 4) not null,
    soft_warn_pct numeric(3, 2) not null default 0.80,
    is_hard       boolean       not null default true,
    is_custom     boolean       not null default false,
    created_at    timestamptz   not null default now(),
    updated_at    timestamptz            default now(),
    deleted_at    timestamptz,
    deleted_by    varchar(100),
    created_by    varchar(100),
    updated_by    varchar(100)
);
create index ix_quotas_tenant_id  on quotas (tenant_id);
create index ix_quotas_created_at on quotas (created_at);
create index ix_quotas_deleted_at on quotas (deleted_at);
create unique index uq_quota_tenant_period_metric_active
    on quotas (tenant_id, period, metric) where deleted_at is null;


create table quota_usage (
    quota_id        uuid           not null references quotas (id),
    period_key      varchar(10)    not null,
    used            numeric(18, 4) not null default 0,
    last_updated_at timestamptz    not null default now(),
    created_at      timestamptz    not null default now(),
    updated_at      timestamptz             default now(),
    primary key (quota_id, period_key)
);
create index ix_quota_usage_created_at on quota_usage (created_at);


-- ── REFERENCE ─────────────────────────────────────────────────────────────────

create table model_pricing (
    model_name           varchar(255)   primary key,
    input_price_per_1m   numeric(18, 9) not null default 0,
    output_price_per_1m  numeric(18, 9) not null default 0,
    source               varchar(50)    not null default 'manual',
    price_verified_at    timestamptz,
    created_at           timestamptz    not null default now(),
    updated_at           timestamptz             default now()
);
create index ix_model_pricing_created_at on model_pricing (created_at);


-- ── BUSINESS DATA ─────────────────────────────────────────────────────────────

create table ocr_sessions (
    id                      uuid         primary key default gen_random_uuid(),
    tenant_id               uuid         not null references tenants (id),
    carmen_user_id          varchar(36),
    username                varchar(100),
    carmen_token_encrypted  text         not null,
    carmen_uri              varchar(500),
    is_active               boolean      not null default true,
    last_used_at            timestamptz,
    created_at              timestamptz  not null default now(),
    updated_at              timestamptz           default now(),
    deleted_at              timestamptz,
    deleted_by              varchar(100)
);
create index ix_ocr_sessions_tenant_id   on ocr_sessions (tenant_id);
create index ix_ocr_sessions_carmen_user on ocr_sessions (carmen_user_id);
create index ix_ocr_sessions_created_at  on ocr_sessions (created_at);
create index ix_ocr_sessions_deleted_at  on ocr_sessions (deleted_at);
create index ix_ocr_sessions_active
    on ocr_sessions (tenant_id, carmen_user_id) where is_active = true and deleted_at is null;


create table ocr_tasks (
    id                uuid         primary key default gen_random_uuid(),
    tenant_id         uuid         not null references tenants (id),
    module_id         varchar(50)  not null references modules (id),
    original_filename varchar(255) not null,
    status            taskstatus   not null default 'pending',
    ocr_engine        varchar(100),
    error_message     text,
    completed_at      timestamptz,
    carmen_user_id    varchar(36),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz           default now(),
    deleted_at        timestamptz,
    deleted_by        varchar(100)
);
create index ix_ocr_tasks_tenant_id   on ocr_tasks (tenant_id);
create index ix_ocr_tasks_module_id   on ocr_tasks (module_id);
create index ix_ocr_tasks_carmen_user on ocr_tasks (carmen_user_id);
create index ix_ocr_tasks_created_at  on ocr_tasks (created_at);
create index ix_ocr_tasks_deleted_at  on ocr_tasks (deleted_at);


create table credit_cards (
    id                uuid         primary key default gen_random_uuid(),
    tenant_id         uuid         not null references tenants (id),
    task_id           uuid         not null references ocr_tasks (id),
    bank_code         varchar(20)  references banks (code),
    company_name      varchar(255),
    bank_company_name varchar(255),
    doc_date          date,
    doc_no            varchar(100),
    branch_no         varchar(50),
    submitted_at      timestamptz,
    carmen_user_id    varchar(36),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz           default now(),
    deleted_at        timestamptz,
    deleted_by        varchar(100),
    created_by        varchar(100),
    updated_by        varchar(100)
);
create index ix_credit_cards_tenant_id   on credit_cards (tenant_id);
create index ix_credit_cards_task_id     on credit_cards (task_id);
create index ix_credit_cards_bank_code   on credit_cards (bank_code);
create index ix_credit_cards_doc_date    on credit_cards (doc_date);
create index ix_credit_cards_doc_no      on credit_cards (doc_no);
create index ix_credit_cards_carmen_user on credit_cards (carmen_user_id);
create index ix_credit_cards_created_at  on credit_cards (created_at);
create index ix_credit_cards_deleted_at  on credit_cards (deleted_at);
create unique index uq_credit_card_no_dup
    on credit_cards (tenant_id, bank_code, doc_no) where submitted_at is not null and deleted_at is null;


create table ap_invoices (
    id                uuid         primary key default gen_random_uuid(),
    tenant_id         uuid         not null references tenants (id),
    task_id           uuid         not null references ocr_tasks (id),
    vendor_name       varchar(255),
    doc_no            varchar(100),
    doc_date          date,
    original_filename varchar(255),
    submitted_at      timestamptz,
    carmen_user_id    varchar(36),
    created_at        timestamptz  not null default now(),
    updated_at        timestamptz           default now(),
    deleted_at        timestamptz,
    deleted_by        varchar(100),
    created_by        varchar(100),
    updated_by        varchar(100)
);
create index ix_ap_invoices_tenant_id   on ap_invoices (tenant_id);
create index ix_ap_invoices_task_id     on ap_invoices (task_id);
create index ix_ap_invoices_doc_date    on ap_invoices (doc_date);
create index ix_ap_invoices_carmen_user on ap_invoices (carmen_user_id);
create index ix_ap_invoices_created_at  on ap_invoices (created_at);
create index ix_ap_invoices_deleted_at  on ap_invoices (deleted_at);


create table correction_feedback (
    id              serial       primary key,
    tenant_id       uuid         not null references tenants (id),
    doc_no          varchar(100) not null,
    bank_code       varchar(20)  not null references banks (code),
    field_name      varchar(100) not null,
    original_value  text,
    corrected_value text,
    carmen_user_id  varchar(36),
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz           default now(),
    deleted_at      timestamptz,
    deleted_by      varchar(100),
    created_by      varchar(100),
    updated_by      varchar(100)
);
create index ix_correction_feedback_tenant_id   on correction_feedback (tenant_id);
create index ix_correction_feedback_doc_no      on correction_feedback (doc_no);
create index ix_correction_feedback_bank_code   on correction_feedback (bank_code);
create index ix_correction_feedback_field_name  on correction_feedback (field_name);
create index ix_correction_feedback_carmen_user on correction_feedback (carmen_user_id);
create index ix_correction_feedback_created_at  on correction_feedback (created_at);
create index ix_correction_feedback_deleted_at  on correction_feedback (deleted_at);
create unique index uq_correction_scope_active
    on correction_feedback (tenant_id, doc_no, field_name) where deleted_at is null;


create table bu_accounting_configs (
    id          serial       primary key,
    tenant_id   uuid         not null references tenants (id),
    bank_code   varchar(20)  references banks (code),
    file_prefix varchar(20),
    file_source varchar(20),
    description varchar(255),
    branch      varchar(50),
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz           default now(),
    deleted_at  timestamptz,
    deleted_by  varchar(100),
    created_by  varchar(100),
    updated_by  varchar(100)
);
create index ix_bu_accounting_configs_tenant_id  on bu_accounting_configs (tenant_id);
create index ix_bu_accounting_configs_bank_code  on bu_accounting_configs (bank_code);
create index ix_bu_accounting_configs_created_at on bu_accounting_configs (created_at);
create index ix_bu_accounting_configs_deleted_at on bu_accounting_configs (deleted_at);
create unique index uq_bu_accounting_config_active on bu_accounting_configs (tenant_id) where deleted_at is null;


create table bu_accounting_mapping_entries (
    id         serial       primary key,
    config_id  integer      not null references bu_accounting_configs (id),
    field_type varchar(100) not null,
    dept_code  varchar(100),
    acc_code   varchar(100),
    is_custom  boolean      not null default false,
    created_at timestamptz  not null default now(),
    updated_at timestamptz           default now(),
    deleted_at timestamptz,
    deleted_by varchar(100)
);
create index ix_bu_accounting_mapping_entries_config_id  on bu_accounting_mapping_entries (config_id);
create index ix_bu_accounting_mapping_entries_dept_code  on bu_accounting_mapping_entries (dept_code);
create index ix_bu_accounting_mapping_entries_acc_code   on bu_accounting_mapping_entries (acc_code);
create index ix_bu_accounting_mapping_entries_created_at on bu_accounting_mapping_entries (created_at);
create index ix_bu_accounting_mapping_entries_deleted_at on bu_accounting_mapping_entries (deleted_at);
create unique index uq_bu_mapping_entry_active
    on bu_accounting_mapping_entries (config_id, field_type) where deleted_at is null;


create table ap_vendor_column_mappings (
    id            serial      primary key,
    tenant_id     uuid        not null references tenants (id),
    vendor_tax_id varchar(30) not null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz          default now(),
    deleted_at    timestamptz,
    deleted_by    varchar(100),
    created_by    varchar(100),
    updated_by    varchar(100)
);
create index ix_ap_vendor_column_mappings_tenant_id     on ap_vendor_column_mappings (tenant_id);
create index ix_ap_vendor_column_mappings_vendor_tax_id on ap_vendor_column_mappings (vendor_tax_id);
create index ix_ap_vendor_column_mappings_created_at    on ap_vendor_column_mappings (created_at);
create index ix_ap_vendor_column_mappings_deleted_at    on ap_vendor_column_mappings (deleted_at);
create unique index uq_ap_vendor_mapping_active
    on ap_vendor_column_mappings (tenant_id, vendor_tax_id) where deleted_at is null;


create table ap_vendor_field_mapping_entries (
    id          serial       primary key,
    mapping_id  integer      not null references ap_vendor_column_mappings (id),
    column_name varchar(255) not null,
    field_name  varchar(100) not null,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz           default now(),
    deleted_at  timestamptz,
    deleted_by  varchar(100)
);
create index ix_ap_vendor_field_mapping_entries_mapping_id on ap_vendor_field_mapping_entries (mapping_id);
create index ix_ap_vendor_field_mapping_entries_field_name on ap_vendor_field_mapping_entries (field_name);
create index ix_ap_vendor_field_mapping_entries_created_at on ap_vendor_field_mapping_entries (created_at);
create index ix_ap_vendor_field_mapping_entries_deleted_at on ap_vendor_field_mapping_entries (deleted_at);
create unique index uq_ap_vendor_entry_active
    on ap_vendor_field_mapping_entries (mapping_id, column_name) where deleted_at is null;


create table bug_reports (
    id              serial      primary key,
    tenant_id       uuid        not null references tenants (id),
    module_id       varchar(50) not null,
    category        varchar(32) not null,
    description     text        not null,
    status          varchar(16) not null default 'open',
    screenshot_b64  text,
    screenshot_mime varchar(16),
    carmen_user_id  varchar(36),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz          default now(),
    deleted_at      timestamptz,
    deleted_by      varchar(100),
    created_by      varchar(100),
    updated_by      varchar(100)
);
create index ix_bug_reports_tenant_id   on bug_reports (tenant_id);
create index ix_bug_reports_module_id   on bug_reports (module_id);
create index ix_bug_reports_status      on bug_reports (status);
create index ix_bug_reports_carmen_user on bug_reports (carmen_user_id);
create index ix_bug_reports_created_at  on bug_reports (created_at);
create index ix_bug_reports_deleted_at  on bug_reports (deleted_at);


-- ── BILLING ───────────────────────────────────────────────────────────────────

create table credit_packs (
    code        varchar(20)    primary key,
    kind        varchar(20)    not null default 'topup',
    credits     integer        not null,
    price_thb   numeric(10, 2) not null,
    is_active   boolean        not null default true,
    sort_order  integer        not null default 0,
    created_at  timestamptz    not null default now(),
    updated_at  timestamptz             default now(),
    created_by  varchar(100),
    updated_by  varchar(100)
);
create index ix_credit_packs_created_at on credit_packs (created_at);


create table tenant_credits (
    tenant_id         uuid    primary key references tenants (id),
    balance           integer not null default 0,
    credits_purchased integer not null default 0,
    credits_consumed  integer not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz          default now()
);
create index ix_tenant_credits_created_at on tenant_credits (created_at);


create table credit_ledger (
    id            uuid               primary key default gen_random_uuid(),
    tenant_id     uuid               not null references tenants (id),
    delta         integer            not null,
    balance_after integer            not null,
    reason        creditledgerreason not null,
    pack_code     varchar(20)        references credit_packs (code),
    ref           text,
    note          text,
    created_at    timestamptz        not null default now(),
    updated_at    timestamptz                 default now(),
    created_by    varchar(100),
    updated_by    varchar(100)
);
create index ix_credit_ledger_tenant_created on credit_ledger (tenant_id, created_at);
create index ix_credit_ledger_created_at     on credit_ledger (created_at);


create table credit_orders (
    id               uuid              primary key default gen_random_uuid(),
    tenant_id        uuid              not null references tenants (id),
    pack_code        varchar(20)       not null references credit_packs (code),
    credits          integer           not null,
    amount_thb       numeric(10, 2)    not null,
    status           creditorderstatus not null default 'pending',
    payment_ref      varchar(128),
    paid_at          timestamptz,
    approved_by      varchar(100),
    approved_at      timestamptz,
    slip_object_key  varchar(512),
    slip_uploaded_at timestamptz,
    rejected_reason  text,
    created_at       timestamptz       not null default now(),
    updated_at       timestamptz                default now(),
    deleted_at       timestamptz,
    deleted_by       varchar(100),
    created_by       varchar(100),
    updated_by       varchar(100)
);
create index ix_credit_orders_tenant_id  on credit_orders (tenant_id);
create index ix_credit_orders_created_at on credit_orders (created_at);
create index ix_credit_orders_deleted_at on credit_orders (deleted_at);
create index ix_credit_orders_tenant_status
    on credit_orders (tenant_id, status) where deleted_at is null;
create unique index uq_credit_orders_one_open_per_pack
    on credit_orders (tenant_id, pack_code)
    where status in ('pending', 'awaiting_review') and deleted_at is null;


create table billing_documents (
    id              uuid                primary key default gen_random_uuid(),
    tenant_id       uuid                not null references tenants (id),
    order_id        uuid                not null references credit_orders (id),
    doc_type        billingdocumenttype not null,
    number          varchar(50)         not null,
    issue_date      timestamptz         not null,
    seller_name     varchar(255),
    seller_tax_id   varchar(20),
    seller_address  text,
    seller_branch   varchar(100),
    buyer_name      varchar(255),
    buyer_tax_id    varchar(20),
    buyer_address   text,
    buyer_branch    varchar(100),
    pack_code       varchar(20)         not null,
    description     text,
    credits         integer             not null,
    subtotal        numeric(12, 2)      not null,
    vat_rate        numeric(4, 2)       not null default 7.00,
    vat_amount      numeric(12, 2)      not null,
    total           numeric(12, 2)      not null,
    currency        varchar(3)          not null default 'THB',
    created_at      timestamptz         not null default now(),
    updated_at      timestamptz                  default now(),
    deleted_at      timestamptz,
    deleted_by      varchar(100)
);
create index ix_billing_documents_created_at  on billing_documents (created_at);
create index ix_billing_documents_deleted_at  on billing_documents (deleted_at);
create index ix_billing_documents_tenant_type on billing_documents (tenant_id, doc_type, created_at);
create unique index uq_billing_documents_number_active on billing_documents (number) where deleted_at is null;


create table document_sequences (
    scope      varchar(20) not null,
    period_key varchar(6)  not null,
    last_no    integer     not null default 0,
    primary key (scope, period_key)
);


-- ── ANALYTICS ─────────────────────────────────────────────────────────────────

create table daily_usage_summary (
    id                   serial         primary key,
    tenant_id            varchar(36)    not null,
    module_id            varchar(50),
    summary_date         date           not null,
    total_documents      integer        not null default 0,
    total_submissions    integer        not null default 0,
    total_llm_calls      integer        not null default 0,
    total_tokens         bigint         not null default 0,
    total_cost_usd       numeric(12, 4) not null default 0,
    avg_llm_latency_ms   float          not null default 0,
    total_api_calls      integer        not null default 0,
    avg_api_latency_ms   float          not null default 0,
    p95_api_latency_ms   float          not null default 0,
    total_errors         integer        not null default 0,
    total_corrections    integer        not null default 0,
    total_outbound_calls integer        not null default 0,
    created_at           timestamptz    not null default now(),
    updated_at           timestamptz             default now(),
    constraint uq_summary_scope_module_date unique (tenant_id, module_id, summary_date)
);
create index ix_daily_usage_summary_tenant_id  on daily_usage_summary (tenant_id);
create index ix_daily_usage_summary_module_id  on daily_usage_summary (module_id);
create index ix_daily_usage_summary_date       on daily_usage_summary (summary_date);
create index ix_daily_usage_summary_created_at on daily_usage_summary (created_at);


create table daily_model_cost (
    id            serial         primary key,
    summary_date  date           not null,
    tenant_id     varchar(36)    not null,
    module_id     varchar(50),
    model_name    varchar(100)   not null,
    call_count    integer        not null default 0,
    input_tokens  bigint         not null default 0,
    output_tokens bigint         not null default 0,
    cost_usd      numeric(12, 6) not null default 0,
    created_at    timestamptz    not null default now(),
    updated_at    timestamptz             default now(),
    constraint uq_daily_model_cost unique (summary_date, tenant_id, module_id, model_name)
);
create index ix_daily_model_cost_summary_date on daily_model_cost (summary_date);
create index ix_daily_model_cost_tenant_id    on daily_model_cost (tenant_id);
create index ix_daily_model_cost_module_id    on daily_model_cost (module_id);
create index ix_daily_model_cost_created_at   on daily_model_cost (created_at);


create table monthly_usage_summary (
    id                   serial         primary key,
    tenant_id            varchar(36)    not null,
    module_id            varchar(50),
    summary_date         date           not null,
    total_documents      integer        not null default 0,
    total_submissions    integer        not null default 0,
    total_llm_calls      integer        not null default 0,
    total_tokens         bigint         not null default 0,
    total_cost_usd       numeric(12, 4) not null default 0,
    avg_llm_latency_ms   float          not null default 0,
    total_api_calls      integer        not null default 0,
    avg_api_latency_ms   float          not null default 0,
    p95_api_latency_ms   float          not null default 0,
    total_errors         integer        not null default 0,
    total_corrections    integer        not null default 0,
    total_outbound_calls integer        not null default 0,
    created_at           timestamptz    not null default now(),
    updated_at           timestamptz             default now(),
    constraint uq_monthly_summary_scope unique (tenant_id, module_id, summary_date)
);
create index ix_monthly_usage_summary_tenant_id  on monthly_usage_summary (tenant_id);
create index ix_monthly_usage_summary_module_id  on monthly_usage_summary (module_id);
create index ix_monthly_usage_summary_date       on monthly_usage_summary (summary_date);
create index ix_monthly_usage_summary_created_at on monthly_usage_summary (created_at);


create table anomaly_alerts (
    id          bigserial     primary key,
    tenant_id   varchar(36)   not null,
    module_id   varchar(50),
    metric      varchar(50)   not null,
    severity    alertseverity not null default 'warn',
    threshold   numeric(14, 4),
    actual      numeric(14, 4),
    description text,
    resolved_at timestamptz,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz            default now()
);
create index ix_anomaly_alerts_tenant_id  on anomaly_alerts (tenant_id);
create index ix_anomaly_alerts_module_id  on anomaly_alerts (module_id);
create index ix_anomaly_alerts_metric     on anomaly_alerts (metric);
create index ix_anomaly_alerts_created_at on anomaly_alerts (created_at);


create table job_runs (
    id            bigserial   primary key,
    job_name      varchar(50) not null,
    tenant_id     varchar(36),
    status        jobstatus   not null default 'running',
    started_at    timestamptz not null,
    completed_at  timestamptz,
    rows_affected integer,
    error_message text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz          default now()
);
create index ix_job_runs_job_name   on job_runs (job_name);
create index ix_job_runs_tenant_id  on job_runs (tenant_id);
create index ix_job_runs_started_at on job_runs (started_at);
create index ix_job_runs_created_at on job_runs (created_at);
