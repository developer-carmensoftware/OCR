-- Drop the retired quota counter engine.
--
-- `20260813000100_merge_free_quota_into_credits.sql` moved every tenant's remaining
-- free-trial allowance into `tenant_credits` and soft-deleted the quota rules, leaving
-- the tables in place for one release so the migration could be reversed against live
-- data. That release has shipped: nothing in the application reads `quotas` or
-- `quota_usage` (no ORM model, no raw SQL), and the surviving piece of that era —
-- `assert_module_enabled()` — lives in `services/module_gate.py` and touches neither
-- table.
--
-- Charging now runs entirely through `consume_document()`: subscription allowance
-- first, then `tenant_credits.balance`. See CLAUDE.md "Two document pools, not three".
--
-- `quota_usage` goes first: it carries the only FK into `quotas`.

drop table if exists quota_usage;
drop table if exists quotas;

-- Enums existed only for the two columns above.
drop type if exists quotaperiod;
drop type if exists quotametric;
