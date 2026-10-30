-- Filenames and error text kept for 12 months, the rows for good (decision-log #50).
--
-- A scan's filename can name a person or a vendor, and it was kept for ever in three places:
-- ocr_tasks.original_filename (+ its error_message), ap_invoices.original_filename, and
-- credit_ledger.ref — the filename the charge was made against (`consumption`/`refund` rows;
-- other reasons carry an order id or a note, and keep it).
--
-- Scrubbed, not deleted: the rows are the billing and usage history (SUM(charged_docs),
-- the ledger's amounts and balances, every admin count), and soft-delete-everywhere stands.
-- 12 months matches the log tables' retention (partman, 20260615000001). A scrubbed ledger
-- row is no longer found by the admin Credits page's search on its filename — accepted.
--
-- ocr_tasks.original_filename is NOT NULL, hence the 'scrubbed' marker there.

create or replace function fn_scrub_old_filenames() returns void as $$
    update ocr_tasks
       set original_filename = 'scrubbed',
           error_message     = null
     where created_at < now() - interval '12 months'
       and original_filename <> 'scrubbed';

    update ap_invoices
       set original_filename = null
     where created_at < now() - interval '12 months'
       and original_filename is not null;

    update credit_ledger
       set ref = null
     where reason in ('consumption', 'refund')
       and created_at < now() - interval '12 months'
       and ref is not null;
$$ language sql;

select cron.unschedule(jobname) from cron.job where jobname = 'scrub-old-filenames';

-- 04:20 UTC — after email-mailbox-purge (04:00), clear of the rest.
select cron.schedule('scrub-old-filenames', '20 4 * * *', $$select fn_scrub_old_filenames()$$);
