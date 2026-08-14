-- Email Automation: the customer's own email addresses, and an optional gate on them.
--
-- A list, not one address, because the two supported arrival modes put the customer's
-- address in different headers and often a *different* address:
--
--     auto-forward   → `To:`/`Cc:`  — the mailbox the bank sends to
--     manual forward → `From:`      — whichever employee pressed Forward
--
-- A single value could only ever cover one of them, and a BU with two people who forward
-- would have the second one refused.
--
-- **Empty = no gate**, matching how `bank_sender_email` and `filename_patterns` already
-- behave ("start broad, narrow later", §2.3). Non-empty means a message must carry one
-- of these addresses in From/To/Cc or its attachments are recorded `sender_not_allowed`
-- and never scanned.
--
-- This is a second layer, not the routing key. Ownership is still the `+tag` in the
-- envelope (§2.5) — a header a mail server wrote — and these three headers are written
-- by whoever composed the message, so the gate is forgeable by anyone who already knows
-- the tag. What it reliably catches is accidents: a personal Gmail forwarding a document,
-- someone outside the accounting team, mail that landed on the wrong tag.

alter table email_ingest_settings
    add column if not exists owner_emails jsonb not null default '[]'::jsonb;

comment on column email_ingest_settings.owner_emails is
    'The customer''s own email addresses for this BU. Empty = accept any sender. '
    'Non-empty = a message must carry one of them in From/To/Cc, or its attachments are '
    'recorded sender_not_allowed and never scanned. A second layer only — ownership is '
    'the envelope tag, which a mail server enforces; these headers are not.';
