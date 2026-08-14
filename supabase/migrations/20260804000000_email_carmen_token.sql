-- Email Automation — the Carmen posting credential gets its own endpoint.
--
-- Carmen mints a no-expire service token when the customer switches Email
-- Automation on, and invalidates it when they switch it off. Revocation lives on
-- Carmen's side; what we keep is the copy we present when posting, plus the two
-- things that make a credential without an expiry date manageable: a fingerprint
-- to name it in support, and the last time we proved it still works.

alter table email_ingest_settings
    add column if not exists carmen_uri               text,
    add column if not exists carmen_token_fp          varchar(16),
    add column if not exists carmen_token_verified_at timestamptz;

comment on column email_ingest_settings.carmen_uri is
    'Carmen origin this BU posts to, e.g. https://hotelgroup.carmenwork.com. '
    'Supplied with the token; falls back to https://<tenants.host>.';

comment on column email_ingest_settings.carmen_token_fp is
    'First 8 hex of sha256(token) — lets both sides name a credential in support '
    'without either of them revealing it.';

comment on column email_ingest_settings.carmen_token_verified_at is
    'Last time the token was proven live against Carmen. The token never expires, '
    'so this is the only liveness signal that exists.';

comment on column email_ingest_settings.carmen_token_enc is
    'Per-BU Carmen posting credential, supplied through PUT /api/v1/carmen/settings/token. '
    'Fernet-encrypted (it must be replayed to Carmen, so it cannot be hashed). '
    'Never returned by any endpoint.';
