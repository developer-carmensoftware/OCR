-- Configuration, Feature Flags, GL Accounting Mappings, AP Vendor Mappings.

create table if not exists system_configs (
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

create index if not exists ix_system_configs_category   on system_configs (category);
create index if not exists ix_system_configs_created_at on system_configs (created_at);


-- Roadmap: per-tenant override of system_configs. Not yet queried at runtime.
create table if not exists tenant_config_overrides (
    tenant_id  uuid         not null references tenants (id),
    key_name   varchar(100) not null references system_configs (key_name),
    value      jsonb        not null,
    created_at timestamptz  not null default now(),
    updated_at timestamptz           default now(),
    created_by varchar(100),
    updated_by varchar(100),
    primary key (tenant_id, key_name)
);

create index if not exists ix_tenant_config_overrides_created_at on tenant_config_overrides (created_at);


-- Roadmap: gradual feature rollout + per-tenant toggles. Not yet queried at runtime.
create table if not exists feature_flags (
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

create index if not exists ix_feature_flags_created_at on feature_flags (created_at);


-- GL accounting config per tenant for the credit card OCR workflow.
create table if not exists bu_accounting_configs (
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

create index if not exists ix_bu_accounting_configs_tenant_id   on bu_accounting_configs (tenant_id);
create index if not exists ix_bu_accounting_configs_bank_code   on bu_accounting_configs (bank_code);
create index if not exists ix_bu_accounting_configs_created_at  on bu_accounting_configs (created_at);
create index if not exists ix_bu_accounting_configs_deleted_at  on bu_accounting_configs (deleted_at);

-- One active config per tenant.
create unique index if not exists uq_bu_accounting_config_active
    on bu_accounting_configs (tenant_id)
    where deleted_at is null;


create table if not exists bu_accounting_mapping_entries (
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

create index if not exists ix_bu_accounting_mapping_entries_config_id   on bu_accounting_mapping_entries (config_id);
create index if not exists ix_bu_accounting_mapping_entries_dept_code   on bu_accounting_mapping_entries (dept_code);
create index if not exists ix_bu_accounting_mapping_entries_acc_code    on bu_accounting_mapping_entries (acc_code);
create index if not exists ix_bu_accounting_mapping_entries_created_at  on bu_accounting_mapping_entries (created_at);
create index if not exists ix_bu_accounting_mapping_entries_deleted_at  on bu_accounting_mapping_entries (deleted_at);

create unique index if not exists uq_bu_mapping_entry_active
    on bu_accounting_mapping_entries (config_id, field_type)
    where deleted_at is null;


-- AP invoice vendor column-to-field mapping config.
create table if not exists ap_vendor_column_mappings (
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

create index if not exists ix_ap_vendor_column_mappings_tenant_id    on ap_vendor_column_mappings (tenant_id);
create index if not exists ix_ap_vendor_column_mappings_vendor_tax_id on ap_vendor_column_mappings (vendor_tax_id);
create index if not exists ix_ap_vendor_column_mappings_created_at   on ap_vendor_column_mappings (created_at);
create index if not exists ix_ap_vendor_column_mappings_deleted_at   on ap_vendor_column_mappings (deleted_at);

create unique index if not exists uq_ap_vendor_mapping_active
    on ap_vendor_column_mappings (tenant_id, vendor_tax_id)
    where deleted_at is null;


create table if not exists ap_vendor_field_mapping_entries (
    id          serial       primary key,
    mapping_id  integer      not null references ap_vendor_column_mappings (id),
    column_name varchar(255) not null,
    field_name  varchar(100) not null,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz           default now(),
    deleted_at  timestamptz,
    deleted_by  varchar(100)
);

create index if not exists ix_ap_vendor_field_mapping_entries_mapping_id  on ap_vendor_field_mapping_entries (mapping_id);
create index if not exists ix_ap_vendor_field_mapping_entries_field_name  on ap_vendor_field_mapping_entries (field_name);
create index if not exists ix_ap_vendor_field_mapping_entries_created_at  on ap_vendor_field_mapping_entries (created_at);
create index if not exists ix_ap_vendor_field_mapping_entries_deleted_at  on ap_vendor_field_mapping_entries (deleted_at);

create unique index if not exists uq_ap_vendor_entry_active
    on ap_vendor_field_mapping_entries (mapping_id, column_name)
    where deleted_at is null;
