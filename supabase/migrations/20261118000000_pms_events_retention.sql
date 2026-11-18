-- Who reviewed a PMS day, and the words on it, kept for 90 days; the day's row for good
-- (decision-log #63).
--
-- pms_events had no retention: a day kept its reviewer (reviewed_by, reviewed_by_name) and its
-- error_message for ever, and on a rejected day that is the reason the reviewer typed, free text.
-- review_payload needs nothing here: it is cleared on every terminal transition already, and the
-- hook payload carries no person (InterfaceType/Name, DocType, DocDate).
--
-- Same window as the email ledger (20260923000000_email_documents_retention.sql), because the two
-- sit side by side in one queue: scrubbed 90 days after the row last changed, pending_review never
-- touched (charged or not, it waits on a person). Unlike that ledger, no row is deleted: one row
-- per BU × PMS × day is small, it is what says the day was posted, and its event_id is what turns a
-- late repeat hook for that day into a duplicate instead of a second processing.
--
-- Keyed on updated_at so a day approved late is not scrubbed the day after its decision. No trigger
-- maintains updated_at (the ORM's onupdate does), so this UPDATE does not move it. coalesce()
-- because the column is nullable.

create or replace function fn_scrub_old_pms_events() returns void as $$
    update pms_events
       set reviewed_by      = null,
           reviewed_by_name = null,
           error_message    = null
     where status <> 'pending_review'
       and coalesce(updated_at, created_at) < now() - interval '90 days'
       and (reviewed_by is not null or reviewed_by_name is not null or error_message is not null);
$$ language sql;

select cron.unschedule(jobname) from cron.job where jobname = 'pms-events-scrub';

-- 03:55 UTC — after email-documents-purge (03:50), before email-mailbox-purge (04:00).
select cron.schedule('pms-events-scrub', '55 3 * * *', $$select fn_scrub_old_pms_events()$$);
