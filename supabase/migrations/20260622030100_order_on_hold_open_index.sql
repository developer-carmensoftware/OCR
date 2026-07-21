-- Follow-up to 20260622030000 (which added the 'on_hold' enum value).
--
-- 1. A held order still has a slip and is "open", so it must keep blocking a
--    second open order per tenant. Recreate the partial unique index to include
--    'on_hold' (mirrors 20260618120000_tenant_single_open_order.sql).
drop index if exists uq_credit_orders_one_open_per_tenant;
create unique index if not exists uq_credit_orders_one_open_per_tenant
    on credit_orders (tenant_id)
    where status in ('pending', 'awaiting_review', 'on_hold') and deleted_at is null;

-- 2. Admin-only memo recorded when an order is put on hold (never shown to the buyer).
alter table credit_orders add column if not exists admin_note text;
