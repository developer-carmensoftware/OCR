-- The bell's detail dialog names the document by its attachment filename, but
-- `document_posted` / `document_failed` payloads only started carrying it today.
-- Every earlier row shows "—" where the filename belongs.
--
-- The ledger row it came from is still reachable through payload->>'document_id',
-- so the name can be put back rather than lost. One-shot: `_finish` writes the
-- key from now on, and user_notifications is purged at 30 days anyway.
update user_notifications n
set payload = n.payload || jsonb_build_object('attachment', d.attachment)
from email_documents d
where n.type in ('document_posted', 'document_failed')
  and n.payload ? 'document_id'
  and n.payload->>'attachment' is null
  and d.id = (n.payload->>'document_id')::uuid;
