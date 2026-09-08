-- What the review queue's amber dot has already been shown to somebody.
--
-- The dot on #/CreditCardOCR's filter chips means "something under here is wrong". Nothing
-- retries a failed document (`ponytail: single pass, no retry` in email_ingest_service.py)
-- and the mail is already \Seen, so a failed row is terminal: fixing the filename rule
-- today never clears the 46 no_rule_match rows behind it. Drawn from a lifetime count the
-- dot is lit for good, and a warning that never goes out is one nobody reads by the day
-- something new breaks.
--
-- So a mark. One row per BU, mapping chip name -> the anomaly count already acknowledged;
-- the dot shows when today's count is higher. Three designs were tried first and the
-- reasons they failed are the reason this table looks like it does:
--
--   1. A per-browser mark in localStorage. clearAppStorage() fires on session *expiry*,
--      not just logout, and sessions here die on a 30-minute clock — the mark would be
--      wiped several times a day. A read receipt is also the wrong model for a queue a
--      whole BU shares: one person looking is what clears it, for everybody.
--
--   2. A timestamp compared against max(created_at). created_at is when the document
--      ARRIVED, not when it became anomalous. A document that parks on Monday, gets a mark
--      set on Tuesday and is rejected on Wednesday still carries Monday — so the dot would
--      never come back. Same for a JV that posts without its input-tax record days after
--      arrival. A count is evaluated at read time and has no such hole.
--
--   3. A column on email_ingest_settings, which already has the one row per BU. That row
--      is booby trapped: tags_awaiting_confirmation() gates a PER-MINUTE IMAP sweep on
--      updated_at, and WriterMixin's before_update listener stamps updated_by on any ORM
--      write. Storing the mark there would drag a BU back into a per-minute mailbox
--      connection because somebody clicked a filter chip, and rewrite "who last changed
--      this BU's email settings" to "who last opened a chip". A Core UPDATE dodges both
--      and nothing enforces that it keeps being used.
--
-- Not business data: it is one page's state, it holds nothing a person typed, and losing
-- it costs one extra dot. Hence no soft delete, no writer columns, and an FK that goes
-- with the tenant.

create table if not exists email_queue_seen (
    tenant_id  uuid primary key references tenants(id),
    seen       jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz default now()
);

comment on table email_queue_seen is
    'Per-BU acknowledgement of the review queue''s attention dot. One row per tenant, '
    'created the first time somebody opens a chip that is holding something wrong.';

comment on column email_queue_seen.seen is
    'Chip name -> the anomaly count already shown to somebody in this BU, e.g. '
    '{"unposted": 49}. The dot shows while the live count is higher. A high-water mark, '
    'not a timestamp: a document can become anomalous long after it arrived (parked on '
    'Monday, rejected on Wednesday), and a count evaluated at read time catches that '
    'where max(created_at) does not. Keys are validated against FILTERS in '
    'routers/credit_card_activity.py before they are written.';
