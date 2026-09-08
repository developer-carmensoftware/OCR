# API Reference

Two routers, two auth models, and the split is the point.

`backend/app/routers/email_automation.py` (prefix `/api/v1/carmen`, tag `Email Automation`)
answers **Carmen's server**, authenticated by replaying the customer's own Carmen token.
Seven are the Settings/notifications API Carmen calls (six also documented, in Thai, for
Carmen's own developers in [`../CARMEN_API_SPEC.md`](../CARMEN_API_SPEC.md)); the two ingest
routes are cron-only and appear in no other document.

`backend/app/routers/email_review.py` (prefix `/api/v1/email`, tag `Email Review`) answers
**our own frontend** at `#/CreditCardOCR`, where the user already holds a session JWT, so it
uses `get_current_session` like every other tenant-facing route in the app. It is what the
human-in-the-loop queue reads and writes — see
[07-human-in-the-loop.md](07-human-in-the-loop.md).

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

### The review queue (`/api/v1/email`, session JWT)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/email/documents?tab=&limit=&offset=` | `Page[ReviewDocument]` for this BU, newest first |
| GET | `/api/v1/email/documents/{id}` | One document plus the `review_payload` the screen edits |
| GET | `/api/v1/email/status` | Which of the queue's four states to paint, plus a count per tab |
| POST | `/api/v1/email/documents/{id}/approve` | Post what the reviewer checked → `{jv_no, tax_note}` |
| POST | `/api/v1/email/documents/{id}/reject` | Terminal, optional reason → `204` |

> `auto_post` is **read** here (`GET /email/status`) and written nowhere in this app. It is
> one field of the BU's settings, and `PUT /api/v1/carmen/settings` is its only writer —
> Carmen's own settings screen. The `PUT /api/v1/email/settings/auto-post` that used to sit
> in this table was deleted on 2026-09-08: two writers for one boolean meant an unrelated
> settings save could turn review back on behind the customer's back
> ([CARMEN_INTEGRATION.md §2.7](../CARMEN_INTEGRATION.md)).

`tab` is one of `review` · `posted` · `problem` · `skipped`, and is a *group* of ledger
statuses rather than one: `problem` is `failed` + `rejected` (they differ in who decided,
which the row shows, but not in what is owed) and `skipped` absorbs `received` so a row
stuck mid-flight is still findable. An unknown value falls back to `review`.

> ⚠️ **`GET /email/documents` is not what the screen reads.** It is the older, email-only
> list, and its four `TABS` are not the chips — the queue has used the activity table below
> since 2026-08-31, and `/email/status`'s per-tab `counts` are deliberately ignored by the
> browser (`emailReview.ts`). Nothing has been deleted because approve/reject still live on
> this router; the vocabulary below is the live one.

### The activity table (`/api/v1/credit-card`, session JWT)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/credit-card/activity?filter=&limit=&offset=` | `ActivityPage` — email documents **and** manual scans, newest first, plus `counts`, `attention` and `unseen` per chip |
| POST | `/api/v1/credit-card/activity/seen` | `{filter}` — somebody in this BU opened that chip, put its dot out |

What `#/CreditCardOCR` actually lists, and a strictly wider question than
`GET /email/documents` (which still exists and is still email-only). Each row carries
`source: email|manual`, and a manual row is a `credit_cards` entry with `submitted_at IS NOT
NULL` and no `email_documents` row pointing at its task — email ingest writes both, so
without that anti-join one forwarded statement is listed under each source.

**`filter` is `all` · `today` · `review` · `success` · `unposted`**; unknown falls back to
`all`. All five have a chip on screen. They are **not** a grouping of statuses —
`_chip_expr()` in `credit_card_activity.py` is the single definition, as a SQL `CASE` the
list filters on and the counts group by:

| chip | what is in it |
|---|---|
| `today` | every row since midnight ICT, whatever became of it. Cuts across the others, which is why it is left out of `counts["all"]`. Carries a count, never a dot |
| `review` | a document waiting for somebody's decision: `pending_review`, and nothing else (§18 #82) |
| `success` | `posted`. Manual scans land here too — they are only listed once posted |
| `unposted` | **it did not become a JV**: rejections, charged failures, a `received` row the pipeline never finished, and the pre-charge refusals a person can clear from settings — all of them as ordinary rows, one per attachment |
| `all` | no predicate at all — the module's log, and the only view holding the chipless bucket below. No count, no dot |

Plus one **bucket with no chip**, and what fills it is *volume* rather than the charge
(§18 #83). It cannot be passed as `filter`, appears in `counts` and `attention`, never in
`unseen`, and is listed in place under `today` and `all`:

| bucket | what is in it |
|---|---|
| `noise` | `status = 'skipped'` **and** `reason_code IN ('no_rule_match', 'unreadable_document')` — the two that fire per *attachment* on legitimate mail (97 of one dev BU's 140 rows). `attention` is always `0`. The status test is load-bearing: the same code on a `failed` row is a crash inside the refund boundary |

The **four ledger buckets** partition the ledger — exactly one each — so `counts["all"]` is a
true total rather than a sum of overlapping piles.

**No dismissal** (§18 #86). `dismissed_at` survives as a column that `_attention` reads —
it is what keeps the 2026-09-03 migration's back-dated pile from lighting the dot — but
nothing writes it any more: both `POST /activity/{id}/dismiss` and the per-cause
`POST /activity/dismiss` are gone. A row under `Not posted` accumulates there like every
failure and rejection beside it.

See [`07-human-in-the-loop.md §9`](07-human-in-the-loop.md) for the table, §12 for the chips
and the dot, §13 for the re-key on who can act, §14 for the charge split and `all`'s return,
§18 for the noise arm and the narrowed `review`.

**`auto_post` is a field of `PUT /api/v1/carmen/settings` and has no route of its own**
(§21 #98, 2026-09-08). It used to have one, on the reasoning that the settings endpoint is a
full replace and flipping the switch through it would rewrite the BU's rules and PDF
passwords on the way. True, and answered by sending them back unchanged — which is what the
settings screen does anyway. What the separate route actually bought was a **second writer**,
and that is what let an ordinary settings save reset the switch. The field now merges on
omit, so a caller that does not send it changes nothing.

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
{ "messages": 4, "posted": 2, "pending_review": 1, "failed": 1, "skipped": 1, "unrouted": 0 }
```

`pending_review` counts documents parked for a human this poll. On a BU with `auto_post`
off — the default — `posted` stays `0` and this is the number that moves. With it on, both
move: `auto_post` posts only what `_review_flags()` had nothing to say about, so a flagged
document lands here rather than in `posted`.

## `POST /email-ingest/health`

Re-proves every `enabled=true` BU's stored Carmen credential with the same
`GET /department` call `verify_token()` uses at write time. Carmen tokens don't expire, so
this is the only substitute for one — without it, the first symptom of a revoked credential
is a real document failing to post. Clears `carmen_token_verified_at` on failure rather than
deleting the token, since a transient Carmen outage looks identical to a revocation.

```jsonc
{ "checked": 12, "ok": 11, "failed": 1 }
```

## `POST /documents/{id}/approve`

```jsonc
// request — what was on the reviewer's screen, not a request to rebuild it
{
  "extracted": { "doc_no": "INV-001", "doc_date": "15/01/2026", "details": [ /* … */ ] },
  "rows": [ /* the JV rows the screen displayed */ ],
  "post_input_tax": true
}
// response
{ "jv_no": "JV-9001", "tax_note": null }
```

`rows` are sent, not rebuilt server-side: the screen derives them against the live
accounting config, so rebuilding would risk posting something other than what the person
approved. Synchronous on purpose — Carmen rejects JVs for reasons only a human can fix, and
telling them ten minutes later in a notification wastes the fact that they are sitting
right there.

| Status | When | What the row does |
|---|---|---|
| `200` | Posted | `posted`, `review_payload` cleared, `jv_no` stamped |
| `200` + `tax_note` | JV posted, input-tax record did not | Still `posted` — the VAT is a separate errand, not a failure |
| `400` | Carmen declined (`Code != 0`) — closed period, unknown dept | **Stays `pending_review`.** The message is Carmen's own; it is fixable on the screen |
| `409` | Someone else in the BU approved or rejected it first | Gone from the queue |
| `503` | Carmen unreachable | Stays `pending_review`. *Check whether the JV posted before approving again* |

Both `/email-ingest/*` routes share `require_maintenance_auth`
(`backend/app/routers/admin/deps.py:78`) — admin JWT **or** `INTERNAL_JOB_TOKEN` via
constant-time compare, the same auth every other pg_net cron callback in this codebase uses.
