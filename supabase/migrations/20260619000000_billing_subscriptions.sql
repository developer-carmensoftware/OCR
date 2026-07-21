-- Subscription-cycle model + proforma expiry.
--
-- Today every order (subscription OR top-up) is fulfilled identically as a
-- non-expiring credit top-up. This migration adds:
--   1. credit_orders.expires_at  — proforma valid-until, enforced server-side
--      (the 14-day window was previously computed only in the browser).
--   2. tenant_subscriptions      — the missing billing cycle: a one-month,
--      use-it-or-lose-it document allowance anchored on the approval date.
-- The cron jobs that enforce these live in the next migration.

-- ── 1. Order expiry ───────────────────────────────────────────────────────────
alter table credit_orders add column if not exists expires_at timestamptz;

-- Backfill open orders so the auto-cancel job has a deadline to compare against.
update credit_orders
   set expires_at = created_at + interval '14 days'
 where expires_at is null and status = 'pending' and deleted_at is null;


-- ── 2. Subscription cycle ─────────────────────────────────────────────────────
-- Status is an extensible enum: 'scheduled' is reserved for a future "queued
-- renewal" policy (Option B) — add it later via `alter type ... add value`.
do $$ begin create type subscriptionstatus as enum ('active', 'lapsed', 'superseded');
exception when duplicate_object then null; end $$;

create table if not exists tenant_subscriptions (
    id              uuid               primary key default gen_random_uuid(),
    tenant_id       uuid               not null references tenants (id),
    plan_code       varchar(20)        not null references credit_packs (code),
    doc_allowance   integer            not null,
    docs_used       integer            not null default 0,
    period_start    timestamptz        not null,
    period_end      timestamptz        not null,
    status          subscriptionstatus not null default 'active',
    source_order_id uuid               references credit_orders (id),
    created_at      timestamptz        not null default now(),
    updated_at      timestamptz                     default now()
);

create index if not exists ix_tenant_subscriptions_tenant on tenant_subscriptions (tenant_id);
-- "Current subscription" lookups and the consume gate are window-based
-- (period_start <= now() < period_end), so this composite index covers them.
create index if not exists ix_tenant_subscriptions_window
    on tenant_subscriptions (tenant_id, status, period_end);

-- One active subscription per tenant. Option A (renew-only-after-lapse)
-- guarantees this; relaxing the index is the only schema change Option B needs.
create unique index if not exists uq_tenant_subscriptions_one_active
    on tenant_subscriptions (tenant_id)
    where status = 'active';
