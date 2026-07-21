-- Module Registry & Tenant Module assignments.
-- modules.id is a natural key (e.g. 'credit_card_ocr') used as FK everywhere.
-- tenant_modules: roadmap for per-tenant module enablement (not yet queried at runtime).

create table if not exists modules (
    id           varchar(50)  primary key,
    display_name varchar(100) not null,
    description  text,
    is_active    boolean      not null default true,
    sort_order   integer               default 0,
    created_at   timestamptz  not null default now(),
    updated_at   timestamptz           default now()
);

create index if not exists ix_modules_created_at on modules (created_at);


create table if not exists tenant_modules (
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

create index if not exists ix_tenant_modules_created_at on tenant_modules (created_at);
