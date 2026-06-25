-- Monthly / annual subscriptions.
--
-- Adds a billing-period dimension and the machinery for "annual = same monthly
-- allowance, resets every month, license lasts a year, priced at 12mo - 10%":
--   1. credit_orders.billing_period       — what the buyer chose ('monthly'|'annual').
--   2. tenant_subscriptions.billing_period — carried onto the active window.
--   3. tenant_subscriptions.cycle_start    — start of the month-cycle the current
--      docs_used counter belongs to. Reset-on-access bumps it forward each month.
--   4. fn_cycle_start()                    — the ONLY copy of the month-cycle math,
--      reused by the consume UPDATE and the /usage read so they can't drift.
--
-- The license window itself now ends one day early (start + term - 1 day) so
-- consecutive periods tile without overlapping on the boundary — that change
-- lives in credit_service.activate_subscription(), not here.

alter table credit_orders
    add column if not exists billing_period varchar(10) not null default 'monthly';

alter table tenant_subscriptions
    add column if not exists billing_period varchar(10) not null default 'monthly';

alter table tenant_subscriptions
    add column if not exists cycle_start timestamptz;

-- Backfill: existing rows are monthly windows (<= one cycle), so the current
-- cycle is just the period start.
update tenant_subscriptions set cycle_start = period_start where cycle_start is null;


-- ── fn_cycle_start ────────────────────────────────────────────────────────────
-- Start of the monthly cycle containing p_now, anchored on p_start's day. Whole
-- months elapsed via age() (Postgres clamps Jan 31 -> Feb 28, fine for billing).
-- For a monthly window (< 1 month long) this always returns p_start → no reset;
-- for an annual window it steps forward on the same day each month.
create or replace function fn_cycle_start(p_start timestamptz, p_now timestamptz)
returns timestamptz
language sql
stable
as $$
    select p_start + (
        extract(year  from age(p_now, p_start))::int * 12
      + extract(month from age(p_now, p_start))::int
    ) * interval '1 month';
$$;
