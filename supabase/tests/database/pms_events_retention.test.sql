-- fn_scrub_old_pms_events (20261118000000_pms_events_retention.sql, decision-log #63): a day's
-- reviewer and error text go 90 days after the row last changed; the row, its status and its JV stay,
-- and a day still waiting on a person is never touched.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into tenants (id, host, bu_code, name, plan, is_active, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000e063', 'retention.test', 'ret', 'Retention test', 'free', true, now(), now());

insert into pms_events (tenant_id, event_id, type, payload, status, jv_no, reason_code, error_message,
                        reviewed_by, reviewed_by_name, created_at, updated_at)
values
    ('00000000-0000-0000-0000-00000000e063', 'PMS/Test/Daily/old-posted', 'pms', '{}', 'posted', '1704', null,
     null, 'u-1', 'A Reviewer', now() - interval '120 days', now() - interval '100 days'),
    ('00000000-0000-0000-0000-00000000e063', 'PMS/Test/Daily/old-rejected', 'pms', '{}', 'rejected', null,
     'rejected_by_user', 'typed by the reviewer', 'u-1', 'A Reviewer', now() - interval '120 days', null),
    ('00000000-0000-0000-0000-00000000e063', 'PMS/Test/Daily/old-pending', 'pms', '{}', 'pending_review', null,
     null, 'a reason', 'u-1', 'A Reviewer', now() - interval '120 days', now() - interval '100 days'),
    ('00000000-0000-0000-0000-00000000e063', 'PMS/Test/Daily/recent', 'pms', '{}', 'posted', '1705', null,
     null, 'u-2', 'B Reviewer', now() - interval '20 days', now() - interval '10 days');

select fn_scrub_old_pms_events();

select is(
    (select reviewed_by_name from pms_events where event_id = 'PMS/Test/Daily/old-posted'),
    null, 'an old posted day loses its reviewer''s name');
select is(
    (select reviewed_by from pms_events where event_id = 'PMS/Test/Daily/old-posted'),
    null, 'and the reviewer''s id');
select is(
    (select status || ' ' || jv_no from pms_events where event_id = 'PMS/Test/Daily/old-posted'),
    'posted 1704', 'but keeps its status and JV');
select is(
    (select coalesce(error_message, '-') || ' ' || reason_code from pms_events where event_id = 'PMS/Test/Daily/old-rejected'),
    '- rejected_by_user', 'an old rejected day loses the typed reason and keeps its reason code (updated_at null falls back to created_at)');
select is(
    (select reviewed_by_name || ' ' || error_message from pms_events where event_id = 'PMS/Test/Daily/old-pending'),
    'A Reviewer a reason', 'a day still pending review is never touched, however old');
select is(
    (select reviewed_by_name from pms_events where event_id = 'PMS/Test/Daily/recent'),
    'B Reviewer', 'a day decided 10 days ago keeps its reviewer');
select is(
    (select updated_at::date from pms_events where event_id = 'PMS/Test/Daily/old-posted'),
    (now() - interval '100 days')::date, 'the scrub does not move updated_at');
select is(
    (select count(*)::int from cron.job where jobname = 'pms-events-scrub'),
    1, 'the scrub is scheduled once');

select * from finish();
rollback;
