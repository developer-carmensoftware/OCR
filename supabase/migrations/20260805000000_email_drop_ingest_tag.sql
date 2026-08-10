-- Email Automation: one ingest address for every BU, routed by the tax ID on the
-- document instead of by a +tag in the recipient address.
--
-- The tag could only ever identify the BU on *auto-forwarded* mail. A manual
-- forward comes from an employee's own client, which rewrites the recipient — so
-- half the supported arrival modes never had a tag to read. The tax ID is printed
-- on the document itself, is already unique to one BU system-wide (that is what
-- the 409 on PUT /settings enforces), and is already required before the feature
-- can be switched on. It routes both modes with nothing new to configure.
--
-- Dropped outright rather than made nullable first: no customer is live on this
-- feature yet, so there is no window in which both shapes must work.

ALTER TABLE email_ingest_settings DROP COLUMN IF EXISTS ingest_tag;
