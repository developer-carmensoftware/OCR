-- Email Automation: when the BU last switched the feature ON.
--
-- Switching automation off does not discard the mail — it is handed back unread
-- (`_unmark_seen`) and replays for up to IMAP_HOLD_DAYS. That is right for a lapsed
-- package or an empty balance: the customer renews and their documents are still there.
--
-- It is wrong for the customer's own toggle. "Off" is exactly when someone keys the
-- statements into Carmen by hand, and a document keyed straight into Carmen leaves no row
-- in `credit_cards` — so `has_submitted_doc` cannot see it and the whole held backlog
-- posts a second time the moment the toggle goes back on.
--
-- So the toggle now means "I've got this": mail that arrived before `enabled_at` is
-- recorded `skipped / ingest_paused` (a ledger row per attachment, so the customer can
-- see on #/admin/email exactly which documents they still owe Carmen) and never scanned.
-- The entitlement holds are untouched and still replay.
--
-- Null = no filtering, i.e. the behaviour before this column existed. Deliberately not
-- backfilled: stamping now() would silently drop whatever is sitting in the mailbox
-- today. `save_settings` stamps it on the next off→on edge, first-ever enable included.

alter table email_ingest_settings
    add column if not exists enabled_at timestamptz;

comment on column email_ingest_settings.enabled_at is
    'When the BU last switched Email Automation on (off->on edge only; re-saving other '
    'settings while already on does not move it). Mail that arrived before this is skipped '
    'as ingest_paused rather than replayed, because the customer was handling those '
    'documents by hand. Null = no filtering.';
