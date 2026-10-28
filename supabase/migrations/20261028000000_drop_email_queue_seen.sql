-- The review queue's amber dot is gone (07-human-in-the-loop.md §24, PR #313), and with it
-- the only reader and writer of this table: `POST /api/v1/credit-card/activity/seen` and the
-- `unseen` half of `GET /activity`.
--
-- Run only once the backend serving this database runs #313 or later. Older code reads this
-- table on every `GET /api/v1/credit-card/activity`, so dropping it under that code 500s the
-- queue page. That is why this is its own migration rather than part of #313.
--
-- Nothing of value goes with it: one row per BU of UI state (chip -> count already shown),
-- created by 20260902000000_email_queue_seen.sql and never business data.

drop table if exists email_queue_seen;
