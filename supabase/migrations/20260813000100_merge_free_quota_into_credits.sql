-- Fold the free-trial quota into the top-up credit balance.
--
-- Before: three pools charged a document — subscription allowance → free trial
-- (`quotas` LIFETIME/CALLS, limit 30) → top-up credits. The last two behave
-- identically (neither expires); they differed only in where they came from,
-- which is a ledger fact, not a reason for a second table.
--
-- After: two pools — subscription allowance → credits. Consumption order is
-- unchanged (the expiring pool is still charged first), so no tenant sees a
-- different number: what was `free_remaining + balance` on two screens is now
-- one balance.
--
-- Steps, in order:
--   1. unique index so a tenant can never be granted the signup credits twice
--   2. move each tenant's UNUSED free documents into their credit balance
--   3. retire the free-trial quota rules (soft delete — `quota_usage` history stays)
--
-- Reversible: step 3 by clearing deleted_by='migration_20260813', step 2 by
-- reversing the ledger rows noted 'migrated free trial'.
-- The `quotas` / `quota_usage` tables themselves are dropped in a later migration,
-- once this backfill has proven itself on prod.

-- 1 ─────────────────────────────────────────────────────────────────────────
create unique index if not exists uq_credit_ledger_one_signup_grant
    on credit_ledger (tenant_id)
    where reason = 'signup_grant';

-- 2 ─────────────────────────────────────────────────────────────────────────
-- A tenant with no quota row at all is legacy (created before the quota engine)
-- and is charged nothing today — coalesce(..., 30) gives them the same 30 free
-- documents everyone else gets rather than silently dropping them to zero.
-- The NOT EXISTS guard makes a re-run a no-op instead of a second grant.
with free_left as (
    select t.id                                                        as tenant_id,
           greatest(coalesce(q.limit_value - coalesce(u.used, 0), 30), 0)::int as remaining
    from tenants t
    left join quotas q
           on q.tenant_id = t.id
          and q.period     = 'lifetime'
          and q.metric     = 'calls'
          and q.deleted_at is null
    left join quota_usage u
           on u.quota_id   = q.id
          and u.period_key = 'free_trial'
    where t.deleted_at is null
      and not exists (
          select 1 from credit_ledger l
          where l.tenant_id = t.id and l.reason = 'signup_grant'
      )
),
granted as (
    insert into tenant_credits (tenant_id, balance, credits_purchased, credits_consumed)
    select tenant_id, remaining, 0, 0
    from free_left
    where remaining > 0
    on conflict (tenant_id) do update
        set balance    = tenant_credits.balance + excluded.balance,
            updated_at = now()
    returning tenant_id, balance
)
insert into credit_ledger (tenant_id, delta, balance_after, reason, note, created_by)
select g.tenant_id, f.remaining, g.balance, 'signup_grant', 'migrated free trial', 'migration_20260813'
from granted g
join free_left f on f.tenant_id = g.tenant_id;

-- 3 ─────────────────────────────────────────────────────────────────────────
update quotas
   set deleted_at = now(),
       deleted_by = 'migration_20260813'
 where period     = 'lifetime'
   and metric     = 'calls'
   and deleted_at is null;
