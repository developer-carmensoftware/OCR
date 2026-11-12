-- A cron function that fails must leave a `failed` row in job_runs
-- (20261112010000_job_runs_failure_record.sql). Before that migration the handler updated a row the
-- same rollback had removed, then re-raised, so a failing job left nothing on #/admin/jobs.
--
-- Each function is made to fail by renaming a table it reads, inside this test's transaction (the
-- rollback at the end puts everything back), then called. The call must RETURN (-1) rather than raise,
-- and the failed row must carry the error text.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create temp table _cases (fn text, job text, tbl text) on commit drop;
insert into _cases values
    ('fn_build_daily_model_cost',      'daily-model-cost',    'llm_usage_logs'),
    ('fn_build_daily_summary',         'daily-summary',       'ocr_tasks'),
    ('fn_build_monthly_summary',       'monthly-summary',     'daily_usage_summary'),
    ('fn_hold_expired_orders',         'hold-expired-orders', 'credit_orders'),
    ('fn_lapse_expired_subscriptions', 'lapse-subscriptions', 'tenant_subscriptions'),
    ('fn_purge_inactive_sessions',     'session-purge',       'ocr_sessions');

-- The success path is unchanged: a normal run records `success`, not `failed`.
select is(fn_purge_inactive_sessions() >= 0, true, 'session-purge succeeds on a healthy database');
select is(
    (select status::text from job_runs where job_name = 'session-purge' order by id desc limit 1),
    'success', 'and records a success row');

do $$
declare c record; r int;
begin
    for c in select * from _cases loop
        execute format('alter table %I rename to %I', c.tbl, c.tbl || '__broken');
        execute format('select %I()', c.fn) into r;
        execute format('alter table %I rename to %I', c.tbl || '__broken', c.tbl);
        create temp table if not exists _got (fn text, ret int);
        insert into _got values (c.fn, r);
    end loop;
end $$;

-- Returned instead of raising: all six reached this line, each answering -1.
select is((select count(*)::int from _got where ret = -1), 6, 'every function returns -1 instead of raising');

select is((select status::text from job_runs where job_name = 'daily-model-cost'    order by id desc limit 1), 'failed', 'daily-model-cost leaves a failed row');
select is((select status::text from job_runs where job_name = 'daily-summary'       order by id desc limit 1), 'failed', 'daily-summary leaves a failed row');
select is((select status::text from job_runs where job_name = 'monthly-summary'     order by id desc limit 1), 'failed', 'monthly-summary leaves a failed row');
select is((select status::text from job_runs where job_name = 'hold-expired-orders' order by id desc limit 1), 'failed', 'hold-expired-orders leaves a failed row');
select is((select status::text from job_runs where job_name = 'lapse-subscriptions' order by id desc limit 1), 'failed', 'lapse-subscriptions leaves a failed row');
select is((select status::text from job_runs where job_name = 'session-purge'       order by id desc limit 1), 'failed', 'session-purge leaves a failed row (after its earlier success)');

select is(
    (select count(*)::int from job_runs
      where status = 'failed'::jobstatus and error_message is not null and length(error_message) > 0
        and job_name in (select job from _cases)),
    6, 'each failed row carries the error text');

select is(
    (select count(*)::int from job_runs where status = 'running'::jobstatus and job_name in (select job from _cases)),
    0, 'no row is left stuck on running');

select is(
    (select count(*)::int from job_runs where status = 'failed'::jobstatus and completed_at is not null
        and job_name in (select job from _cases)),
    6, 'each failed row has a completion time');

select is(
    (select error_message like '%ocr_sessions%' from job_runs where job_name = 'session-purge' and status = 'failed'::jobstatus order by id desc limit 1),
    true, 'the error names what broke');

-- Every function that still inserts into job_runs is covered above: this finds one the list missed
-- (fn_cancel_expired_orders was dropped by 20260701071021, so it is not in it).
select is(
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'fn\_%' and p.prosrc ilike '%insert into job_runs%'
        and p.proname not in (select fn from _cases)),
    0, 'no other public function inserts into job_runs');

select * from finish();
rollback;
