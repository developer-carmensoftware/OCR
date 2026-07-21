create table user_notifications (
    id         uuid primary key default gen_random_uuid(),
    tenant_id  uuid not null references tenants(id),
    order_id   uuid references credit_orders(id),
    -- varchar, NOT enum — deliberate (project was burned by enum migrations 20260701070739/071021)
    type       varchar(32) not null,
    payload    jsonb not null default '{}',
    read_at    timestamptz,
    created_at timestamptz not null default now()
);

create index ix_user_notifications_tenant_created
    on user_notifications (tenant_id, created_at desc);
