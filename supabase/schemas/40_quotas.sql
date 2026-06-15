-- Quota rules and usage counters.
-- consume_quota() increments quota_usage atomically on every extraction.

do $$ begin
    create type quotaperiod as enum ('daily', 'monthly', 'yearly', 'lifetime');
exception when duplicate_object then null; end $$;

do $$ begin
    create type quotametric as enum ('calls', 'tokens', 'cost_usd', 'documents');
exception when duplicate_object then null; end $$;


create table if not exists quotas (
    id            uuid         primary key default gen_random_uuid(),
    tenant_id     uuid         not null references tenants (id),
    period        quotaperiod  not null,
    metric        quotametric  not null,
    limit_value   numeric(18, 4) not null,
    soft_warn_pct numeric(3, 2)  not null default 0.80,
    is_hard       boolean      not null default true,
    is_custom     boolean      not null default false,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz           default now(),
    deleted_at    timestamptz,
    deleted_by    varchar(100),
    created_by    varchar(100),
    updated_by    varchar(100)
);

create index if not exists ix_quotas_tenant_id   on quotas (tenant_id);
create index if not exists ix_quotas_created_at  on quotas (created_at);
create index if not exists ix_quotas_deleted_at  on quotas (deleted_at);

-- One active quota per (tenant, period, metric).
create unique index if not exists uq_quota_tenant_period_metric_active
    on quotas (tenant_id, period, metric)
    where deleted_at is null;


create table if not exists quota_usage (
    -- Hot path: atomic upsert on every document extraction.
    -- PK is the lookup key — no extra index needed.
    quota_id        uuid         not null references quotas (id),
    period_key      varchar(10)  not null,  -- 'free_trial' | 'YYYY-MM' | 'YYYY-MM-DD'
    used            numeric(18, 4) not null default 0,
    last_updated_at timestamptz  not null default now(),
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz           default now(),
    primary key (quota_id, period_key)
);

create index if not exists ix_quota_usage_created_at on quota_usage (created_at);
