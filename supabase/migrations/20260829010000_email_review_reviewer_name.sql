-- Email Automation: keep the reviewer's NAME on the audit row, not just their id.
--
-- A follow-up to 20260829000000 rather than an edit of it. That one is already applied, and
-- an applied migration is not a file you change: `db push` will never re-run it, so the edit
-- would exist only in the repo while the database went on without the column.
--
-- Why the name is stored rather than looked up. Everywhere else in this codebase a row keeps
-- only `carmen_user_id` and the display name is resolved at read time through
-- `tenant_lookup.username_map`, which reads `ocr_sessions`. Those are scrubbed 90 days after
-- the session ends, and that function's own docstring says older ids "fall back to the raw
-- id". Perfectly fine for a usage chart, where a stale row is one line on a graph.
--
-- It is not fine here. This is the record of who approved a journal entry, and the question
-- it has to answer — "who authorised this posting?" — is usually asked long after the fact,
-- by someone who needs a name. Resolving it lazily means that in a year the honest answer is
-- `e6942437-7db5-4895-96e5-b300161dc2b2`.
--
-- So both: `reviewed_by` stays the identity (stable, survives a rename, matches the
-- opaque-external-id convention every other table follows), and this is the label, copied off
-- the session at the moment the decision was made so nothing downstream can erode it.
--
-- Nullable and not backfilled. `ocr_sessions.username` is itself nullable, so a session can
-- genuinely have no display name — and there is nothing to backfill anyway: no document has
-- been reviewed yet, because the queue UI does not exist.

alter table email_documents
    add column if not exists reviewed_by_name varchar(100);

comment on column email_documents.reviewed_by_name is
    'Display name of whoever approved or rejected, copied from the session at decision time. '
    'Denormalised on purpose: the usual route (tenant_lookup.username_map -> ocr_sessions) '
    'decays to a raw UUID once sessions are scrubbed at 90 days, and the audit trail for a '
    'journal entry has to still read as a name in a year. reviewed_by remains the identity; '
    'this is only the label. Null where the session carried no username.';
