# API Reference

All routes live in `backend/app/routers/email_automation.py`, prefix `/api/v1/carmen`,
OpenAPI tag `Email Automation`. Seven are the Settings/notifications API Carmen calls (six
also documented, in Thai, for Carmen's own developers in
[`../CARMEN_API_SPEC.md`](../CARMEN_API_SPEC.md)); the two ingest routes are cron-only and
appear in no other document.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/carmen/bank-codes` | Caller (see below) | Valid `bank_code` values for a rule — not tenant-scoped |
| GET | `/api/v1/carmen/settings?uri=&bu=` | Caller | Read a BU's current settings |
| PUT | `/api/v1/carmen/settings` | Caller | Replace a BU's settings wholesale |
| PUT | `/api/v1/carmen/settings/token` | Caller | Store the Carmen posting credential (its own endpoint, not part of a settings edit) |
| GET | `/api/v1/carmen/settings/token?uri=&bu=` | Caller | Credential status — never the value |
| DELETE | `/api/v1/carmen/settings/token?uri=&bu=` | Caller | Drop our copy (does **not** revoke it on Carmen's side) |
| GET | `/api/v1/carmen/notifications?uri=&bu=&since=` | Caller | `{"has_notification": bool}` — a badge, not a feed. **Interim poll substitute** for the unbuilt webhook (`../CARMEN_INTEGRATION.md §3.2`) |
| POST | `/api/v1/carmen/email-ingest/run?limit=1..100` | `require_maintenance_auth` | Run one mailbox poll |
| POST | `/api/v1/carmen/email-ingest/health` | `require_maintenance_auth` | Re-verify every enabled BU's stored credential |

## Auth model

Two callers are accepted (`_caller()`, `email_automation.py:130`):

1. **`Bearer <admin JWT>`** — our own operator path, for fixing a customer's settings
   without asking them for a token. Decoded with `decode_admin_principal`
   (`admin/deps.py`), then held to the same two checks every other admin surface applies:
   - the principal must carry **`configs:write`** — on the reads too. Deliberately not
     `configs:read`, because the seeded `viewer` role holds every `*:read` permission and
     a GET here returns the BU's `ingest_address`, which *is* the capability to post a
     document into that BU's Carmen books (`_fresh_tag`, "guessable is a bypass").
   - `tenant_scope` is enforced in `_resolve()`: a scoped operator may act on that tenant
     and no other. `tenant_scope == ""` is global, unchanged.

   A signed token on its own authorises nothing. This path proves nothing against Carmen —
   there is no customer token to prove — so the permission and the scope *are* its boundary.
2. **Anything else, taken verbatim as a Carmen token** — the same
   `Authorization: <token>` shape every other call in Carmen's world uses, with an optional
   `CarmenToken ` prefix stripped for compatibility. There is no API key: the token *is*
   the credential, and it's proven by calling the customer's own Carmen
   (`_resolve()` → `_validate_token()`), not by checking a signature we hold.

`uri` + `bu` in the request body/query are not a claim that's checked against a scope —
they're what the token is proven *against*. A valid token for host X can manage any BU
under X, because one host is always one corporate group. See
[02-architecture.md — Diagram 3](02-architecture.md#diagram-3--settings-api-auth-proof-not-assertion)
for the full sequence.

### Abuse guards on the unauthenticated probe surface

A request with an invalid token still costs a DB read, a DNS lookup and an outbound HTTP
call before it's known to be junk. Three layers keep that cheap (`email_automation.py:58-118`):

1. `_token_is_plausible()` — a Carmen token is `<hash>|<user_uuid>`; requiring the `|`
   separator and a length ≤ 512 drops random junk with no I/O.
2. `_settings_limiter` (20 calls/60s per IP) then `_probe_ceiling` (300 calls/60s global) —
   per-IP alone is the wrong axis for distributed traffic; the global ceiling also stops
   this endpoint being used to flood a customer's own Carmen.
3. A 30-second negative cache of rejected `(token, origin)` pairs — **successes are never
   cached**. A stale "yes" would be a security hole (the token could be revoked a minute
   later); a stale "no" costs nothing, since a real user re-authenticates and gets a
   different token.

None of this stops a volumetric DDoS — that belongs at the network edge. It stops a small
amount of junk traffic from costing a large amount of work.

## Status codes

| Status | When | Client should |
|---|---|---|
| `401` | Header missing/malformed, or Carmen rejected the token | Re-login to Carmen — do not retry |
| `502` | We could not reach that Carmen at all | Transient — retry |
| `429` | Rate limit exceeded | Back off |
| `400` | Unknown `(host, bu)` — that BU has never signed into the OCR app, or `uri` names a host with no tenant | Fix the request; not retryable as-is |
| `409` | Tax ID already registered to a different BU | Surface to the user — usually a copy-paste mistake |
| `422` | Per-field validation failure | Render `errors[]` inline |

`401` and `502` are deliberately distinct: one means the user's Carmen session expired, the
other means their own Carmen server is unreachable. Conflating them on screen blames the
user's login for a problem that isn't theirs.

## `422` error shape

```jsonc
{
  "detail": "Tax ID checksum does not match",   // first message — fallback for clients that don't read errors[]
  "errors": [
    { "field": "tax_ids[0]", "code": "invalid_checksum", "message": "Tax ID must be 13 digits with a valid check digit" }
  ]
}
```

Validation codes, all raised from `save_settings()` / `set_token()`
(`email_settings_service.py`):

| Code | Field | Meaning |
|---|---|---|
| `invalid_email` | `owner_emails[i]` | Doesn't look like an address |
| `invalid_checksum` | `tax_ids[i]` | Not 13 digits with a valid Thai check digit |
| `reserved_tax_id` | `tax_ids[i]` | That number belongs to a bank, not a customer |
| `required` | `rules[i].filename_patterns` or `tax_ids` | Missing something that's mandatory |
| `unsupported_bank` | `rules[i].bank_code` | Not in the active `banks` table |
| `duplicate_bank` | `rules[i].bank_code` | Two rules name the same bank (or two `null`/"Other" rules) |
| `not_entitled` | `enabled` | Enabling without an active monthly package |
| `token_rejected` | `token` | Carmen itself returned non-200 for this token |
| `invalid_uri` | `carmen_uri` | The **stored** origin failed the SSRF check — not something the caller can fix by resending `uri` differently |

## `PUT /settings` — full-replace semantics

The payload replaces the BU's rule list wholesale — **send the complete current list, not
a delta.** A rule's `pdf_password` field is the one exception to "whatever you send is what
gets stored": omit it to keep the existing password, send `""` to clear it, send a value to
set it (`_merge_rule()`, `email_settings_service.py:534`).

The ingest tag is allocated inside this call, and only here — the first time `enabled` is
set `true` for a BU that doesn't already have one (`save_settings():516`). It is never
reissued afterward, including across disable → re-enable or a lapsed package.

## `PUT /settings/token`

`uri` here is an identity input only — used to look up the tenant by `(host, bu)` and then
discarded. The origin the token is verified against, and later posts to, is always rebuilt
from `tenants.host` (`_safe_carmen_uri()`), never taken from the payload — so a caller can
never verify against one Carmen and have JVs posted to another. The token is checked with a
live `GET /Carmen.API/api/interface/department` call **before** anything is written; a
rejected token leaves the database untouched.

```jsonc
// Response — everything safe to show, never the secret
{
  "configured": true,
  "fingerprint": "9c1f3a2b",
  "carmen_uri": "https://hotelgroup.carmenwork.com",
  "verified_at": "2026-08-04T03:15:00Z"
}
```

`DELETE` removes only our copy — Carmen must revoke the credential on its own side, since a
copy we deleted is still live everywhere else.

## `GET /settings` response shape

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "entitled": true,
  "ingest_address": "AIAGENT+a1b2c3d4@carmensoftware.com",   // null until a tag is issued
  "tax_ids": ["0105536000127"],
  "rules": [ { "bank_code": "KTC", "bank_sender_email": "no-reply@ktc.co.th",
               "filename_patterns": ["MDR", "Commission"], "has_password": true, "is_active": true } ],
  "gmail_confirmed_at": null,
  "gmail_confirm": null,
  "status": {
    "documents_total": 128,
    "last_received_at": "2026-07-30T09:12:00Z",
    "ready": true,
    "blockers": []   // possible values: not_configured, no_tax_id, no_rule, disabled, not_entitled
  }
}
```

