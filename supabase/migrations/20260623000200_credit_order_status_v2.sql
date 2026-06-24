-- Replace the 6-value creditorderstatus enum with 4 simplified workflow statuses.
-- Postgres can't remove enum values, so: create v2 → alter column → drop old → rename.

create type creditorderstatus_v2 as enum ('in_progress', 'paid', 'complete', 'void');

-- Drop default + indexes that reference old enum values — they block the type cast.
alter table credit_orders alter column status drop default;
drop index if exists uq_credit_orders_one_open_per_tenant;

alter table credit_orders
    alter column status type creditorderstatus_v2
    using (case status::text
        when 'pending'         then 'in_progress'
        when 'awaiting_review' then 'in_progress'
        when 'on_hold'         then 'in_progress'
        when 'paid'            then 'paid'
        when 'rejected'        then 'void'
        when 'cancelled'       then 'void'
    end)::creditorderstatus_v2;

alter table credit_orders alter column status set default 'in_progress';

drop type creditorderstatus;
alter type creditorderstatus_v2 rename to creditorderstatus;
