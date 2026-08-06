-- Email Automation: route on a per-BU tag in the recipient address again, and keep
-- the tax ID as a second check rather than as the routing key.
--
-- 20260805000000 dropped this column on the reasoning that a `+tag` could only work
-- for auto-forwarded mail, "because a manual forward comes from an employee's own
-- client, which rewrites the recipient". That premise is wrong: on a manual forward
-- the employee *types* the destination, so the recipient is whatever Carmen's screen
-- told them to send to. The tag survives a manual forward exactly as it survives an
-- auto-forward; all it costs is a longer address to copy.
--
-- What the tax-ID-only design cost was much larger. The tax ID is only readable by
-- running the vision LLM, so every attachment reaching a deliberately-public mailbox
-- was extracted *before* anyone was known to own it — unbounded spend, and no
-- `llm_usage_logs` row for any of it (that table's tenant_id is NOT NULL, so a
-- tenant-less call could not be inserted at all). And one OCR-derived signal was the
-- only thing standing between a document and a company's general ledger.
--
-- The tag is in the envelope, so reading it is free. Envelope first means the owner,
-- the ledger row, the credit and the usage row all exist before the first LLM call,
-- and the tax ID printed on the document becomes an independent second factor:
-- disagreement parks the document instead of picking a winner.
--
-- Two deliberate differences from the original 20260803000000 column:
--
--   nullable, where it was `not null` — a BU that signs in once and never buys
--     anything must not consume a tag, and that describes most tenants. Allocated
--     on the first successful enable, behind the entitlement gate.
--
--   never reclaimed, including across disable → re-enable and a lapsed package —
--     the customer's mailbox rule points at the tag. Reissuing one makes their
--     documents vanish with no error anywhere.

alter table email_ingest_settings
    add column if not exists ingest_tag varchar(32);

create unique index if not exists uq_email_ingest_tag
    on email_ingest_settings (ingest_tag) where ingest_tag is not null;

comment on column email_ingest_settings.ingest_tag is
    'Random 8-hex tag delivered inside the ingest address (AIAGENT+<tag>@…). Identifies '
    'the owning BU from the message envelope, before any LLM call. Allocated once on the '
    'first successful enable and never reissued — the customer''s mailbox rule points at it.';