`status.ready` is `false` if any blocker is present. `not_configured` only appears when no
row exists yet for the BU at all.

## `POST /email-ingest/run`

```http
POST /api/v1/carmen/email-ingest/run?limit=20
Authorization: Bearer <INTERNAL_JOB_TOKEN>
```

Runs one poll synchronously and returns the summary — see
[02-architecture.md — Diagram 5](02-architecture.md#diagram-5--one-poll). `limit` bounds
messages fetched this poll (1–100; default is `IMAP_BATCH_SIZE`). Returns
`{"status": "disabled", "reason": "IMAP not configured"}` when `IMAP_HOST` is empty, without
touching a mailbox.

```jsonc
{ "messages": 4, "posted": 2, "failed": 1, "skipped": 1, "unrouted": 0 }
```

## `POST /email-ingest/health`

Re-proves every `enabled=true` BU's stored Carmen credential with the same
`GET /department` call `verify_token()` uses at write time. Carmen tokens don't expire, so
this is the only substitute for one — without it, the first symptom of a revoked credential
is a real document failing to post. Clears `carmen_token_verified_at` on failure rather than
deleting the token, since a transient Carmen outage looks identical to a revocation.

```jsonc
{ "checked": 12, "ok": 11, "failed": 1 }
```

Both `/email-ingest/*` routes share `require_maintenance_auth`
(`backend/app/routers/admin/deps.py:78`) — admin JWT **or** `INTERNAL_JOB_TOKEN` via
constant-time compare, the same auth every other pg_net cron callback in this codebase uses.
