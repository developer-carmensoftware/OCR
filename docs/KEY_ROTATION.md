# Rotating `SESSION_ENCRYPTION_KEY`

One Fernet key encrypts everything the app keeps at rest (decision-log #49, #50):
- the review payloads and their error messages;
- correction values, bug-report screenshots, and a contact person's details;
- the session and BU Carmen credentials;
- PDF passwords.

Change it when it may have leaked, when someone who held it leaves, or on a schedule. **Never
swap it in one step**: every value written under the old key would read as empty, and every
signed-in session would answer 500 ("Session data corrupted"). This was measured on the local
stack, 2026-10-30. Rotate in four steps instead.

## Steps

1. **Generate the new key.**
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
   Keep it with the other secrets (Render env), never in the repo or in `system_configs`.

2. **Deploy with both keys.** Set them in the environment's Render env, then redeploy:
   ```env
   SESSION_ENCRYPTION_KEY=<new>
   SESSION_ENCRYPTION_KEYS_OLD=<old>      # comma-separate if more than one
   ```
   - New writes use the new key, and anything written under the old one still reads
     (`app/utils/crypto.py`, a `MultiFernet`).
   - A value in `SESSION_ENCRYPTION_KEYS_OLD` that is not a Fernet key stops the boot. That is
     intended: better than failing mid-rotation.

3. **Re-encrypt.** A dry run first; it only counts:
   ```bash
   curl -X POST -H "Authorization: Bearer $INTERNAL_JOB_TOKEN" \
        "$API/api/v1/admin/encryption/rotate?dry_run=true"
   curl -X POST -H "Authorization: Bearer $INTERNAL_JOB_TOKEN" \
        "$API/api/v1/admin/encryption/rotate"
   ```
   - Repeat the dry run until every `stale` reads 0. Writes made while it ran are already under
     the new key.
   - `unreadable` counts tokens that no key you hold opens. Nothing can recover them, and they
     are left as they are. Expect 0; anything else means a key that wrote data is missing from
     the list.
   - The call also takes an admin token with `configs:write`.

4. **Drop the old key.** Remove `SESSION_ENCRYPTION_KEYS_OLD` and redeploy. Then check once: a
   signed-in screen, a queue document's review dialog, and the email settings page should all
   still read.

## What the rotation covers

`payload_encryption.rotate_tokens` re-encrypts every token the primary key cannot open:

| Where | Stored as |
|---|---|
| `email_documents.review_payload`, `pms_events.review_payload` | `{"enc": token}` (+ readable keys, kept) |
| `email_documents.error_message`, `correction_feedback.*_value`, `bug_reports.screenshot_b64`, `billing_documents.buyer_contact_name`/`buyer_tel`/`buyer_email`, `tenants.contact_email` | bare token |
| `email_ingest_settings.owner_emails` | `{"enc": token}` |
| `ocr_sessions.carmen_token_encrypted`, `email_ingest_settings.carmen_token_enc` | bare token |
| `email_ingest_settings.rules[].pdf_password_enc` | bare token inside each rule |

Not covered: `secure_configs.value_enc`, a legacy table that nothing in the app reads.

Each value is read and written raw, so the column types do not encrypt it twice. Each write is
compare-and-set on the value read, so a row changed in the meantime is left for the next pass.

## Rehearsal

The whole runbook was run end to end on the local stack (2026-10-30):
- key A wrote everything;
- key B alone could not read it;
- B with A as old read everything;
- the rotation reported stale tokens in every column, then 0;
- B alone then read everything, and every token was under B.

The script is `scripts/qa/key_rotation_ui.mjs` + `key_rotation_e2e.py`. The real-DB test is
`backend/tests/tenancy/test_key_rotation.py`.
