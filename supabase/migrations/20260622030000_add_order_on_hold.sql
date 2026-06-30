-- Add an 'on_hold' status to credit orders.
-- The admin can park an order (after contacting the buyer to confirm a slip)
-- instead of rejecting it outright. Resumable back to 'awaiting_review'.
--
-- Postgres can't add an enum value and USE it in the same transaction, so the
-- value is added here on its own; the open-order index that references it is
-- updated in the next migration (a separate transaction via the CLI).
alter type creditorderstatus add value if not exists 'on_hold';
