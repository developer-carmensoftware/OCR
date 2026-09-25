-- A parked document that somebody is posting right now.
--
-- `approve_document` used to take the row with SELECT ... FOR UPDATE and then close that
-- session before calling Carmen -- so the lock was gone by the time it mattered, and two
-- reviewers pressing Approve together both posted the JV (reproduced on the real dev DB,
-- tests/tenancy/test_email_approve_integrity.py). The notification goes to the whole BU,
-- not to one person, so two people with the queue open is the expected case.
--
-- The claim is a timestamp rather than a status, deliberately:
--   * a new status value would drop the row out of every tab and count for the seconds it
--     is in flight, and every reader of `status` would have to learn it;
--   * a status left behind by a process that died mid-post would strand the document
--     forever, while a timestamp simply expires (POSTING_CLAIM_TTL in
--     email_ingest_service.py) and the document is reviewable again.
--
-- Holding the row lock across the Carmen call instead (as routers/carmen.py does for the
-- wizard) was the other option; it keeps a pooled connection open for up to two Carmen
-- timeouts per approval, against a pool of 10 capped by Supavisor at 15.

alter table email_documents
    add column if not exists posting_started_at timestamptz;

comment on column email_documents.posting_started_at is
    'Set by approve/reject when they take a pending_review row, cleared when they finish '
    'or give up. Non-null and younger than the claim TTL = someone is acting on this row; '
    'a second approve/reject gets 409. Older than the TTL = the claimant died and the row '
    'is free again.';
