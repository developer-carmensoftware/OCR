-- What a task actually cost, in documents.
--
-- Until AP invoice moved to per-page charging, one task was always one document, so
-- COUNT(ocr_tasks) *was* consumption and nothing had to be stored. It no longer is: a
-- 3-page AP selection is one task and three documents. Neither existing record can
-- answer "what did this task cost" —
--   * a subscription-funded scan writes no per-scan row at all (only
--     tenant_subscriptions.docs_used += N), and
--   * a credit-funded scan writes credit_ledger with `ref` = the FILENAME, not the task
--     id (the charge happens before create_task, so the id does not exist yet).
--
-- default 1 makes every historical row correct as it stands — they each cost exactly
-- one — so there is no backfill.
alter table ocr_tasks
    add column charged_docs smallint not null default 1;

comment on column ocr_tasks.charged_docs is
    'Documents consumed by this task (AP invoice = pages sent to the LLM, credit card = 1). '
    '0 when consume_document failed open and nothing was charged. '
    'Net of refunds: sum where status <> ''failed'' — a failed task is always refunded.';
