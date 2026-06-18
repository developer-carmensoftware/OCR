-- Widen the open-order guard from per-(tenant, pack) to per-tenant.
-- A tenant may now hold only ONE pending/awaiting_review order at a time,
-- matching the application-level pre-check in create_order.
drop index if exists uq_credit_orders_one_open_per_pack;

create unique index if not exists uq_credit_orders_one_open_per_tenant
    on credit_orders (tenant_id)
    where status in ('pending', 'awaiting_review') and deleted_at is null;
