-- Data Plane: OCR sessions, tasks, extracted documents, corrections, mappings, bug reports.
-- All tables use tenant_id FK (TenantFKMixin) and soft delete (SoftDeleteMixin).

do $$ begin
    create type taskstatus as enum ('pending', 'processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;


create table if not exists ocr_sessions (
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

create index if not exists ix_ocr_sessions_tenant_id     on ocr_sessions (tenant_id);
create index if not exists ix_ocr_sessions_carmen_user   on ocr_sessions (carmen_user_id);
create index if not exists ix_ocr_sessions_created_at    on ocr_sessions (created_at);
create index if not exists ix_ocr_sessions_deleted_at    on ocr_sessions (deleted_at);

-- Fast active-session lookup per tenant + user.
create index if not exists ix_ocr_sessions_active
    on ocr_sessions (tenant_id, carmen_user_id)
    where is_active = true and deleted_at is null;


create table if not exists ocr_tasks (
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

create index if not exists ix_ocr_tasks_tenant_id     on ocr_tasks (tenant_id);
create index if not exists ix_ocr_tasks_module_id     on ocr_tasks (module_id);
create index if not exists ix_ocr_tasks_carmen_user   on ocr_tasks (carmen_user_id);
create index if not exists ix_ocr_tasks_created_at    on ocr_tasks (created_at);
create index if not exists ix_ocr_tasks_deleted_at    on ocr_tasks (deleted_at);


create table if not exists credit_cards (
    id               uuid         primary key default gen_random_uuid(),
    tenant_id        uuid         not null references tenants (id),
    task_id          uuid         not null references ocr_tasks (id),
    bank_code        varchar(20)  references banks (code),
    company_name     varchar(255),
    bank_company_name varchar(255),
    doc_date         date,
    doc_no           varchar(100),
    branch_no        varchar(50),
    submitted_at     timestamptz,
    carmen_user_id   varchar(36),
    created_at       timestamptz  not null default now(),
    updated_at       timestamptz           default now(),
    deleted_at       timestamptz,
    deleted_by       varchar(100),
    created_by       varchar(100),
    updated_by       varchar(100)
);

create index if not exists ix_credit_cards_tenant_id    on credit_cards (tenant_id);
create index if not exists ix_credit_cards_task_id      on credit_cards (task_id);
create index if not exists ix_credit_cards_bank_code    on credit_cards (bank_code);
create index if not exists ix_credit_cards_doc_date     on credit_cards (doc_date);
create index if not exists ix_credit_cards_doc_no       on credit_cards (doc_no);
create index if not exists ix_credit_cards_carmen_user  on credit_cards (carmen_user_id);
create index if not exists ix_credit_cards_created_at   on credit_cards (created_at);
create index if not exists ix_credit_cards_deleted_at   on credit_cards (deleted_at);

-- Duplicate-check: same doc_no per bank per tenant must not be submitted twice.
create unique index if not exists uq_credit_card_no_dup
    on credit_cards (tenant_id, bank_code, doc_no)
    where submitted_at is not null and deleted_at is null;


create table if not exists ap_invoices (
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

create index if not exists ix_ap_invoices_tenant_id    on ap_invoices (tenant_id);
create index if not exists ix_ap_invoices_task_id      on ap_invoices (task_id);
create index if not exists ix_ap_invoices_doc_date     on ap_invoices (doc_date);
create index if not exists ix_ap_invoices_carmen_user  on ap_invoices (carmen_user_id);
create index if not exists ix_ap_invoices_created_at   on ap_invoices (created_at);
create index if not exists ix_ap_invoices_deleted_at   on ap_invoices (deleted_at);


create table if not exists correction_feedback (
    id               serial       primary key,
    tenant_id        uuid         not null references tenants (id),
    doc_no           varchar(100) not null,
    bank_code        varchar(20)  not null references banks (code),
    field_name       varchar(100) not null,
    original_value   text,
    corrected_value  text,
    carmen_user_id   varchar(36),
    -- pgvector: additive enhancement for semantic matching (optional, nullable).
    -- See migration 20260615000006_pgvector_corrections.sql.
    -- value_embedding extensions.vector(1536),
    created_at       timestamptz  not null default now(),
    updated_at       timestamptz           default now(),
    deleted_at       timestamptz,
    deleted_by       varchar(100),
    created_by       varchar(100),
    updated_by       varchar(100)
);

create index if not exists ix_correction_feedback_tenant_id    on correction_feedback (tenant_id);
create index if not exists ix_correction_feedback_doc_no       on correction_feedback (doc_no);
create index if not exists ix_correction_feedback_bank_code    on correction_feedback (bank_code);
create index if not exists ix_correction_feedback_field_name   on correction_feedback (field_name);
create index if not exists ix_correction_feedback_carmen_user  on correction_feedback (carmen_user_id);
create index if not exists ix_correction_feedback_created_at   on correction_feedback (created_at);
create index if not exists ix_correction_feedback_deleted_at   on correction_feedback (deleted_at);

-- One active correction per (tenant, doc_no, field_name) — latest correction wins.
create unique index if not exists uq_correction_scope_active
    on correction_feedback (tenant_id, doc_no, field_name)
    where deleted_at is null;


create table if not exists bug_reports (
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

create index if not exists ix_bug_reports_tenant_id    on bug_reports (tenant_id);
create index if not exists ix_bug_reports_module_id    on bug_reports (module_id);
create index if not exists ix_bug_reports_status       on bug_reports (status);
create index if not exists ix_bug_reports_carmen_user  on bug_reports (carmen_user_id);
create index if not exists ix_bug_reports_created_at   on bug_reports (created_at);
create index if not exists ix_bug_reports_deleted_at   on bug_reports (deleted_at);


-- Server-side consent record (PDPA ม.19 — proof of who consented, when, which version).
-- Append-only legal evidence: NO soft-delete, NO retention purge. Org-level consent
-- (one meaningful row per tenant+version), keyed to match the frontend's tenant-scoped
-- consent gate (useUserConsent.ts). Multiple rows per (tenant, version) are allowed —
-- history is evidence, not a bug — so this is a plain index, not a unique constraint.
--
-- Mirrors migration 20260713010000_consent_logs.sql. It MUST stay declared here: this
-- is not a partitioned log table, so it is not covered by the db-diff exclusions in
-- config.toml, and an undeclared table makes `supabase db diff` propose DROP TABLE on
-- the one table that exists to be legal evidence.
create table if not exists consent_logs (
    id              bigint generated always as identity primary key,
    tenant_id       uuid        not null references tenants (id),
    carmen_user_id  varchar(36),
    consent_version varchar(20) not null,
    ip_address      varchar(45),
    user_agent      varchar(400),
    created_at      timestamptz not null default now()
);

create index if not exists ix_consent_logs_tenant_version
    on consent_logs (tenant_id, consent_version);
