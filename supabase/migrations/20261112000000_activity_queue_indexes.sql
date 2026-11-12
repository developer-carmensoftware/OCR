-- Two indexes for the JV queue's manual source (`services/credit_card/activity.py`).
--
-- Measured on the local DB at 20,000 rows (14k email / 4k manual / 2k PMS), EXPLAIN (ANALYZE)
-- against a control that had only been ANALYZEd — `scripts/qa/jv_filters_e2e.py explain`:
--
--                              before    after
--   manual list, whole log     8.3 ms    0.6 ms   (and no Seq Scan of email_documents)
--   manual counts, whole log   4.5 ms    2.6 ms
--   searches (ILIKE '%q%')     ~10 ms    ~10 ms   — the filter dominates; not what these are for
--
-- They are about growth, not today: the anti-join below sequentially scans ALL of
-- email_documents once per list request and once per counts request, so it costs what that
-- table weighs, and the table gains a row per attachment and is kept for two years.

-- The manual queue lists a card only if no email document owns its task:
--     NOT EXISTS (select 1 from email_documents where task_id = credit_cards.task_id)
-- email_documents.task_id was a foreign key with no index, so that probe was a hash anti-join
-- over a sequential scan. The same column is read by input_tax.py (tenant_id, task_id, posted)
-- and by the admin email list's LEFT JOIN. Partial: most rows are noise and never get a task.
create index if not exists ix_email_documents_task_id
    on email_documents (task_id)
    where task_id is not null;

-- The queue orders manual scans by when they happened: coalesce(submitted_at, created_at)
-- (`_manual_when`). An expression the planner cannot read off ix_credit_cards_tenant_id, so
-- it scanned the tenant's cards and sorted them. This matches the expression and the
-- `deleted_at IS NULL` predicate the query carries, character for character — change either
-- in activity.py and this index stops being used without any error.
create index if not exists ix_credit_cards_tenant_when
    on credit_cards (tenant_id, (coalesce(submitted_at, created_at)) desc)
    where deleted_at is null;

-- Tried and NOT added (same measurement, so the next person does not repeat it):
--   pms_events (tenant_id, created_at desc)  the existing single-column ix_pms_events_created_at
--       already serves the list (0.1 ms); the table holds one row per BU x PMS x day.
--   email_documents (tenant_id, created_at desc) include (status, reason_code)  for the chip
--       counts: the planner kept a sequential scan (4.4 ms) and the list did not need it.
-- Also found and left alone: the cron functions that log to job_runs lose their own failure
-- row (the handler's UPDATE targets a row the same rollback removed, then re-raises). Eight
-- live functions share the pattern and none has ever failed; fixing it means redefining all of
-- them or re-scheduling eight jobs, which is its own change.
