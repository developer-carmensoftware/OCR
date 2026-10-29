-- Room for a Fernet token in the contact columns encrypted at rest (decision-log #49, extended).
--
-- From 2026-10-29 the app stores a contact person's details as a Fernet token
-- (`EncryptedText`, models/encrypted_json.py): billing_documents.buyer_contact_name / buyer_tel /
-- buyer_email and tenants.contact_email. A token is at least 100 characters and grows ~4/3 with
-- the value, so an 11-character phone number no longer fits varchar(50), and a long email or a
-- Thai name overflows varchar(255).
--
-- varchar(n) -> text is binary-coercible: a catalogue change, no table rewrite, and the code
-- before this one keeps working on it. It has to be applied BEFORE the code that writes tokens
-- serves, or checkout fails on buyer_tel.
--
-- email_ingest_settings.owner_emails is encrypted too, but it is jsonb already.

alter table billing_documents
    alter column buyer_email        type text,
    alter column buyer_contact_name type text,
    alter column buyer_tel          type text;

alter table tenants
    alter column contact_email type text;
