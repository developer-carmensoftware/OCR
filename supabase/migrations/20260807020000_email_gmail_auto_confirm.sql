-- Email Automation: record the forwarding handshake completing on its own.
--
-- 20260807000000 assumed the customer finishes Gmail's handshake by pasting a code we
-- read out of the subject. Measured against four real confirmation mails on 2026-08-07
-- (Thai personal Gmail, English Workspace), **there is no code**: Google prints neither
-- one in the subject nor in the body, only a confirmation link. Every real subject still
-- carries the vestigial "(" where "#code)" used to be, which is why the pattern looked
-- plausible — it only ever matched the fixtures we wrote ourselves.
--
-- So the poll follows the link instead, which is what a human click does and is the one
-- mechanism that still works. Nobody types anything and nobody opens the shared mailbox.
--
-- This column is the *outcome*, not another code: it is what the settings screen reads
-- to say "connected" instead of waiting forever for a code that will never arrive.
-- gmail_confirm_code stays, unused in practice, as the fallback if Google brings it back.

alter table email_ingest_settings
    add column if not exists gmail_confirmed_at timestamptz;

comment on column email_ingest_settings.gmail_confirmed_at is
    'When the poll followed Gmail''s forwarding confirmation link for this BU''s ingest '
    'tag and Google accepted it — i.e. the auto-forward is live. Null means no '
    'confirmation mail has been completed yet, not that one is pending.';
