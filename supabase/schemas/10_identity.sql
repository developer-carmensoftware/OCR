-- Identity & Multi-tenancy: plans, tenants
-- Tenant = one (Carmen ERP host, business unit) pair.

create table if not exists plans (
    code                varchar(20)  primary key,
    display_name        varchar(100) not null,
    monthly_call_limit  integer      not null,
    is_active           boolean      not null default true,
    created_at          timestamptz  not null default now(),
    updated_at          timestamptz           default now(),
    created_by          varchar(100),
    updated_by          varchar(100)
);

create index if not exists ix_plans_created_at on plans (created_at);


create table if not exists tenants (
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

create index if not exists ix_tenants_host       on tenants (host);
create index if not exists ix_tenants_created_at on tenants (created_at);
create index if not exists ix_tenants_deleted_at on tenants (deleted_at);

-- Only one active tenant per (host, bu_code) pair.
create unique index if not exists uq_tenants_host_bu_active
    on tenants (host, bu_code)
    where deleted_at is null;
