-- PMS days post through Carmen's own PMS engine (decision-log #43, CA-119 path B).
--
-- Carmen's per-PMS config decides the file layout, debit/credit and the counter account, and
-- Carmen's engine (`interfacePostGL`) posts a Data Bank day by it. What each PMS row posts to
-- lives in Carmen's mapping table, edited by Carmen's own screen and by our review's Approve.
-- So the copies this app kept are gone:
--
--   * pms_code_mappings — our own mapping, keyed on keys we invented (`Revenue|100`, `VAT|*`);
--   * pms_settings.jv_prefix — the prefix is the setting's `JvType` in Carmen.
--
-- And every day not yet posted is read again by the new pipeline: their review_payload has
-- the old shape (rows signed by our rule), which the new review cannot show.
--
-- ORDER: deploy the code first, then `supabase db push`. The old code reads both of these.

drop table if exists pms_code_mappings;

alter table pms_settings drop column if exists jv_prefix;

update pms_events
   set status = 'received',
       attempts = 0,
       processed_at = null,
       posting_started_at = null,
       review_payload = null,
       reason_code = null,
       error_message = null
 where status in ('pending_review', 'failed');
