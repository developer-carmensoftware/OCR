-- Detailed Credit Card AR Reconciliation (Phase 1) — FRD v1.1.
--
-- Reads KBANK's merchant settlement report (KB1P554V2) and posts a JV that clears the
-- lump credit-card control account into per-scheme receivables. The FRD specifies MySQL
-- tables under Carmen's schema (carmen_bank_profile_settings / carmen_ar_reconcile_mapping
-- / carmen_ar_ingestion_logs, keyed by property_id, writing gl_jv_* directly). This app
-- cannot write gl_jv_* — it posts through Carmen's /gljv endpoint — so the two settings
-- tables are re-homed here keyed by tenant_id, and the ingestion log is dropped: it would
-- duplicate email_documents and ocr_tasks, which already record every read and its outcome.


create table ar_reconcile_settings (
    id                      serial       primary key,
    tenant_id               uuid         not null references tenants (id),
    bank_code               varchar(20)  not null references banks (code),
    enabled                 boolean      not null default false,
    post_type               varchar(10)  not null default 'Detail',
    jv_description_template varchar(255) not null default 'Credit Card AR Reconcile {Settlement_Date}',
    debit_dept_code         varchar(100),
    debit_account_code      varchar(100),
    created_at              timestamptz  not null default now(),
    updated_at              timestamptz           default now(),
    deleted_at              timestamptz,
    deleted_by              varchar(100),
    created_by              varchar(100),
    updated_by              varchar(100)
);
create index ix_ar_reconcile_settings_tenant_id  on ar_reconcile_settings (tenant_id);
create index ix_ar_reconcile_settings_bank_code  on ar_reconcile_settings (bank_code);
create index ix_ar_reconcile_settings_created_at on ar_reconcile_settings (created_at);
create index ix_ar_reconcile_settings_deleted_at on ar_reconcile_settings (deleted_at);
create unique index uq_ar_reconcile_setting_active
    on ar_reconcile_settings (tenant_id, bank_code) where deleted_at is null;


-- post_type is part of the key on purpose: Detail and Summary are two vocabularies over
-- the same document ("VS INTER UP PREM" vs "VS"), each with its own accounts.
create table ar_reconcile_mappings (
    id                  serial       primary key,
    setting_id          integer      not null references ar_reconcile_settings (id),
    post_type           varchar(10)  not null,
    payment_type_code   varchar(100) not null,
    payment_type_desc   varchar(255),
    credit_dept_code    varchar(100),
    credit_account_code varchar(100),
    is_active           boolean      not null default true,
    created_at          timestamptz  not null default now(),
    updated_at          timestamptz           default now(),
    deleted_at          timestamptz,
    deleted_by          varchar(100)
);
create index ix_ar_reconcile_mappings_setting_id  on ar_reconcile_mappings (setting_id);
create index ix_ar_reconcile_mappings_dept_code   on ar_reconcile_mappings (credit_dept_code);
create index ix_ar_reconcile_mappings_acc_code    on ar_reconcile_mappings (credit_account_code);
create index ix_ar_reconcile_mappings_created_at  on ar_reconcile_mappings (created_at);
create index ix_ar_reconcile_mappings_deleted_at  on ar_reconcile_mappings (deleted_at);
create unique index uq_ar_reconcile_mapping_active
    on ar_reconcile_mappings (setting_id, post_type, payment_type_code) where deleted_at is null;


-- Its own module so #/admin/quota-modules can switch it per BU during the pilot and
-- daily_usage_summary reports its LLM cost apart from the credit-card wizard's.
insert into modules (id, display_name, description, is_active, sort_order, created_at)
values ('cc_ar_reconcile',
        'Credit Card AR Reconcile',
        'KBANK settlement report → per-scheme AR reclassification JV',
        true, 3, now())
on conflict (id) do nothing;
