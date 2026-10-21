-- Email Automation: when a person last saved this BU's settings (decision-log #46).
--
-- `tags_awaiting_confirmation` opens the mailbox every minute for a BU that is plausibly
-- mid-setup: no Gmail confirmation yet, and settings touched in the last 24 hours. "Touched"
-- was `updated_at`, which every write of the row moves. Two writers that have nothing to do
-- with setup move it every day:
--
--   * the daily `email-token-health` check re-proves the credential and stamps
--     `carmen_token_verified_at` at 09:15, inside the 24-hour window, every day;
--   * `adopt_token` re-proves a held credential on every Carmen settings write (#45).
--
-- So every enabled BU that never forwards from Gmail stayed "mid-setup" forever, and the
-- per-minute sweep logged into IMAP 1 440 times a day (dev, 2026-10-21: p50 2.4 s, max 85 s,
-- 50 calls past pg_net's 5 s timeout). The design said steady state is no connection at all.
--
-- This column has one writer, `save_settings`, so no credential write can reopen the window.
-- Backfilled from `updated_at`: a BU genuinely mid-setup keeps its window, and the ones held
-- open by the daily check drain within 24 hours.
--
-- ORDER: `supabase db push` BEFORE the code deploys. The ORM selects this column, so code
-- that ships first fails every read of email_ingest_settings until the push.

alter table email_ingest_settings
    add column if not exists settings_saved_at timestamptz;

update email_ingest_settings
   set settings_saved_at = updated_at
 where settings_saved_at is null;

comment on column email_ingest_settings.settings_saved_at is
    'When a person last saved these settings (PUT /api/v1/carmen/settings). Only '
    'save_settings writes it. Opens the per-minute Gmail-confirmation sweep for 24 hours; '
    'credential checks deliberately do not.';
