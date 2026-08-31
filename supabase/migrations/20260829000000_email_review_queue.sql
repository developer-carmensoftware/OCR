-- Email Automation: the human-in-the-loop review queue.
--
-- Renumbered from 20260828000000 (and its follow-up from 20260828010000) on 2026-08-31.
-- `20260828000000_email_token_health_cron.sql` reached main under the same version while
-- this branch was unmerged, and Supabase keys `supabase_migrations` on the version alone:
-- whichever landed second would have been treated as already applied and silently skipped,
-- so on prod this DDL would never have run while its own follow-up altered the table it
-- creates columns on. The dev database, which had these applied under the old numbers, was
-- corrected with `supabase migration repair` in the same change.
--
-- Until now a document went extract → GL-map → post to Carmen with nobody in between,
-- which is why docs/CARMEN_INTEGRATION.md publishes "No human approval step" as a property
-- of the contract. That is the right shape for a pipeline people already trust and the
-- wrong one for a BU switching the feature on for the first time: they are asked to believe,
-- on day one, that an LLM read their statement correctly and guessed their GL mapping the
-- way they would have. The evidence arrives only after the JV is in their books.
--
-- So a document now parks at `pending_review` and waits for someone to approve it, and the
-- BU turns that off when it has seen enough. Full design: docs/email-automation/07-human-in-the-loop.md
--
-- `review_payload` is the part worth arguing about. CLAUDE.md says "Credit card line items
-- are NOT persisted" and 04-data-model.md lists them under "Deliberately not stored" — both
-- true, and this narrows rather than repeals them: line items are not stored *after a
-- document is resolved*. A document waiting on a human keeps its extracted payload, because
-- the only alternative is a second vision call the customer pays for twice. `_finish` clears
-- the column to NULL on every terminal transition, so the data exists exactly as long as
-- someone owes us a decision about it.
--
-- Note what is NOT in the payload: the built JV rows. The review screen derives those live
-- from `details` against the *current* accounting config (frontend AccountingReview does this
-- already), because a reviewer must see what would post now, not what would have posted at
-- extract time. Storing them would mean displaying one thing and holding a stale second copy.
-- Also absent, deliberately: the Carmen posting token and URI. Both are re-read at approve
-- time — they rotate, and sweep_token_health may have unverified them while the document sat.

alter table email_documents
    add column if not exists review_payload jsonb,
    add column if not exists reviewed_by    varchar(36),
    add column if not exists reviewed_at    timestamptz;

comment on column email_documents.review_payload is
    'Extracted header/details/warnings/flags for a document parked at pending_review, plus '
    'card_id so approve can stamp credit_cards.submitted_at. NULL on every terminal status — '
    'cleared by _finish. Holds no JV rows (derived live at review time against the current '
    'accounting config) and no Carmen credential (re-read at approve time).';

comment on column email_documents.reviewed_by is
    'carmen_user_id of whoever approved or rejected. Audit only — deliberately no FK and no '
    'enforcement: there is no users table, and any Carmen session for the BU can approve. '
    'Same opaque-external-id convention as ocr_tasks.carmen_user_id.';

comment on column email_documents.reviewed_at is
    'When the approve/reject click happened. Distinct from updated_at, which also moves for '
    'machine writes.';

-- The queue reads exactly this: one BU's pending documents, newest first. Partial so it stays
-- small — pending is a transient state and most of the table is terminal rows kept for dedupe.
create index if not exists ix_email_documents_pending
    on email_documents (tenant_id, created_at desc)
    where status = 'pending_review';

-- Default false, so every BU that already has the feature on wakes up in review mode. That is
-- the direction you can walk back from: a customer who wanted auto-post flips one switch, where
-- the reverse default would post documents nobody had agreed to post.
--
-- Known sharp edge, accepted deliberately (see 07-human-in-the-loop.md §4): PUT /settings is a
-- full replace, so a Carmen client that predates this field omits it, Pydantic supplies False,
-- and a customer who had enabled auto-post silently returns to review mode on their next
-- unrelated settings save. The fix, if it is ever reported, is `bool | None = None` on
-- SettingsIn plus merge-on-omit — the idiom `_merge_rule` already uses for pdf_password_enc.
alter table email_ingest_settings
    add column if not exists auto_post boolean not null default false;

comment on column email_ingest_settings.auto_post is
    'False (default) = every document parks at pending_review and waits for a human. True = '
    'post straight to Carmen, the behaviour that existed before this column. The BU turns it '
    'on once it trusts the extraction; nothing turns it on automatically.';
