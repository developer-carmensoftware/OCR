-- A row nobody can act on, put away by hand.
--
-- The Review chip stops being one status and becomes "everything that wants a human":
-- documents parked for a decision, plus the failures a person can clear from settings
-- (FIXABLE_REASONS in routers/credit_card_activity.py -- no_rule_match, sender_not_allowed,
-- wrong_pdf_password, ingest_paused, ...). Those were filed under `unposted`, which
-- 07-human-in-the-loop.md ss12 itself calls the chip nobody works, and that is how eight
-- sender_not_allowed rows cost a day of diagnosis on 2026-08-28.
--
-- Moving them in creates a problem the same document already legislated against: "a number
-- on this page has to be able to go down". Nothing retries a failed document, so fixing the
-- filename rule today never clears the 46 no_rule_match rows behind it -- and the Review
-- chip would fill with dead rows until nobody could find the three live ones. This column
-- is the answer: one gesture, per row, and it leaves the chip.
--
-- Not a soft delete. The row keeps its story and keeps appearing under `unposted` and under
-- `today`; what it stops being is *work*. Nothing is destroyed, which is why there is no
-- confirmation on the button and no undo behind it.
--
-- Only rows with no review_payload are ever dismissible. A parked document already has the
-- audited verb for this -- Reject, which stamps the reviewer and takes a reason -- and two
-- ways to retire a real document, with different audit trails, is worse than one.

alter table email_documents
    add column if not exists dismissed_at timestamptz;

comment on column email_documents.dismissed_at is
    'When somebody in this BU put this row away. Set only on rows with no review_payload: '
    'a parked document is retired with Reject, which records who and why. Dismissed rows '
    'leave the Review chip and stay visible under Not posted and Today. Not a soft delete '
    '-- deleted_at does not exist on this table and this is not a substitute for it.';

-- Only the Review chip reads it, and only to exclude. Partial, because the dismissed rows
-- are the minority and the undismissed ones are what the chip is built from.
create index if not exists ix_email_documents_dismissed
    on email_documents (tenant_id, dismissed_at)
    where dismissed_at is not null;

-- Everything already terminal starts dismissed.
--
-- Without this the chip's first number after deploy is every historical failure the BU has
-- ever had -- 54 on the dev database -- and none of it is work anybody will do now. Nobody
-- fixes a filename rule for a signature logo from three weeks ago. Starting at the real
-- number is what makes the count mean something on day one, which is the whole reason the
-- column exists.
--
-- `posted` and `pending_review` are deliberately untouched: one is not in the chip and the
-- other is live work.
update email_documents
   set dismissed_at = now()
 where dismissed_at is null
   and status in ('failed', 'rejected', 'skipped');

-- And the dot's marks go with them.
--
-- email_queue_seen stores a per-chip high-water count, and this release moves anomalies
-- between chips: the fixable reasons leave `unposted` for `review`. A stored {"unposted":
-- 49} would then silence a chip whose real count is now near zero while `review` lights up
-- against a mark it never had. Clearing costs every BU one dot each, once.
delete from email_queue_seen;
