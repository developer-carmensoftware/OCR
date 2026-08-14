-- Email Automation: capture Gmail's forwarding confirmation code.
--
-- Setting up an auto-forward in Gmail is a two-party handshake: the customer names
-- the destination, and Google mails a confirmation code *to that destination* which
-- has to be typed back into the customer's own Gmail screen. Our destination is a
-- shared mailbox nobody outside this team can open, so until now that code had no
-- way of reaching the only person who can use it — the last manual step in an
-- otherwise self-service setup, and one that needed us on a support call.
--
-- The confirmation mail arrives at ocr+<tag>@… like every other message, so the
-- envelope already says which BU is waiting for it. The poll reads the code out of
-- the subject and parks it here; GET /settings hands it back to the settings screen.
--
-- One value, overwritten: a confirmation code is single-use and short-lived, so the
-- previous one is never interesting. A BU re-running the setup simply gets the newer
-- code — no history, no expiry job.

alter table email_ingest_settings
    add column if not exists gmail_confirm_code varchar(32),
    add column if not exists gmail_confirm_at   timestamptz;

comment on column email_ingest_settings.gmail_confirm_code is
    'Latest Gmail forwarding confirmation code addressed to this BU''s ingest tag. '
    'Read from the subject of forwarding-noreply@google.com mail during the poll and '
    'echoed by GET /settings so the customer can paste it into their own Gmail screen. '
    'Single-use and overwritten — not a log.';
