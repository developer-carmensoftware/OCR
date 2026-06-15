-- API Keys (roadmap: external system auth, batch OCR API).
-- Not yet wired to any endpoint — kept as intentional infra.

create table if not exists api_keys (
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

create index if not exists ix_api_keys_key_prefix  on api_keys (key_prefix);
create index if not exists ix_api_keys_tenant_id   on api_keys (tenant_id);
create index if not exists ix_api_keys_expires_at  on api_keys (expires_at);
create index if not exists ix_api_keys_revoked_at  on api_keys (revoked_at);
create index if not exists ix_api_keys_created_at  on api_keys (created_at);

create unique index if not exists uq_api_key_hash_active
    on api_keys (key_hash)
    where revoked_at is null;


create table if not exists api_key_usage (
    api_key_id  uuid    not null references api_keys (id),
    usage_date  date    not null,
    calls       integer not null default 0,
    errors      integer not null default 0,
    tokens      bigint  not null default 0,
    cost_usd    numeric(12, 4) not null default 0,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz          default now(),
    primary key (api_key_id, usage_date)
);

create index if not exists ix_api_key_usage_created_at on api_key_usage (created_at);
