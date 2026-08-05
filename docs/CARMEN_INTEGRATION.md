# Carmen ↔ OCR — Email Automation Integration Contract

> **Status: Part A (§1–§2) is settled, built and live-tested. Part B (§3, webhooks) is
> still a proposal and nothing in it has been built.**
> Everything in Part A will not change without notice here. §5 is the short list of what we
> still need from Carmen — none of it blocks the settings API, which works today.
>
> Companion documents: [EMAIL_FLOW.md](EMAIL_FLOW.md) (the v1 pilot design, now superseded),
> [Security_Trust_Overview.md](Security_Trust_Overview.md).

---

## 0. What this is

Banks email commission / fee reports to hotels. Today a user downloads the file and
uploads it into the OCR wizard by hand. In this version the customer sets up **one
auto-forward rule** in their mailbox and everything after that is automatic:

```text
Bank ──mail──> Customer mailbox ──┬── auto-forward rule ──┐
                                  └── forwarded by hand ──┤
                                                          ▼
                                                     OCR ingest
                                                          │
                                    extract → verify the document belongs to the BU
                                            → build the JV → post to Carmen
                                                          │
                                        webhook: Carmen learns the outcome
```

The three things that make this different from the pilot:

1. **No human approval step.** Documents post to Carmen automatically.
2. **Settings live in Carmen.** The customer configures everything on Carmen's screens;
   Carmen calls our API to store it. The OCR app has no settings UI for this feature.
3. **Carmen is notified by webhook**, so it can react without polling us.

### What the customer does (the whole setup)

1. Turn on Email Automation in Carmen (only available with an active monthly package).
2. Copy the forwarding address Carmen shows them, and either set an auto-forward rule in
   their mailbox, or simply forward the bank's mail to that address by hand whenever they
   receive one. Both work, and they can mix the two.

That is the entire customer-facing setup. Everything else — tax ID, GL mapping,
bank rules — comes from data Carmen already holds or the customer has already
configured in the OCR app.

### 0.1 The two arrival modes

Both are supported, but they carry different amounts of information and the system
compensates differently. Carmen does not need to configure anything per mode — this
section exists so the behaviour is not surprising.

| | Auto-forward | Manual forward |
|---|---|---|
| Sender of the mail we receive | the bank | the employee who forwarded it |
| Which BU it belongs to | the address it was sent to | the address it was sent to |
| Which bank issued it | matched from the sender address | **detected from the document itself** |
| Bank's DKIM signature | survives, and we check it | broken by the forward — cannot be checked |
| What proves the document belongs to this BU | the tax ID on the document | the tax ID on the document |

Two consequences worth stating plainly:

- **The tax ID check is what makes manual forward safe.** A manually forwarded mail
  carries no verifiable proof that a bank produced the attachment, so the document's own
  content is the only trustworthy evidence. This is the main reason §2.4 is mandatory.
- **A document forwarded twice is not charged twice.** If the same report arrives both
  automatically and by hand, the second one is recognised by document number and rejected
  as a duplicate, with the credit refunded.

---

## 1. Identity

A **tenant** in the OCR system is the pair `(host, bu)`:

| Field | Meaning | Example |
|---|---|---|
| `host` | hostname of the customer's Carmen instance | `hotelgroup.carmenwork.com` |
| `bu` | business-unit code, lowercased | `hq`, `bkk01` |

This is the same pair `POST /api/v1/auth/exchange` already resolves today, so a BU that
has ever logged into the OCR app already exists on our side. Every API call and every
webhook in this document carries `host` + `bu`; there is no separate tenant id for
Carmen to store (we return ours for logging convenience, but Carmen never needs to
send it back).

**Naming convention:** our JSON is `snake_case`. Carmen's existing API is `PascalCase`.
We follow each side's own convention rather than mixing.

---

## 2. Part A — Settings API (Carmen → OCR)

> Every route below is live and has been exercised end to end against a Carmen dev
> instance, including each error case quoted here.
>
> **This section is the reasoning. For the reference a developer codes against, hand them
> [CARMEN_API_SPEC.md](CARMEN_API_SPEC.md)** — every endpoint with its fields, response and
> error table, in Thai. The machine-readable version is the OpenAPI document the service
> publishes at **`/docs`** (`/openapi.json`).

### 2.1 Authentication — **settled: the user's own Carmen token. No key.**

Carmen's settings screen already holds the logged-in user's Carmen token. Send it:

```http
PUT /api/v1/carmen/settings
Authorization: <the user's Carmen token>
Content-Type: application/json
```

**There is nothing to issue, deliver, store or rotate**, for any number of installations.
That is the point. Every customer runs their own Carmen, so an API key would have meant one
key per installation, handed over out-of-band, kept in a secret manager, and re-done for
every new customer — unbounded manual work on both sides, forever. The 101st customer now
needs no action from anyone.

**How we know the token is genuine:** we call
`GET {host}/Carmen.API/api/interface/department` with it before doing anything. Your Carmen
answers `200` or `401`; that is the whole check. This is not a new mechanism — it is exactly
what `/auth/exchange` has done for every OCR wizard user since day one.

**What that buys beyond convenience.** `host`/`bu` in the payload stop being a claim we have
to check and become the thing the token is *verified against*: acting on a host means holding
a credential that host's own Carmen accepts. Since one host is always one corporate group, a
valid token for host X may manage any BU under X — which is the ownership boundary, and the
same thing a host-scoped key would have granted.

| Status | When |
|---|---|
| `401` | header missing or malformed; or Carmen rejected the token → **re-login**, do not retry |
| `502` | we could not reach that Carmen to check → **transient**, retry |
| `429` | more than 20 requests a minute from one IP (each one costs an outbound call to you) |
| `400` | unknown `(host, bu)` — that BU has never signed into the OCR app |
| `409` | tax ID already registered to another BU (§2.4) |
| `422` | per-field validation, see the `errors[]` shape |

**Please treat `401` and `502` differently on screen** — one means the user's session
expired, the other means their own server is unreachable. Blaming the customer's login for
our inability to reach their host is the confusing case worth avoiding.

`Bearer <admin jwt>` is also accepted; that path is ours, for operators fixing a customer's
settings without asking them for a token.

> Nothing needs to be exchanged out-of-band any more. The webhook secret in §3.5 is now the
> only shared secret in this integration.

### 2.2 Read current settings

```http
GET /api/v1/carmen/settings?host=hotelgroup.carmenwork.com&bu=hq
```

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "entitled": true,                       // active monthly package — see §3.3
  "ingest_address": "ocr+7f3a91@carmensoftware.com",   // display it; see §2.5
  "tax_ids": ["0105536000127"],
  "rules": [
    {
      "id": "b3f1…",
      "bank_code": "KTC",                 // null = "Other" (generic prompt + auto-detect)
      "bank_label": null,                 // display name, used when bank_code is null
      "bank_sender_email": "no-reply@ktc.co.th",
      "filename_pattern": "MDR",          // case-insensitive substring; null = any file
      "has_password": true,               // never the password itself
      "is_active": true
    }
  ],
  "status": {                             // read-only, for Carmen to display
    "documents_total": 128,
    "last_received_at": "2026-07-30T09:12:00Z",
    "ready": true,                        // false = something below blocks ingestion
    "blockers": []                        // e.g. ["no_tax_id", "not_entitled", "no_rule"]
  }
}
```

### 2.3 Write settings

```http
PUT /api/v1/carmen/settings
```

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "enabled": true,
  "tax_ids": ["0105536000127"],           // REQUIRED — see §2.4
  "rules": [
    {
      "bank_code": "KTC",                 // the rule's identity — required
      "bank_sender_email": "no-reply@ktc.co.th",   // optional hint, see below
      "filename_pattern": "MDR",
      "pdf_password": "1234",             // write-only: omit = keep, "" = clear
      "is_active": true
    }
  ]
}
```

- The payload **replaces** the BU's rule list (send the full list, not a delta).
- A rule is keyed by **`bank_code`**, not by the sender address. Manually forwarded mail
  arrives from an employee, so the issuing bank is detected from the document itself; the
  sender address is only a fast path for automatically forwarded mail. `bank_sender_email`
  may therefore be `null`, and a BU that only ever forwards by hand never has to fill it in.
- `pdf_password` is accepted on write, stored encrypted, and **never returned** by any
  endpoint. Reads expose `has_password: true/false` only. When the issuing bank is not yet
  known at the moment a protected file is opened, we try the passwords of that BU's active
  rules — they are all the customer's own, and there are only a handful.
- Supported `bank_code` values today: `BBL`, `KBANK`, `SCB`, `BAY`, `KTC`, `GHL`,
  `PAYPAL`, `SIAMPAY`, or `null` for anything else.

Errors are returned as `422` with a per-field list so Carmen can render them inline:

```jsonc
{ "errors": [ { "field": "tax_ids[0]", "code": "invalid_checksum",
                "message": "Tax ID checksum does not match" } ] }
```

### 2.4 Tax IDs — required, and why

**The BU's 13-digit tax ID must be set before Email Automation can be switched on.**
It is the control that stops a document belonging to another legal entity from being
posted into this BU's books — the one failure that automatic posting cannot recover
from, and that no email-level check can detect (a correctly-routed mail can still carry
the wrong company's invoice, e.g. when a customer forwards the wrong message).

Every document we extract is checked against this list before it is posted. A document
whose tax IDs do not include the BU's is never posted; the credit is refunded and
Carmen is notified.

- Send **all** tax IDs that legitimately appear on this BU's bank documents (several
  branches or legal entities under one BU is fine — it is a list).
- Format: 13 digits, no dashes or spaces. We validate the standard check digit and
  reject a malformed value at write time rather than silently at 3am.
- A tax ID may belong to **only one BU across the whole system**. A second BU claiming
  the same number is rejected with `409` — please surface that error to the user, it
  usually means a copy-paste mistake.
- **We would like Carmen to fill this automatically from its company master** rather
  than asking the user to type it. It is data Carmen already holds, and a typed number
  is a number that can be typed wrong.

> **Request to the Carmen team:** confirm which field in Carmen's company/BU master
> holds the tax ID (and branch, if separate), so we can agree the mapping.

### 2.5 The forwarding address — **settled: a unique address per BU**

`GET /settings` returns `ingest_address`. Carmen's screen **displays that string** and tells
the customer to forward their bank mail to it. That is the entire integration for this
section — no action needed from Carmen beyond showing the value.

```text
ocr+7f3a91@carmensoftware.com
        └── unique per BU, allocated by us on the first write
```

Implemented as plus-addressing on one mailbox, which matters for two reasons worth knowing:

- **The tag identifies the BU before any LLM call is paid for**, so quota checks, per-tenant
  limits and junk mail are all handled at the front door rather than after we have paid for
  an extraction.
- **A separate mailbox per customer would not have scaled.** Our mail admin creates those by
  hand against a cap of roughly 30; plus-addressing has no cap and needs no administration —
  the same reasoning that removed the API key in §2.1.

The alternative — one shared address, with the BU identified from the original recipient
header — was rejected because it cannot support **manual forwarding**. A mail forwarded by
hand comes from an employee's own address and carries no trace of who originally received
it, so every employee who might forward something would have to be registered first.

The address is `null` until the BU's first `PUT` (the tag is allocated with the row), so read
it from the response you already get back rather than calling `GET` again.

### 2.6 The posting credential

Carmen mints a token per BU and sends it here. Deliberately **its own endpoint, not a
field on `PUT /settings`** — an ordinary settings edit (a new tax ID, a tweaked rule)
should not re-transmit a secret every time.

```http
PUT /api/v1/carmen/settings/token
Authorization: <the user's Carmen token>
```

```jsonc
{
  "host": "hotelgroup.carmenwork.com",
  "bu": "hq",
  "token": "…",                                  // write-only, never returned
  "carmen_uri": "https://hotelgroup.carmenwork.com"   // optional; defaults to https://<host>
}
```

**We verify the token against Carmen before storing it** — we call
`GET {carmen_uri}/Carmen.API/api/interface/department` with it, an ordinary authenticated
read. A token Carmen will not accept is rejected on the spot and **nothing is written**, so
the customer finds out on the settings screen rather than on a real document at 3am.

Both failures come back as `422` in the same per-field shape as `PUT /settings` (§2.3), so
Carmen's screen can render them inline without a second code path:

```jsonc
{ "errors": [ { "field": "token", "code": "token_rejected",
                "message": "Carmen rejected this token (HTTP 401)" } ] }

{ "errors": [ { "field": "carmen_uri", "code": "invalid_uri",
                "message": "uri hostname not allowed" } ] }
```

`invalid_uri` means the URL failed the same SSRF check `/auth/exchange` applies: https
only, no loopback or private address (whether written literally or reached through DNS),
and the host allowlist when one is configured. Sending no `carmen_uri` at all is the
normal case — we default to `https://<host>` and validate that too.

Every error body also carries a top-level `detail` string (the first message, for logs and
for clients that do not read `errors`). Render from `errors`; treat `detail` as a fallback.

Success returns the credential's status — which is everything about it that is safe to
show, and never the value:

```jsonc
{
  "configured": true,
  "fingerprint": "9c1f3a2b",              // first 8 hex of sha256 — see below
  "carmen_uri": "https://hotelgroup.carmenwork.com",
  "verified_at": "2026-08-04T03:15:00Z"
}
```

```http
GET    /api/v1/carmen/settings/token?host=…&bu=…    → the same status block
DELETE /api/v1/carmen/settings/token?host=…&bu=…    → 204
```

Four things worth stating plainly:

- **`DELETE` removes our copy; it does not revoke anything.** Only Carmen can revoke, and
  must — a copy we deleted is still a live credential everywhere else. Please wire
  revocation to the customer switching Email Automation **off**, so the setting and the
  credential cannot disagree.
- **Rotation is off-then-on.** There is no separate rotate endpoint and Carmen needs no
  new concept: invalidate, mint, `PUT` again. `PUT` overwrites whatever is stored.
- **`fingerprint`** lets both sides name a credential in a support conversation without
  either of them revealing it. Quote it in tickets.
- **We will re-verify daily.** The token has no expiry, so nothing announces a revocation:
  the first symptom would otherwise be a customer's document failing to post. A job
  re-proves every stored credential against Carmen — the same `GET /department` as above —
  and clears `verified_at` when one stops working. Built and tested; it starts running on
  a schedule when the ingest mailbox goes live. If you would rather we did not make that
  daily call, tell us — it is the only substitute we have for an expiry date.

The token is stored encrypted (it has to be replayed to Carmen, so it cannot be hashed
the way our own API key is), is never returned by any endpoint, and never appears in a
log line or an error message.

---

## 3. Part B — Webhooks (OCR → Carmen)

### 3.1 Envelope, signing and delivery

Every event is a `POST` with the same envelope:

```jsonc
{
  "id": "evt_01J8…",                       // unique per event — use it to dedupe
  "type": "subscription.activated",
  "occurred_at": "2026-07-31T03:15:00Z",   // UTC, ISO-8601
  "tenant": { "host": "hotelgroup.carmenwork.com", "bu": "hq" },
  "data": { }                              // per-event, see below
}
```

Headers:

| Header | Meaning |
|---|---|
| `X-OCR-Event-Id` | same value as `id` — dedupe key |
| `X-OCR-Event-Type` | same value as `type` — lets Carmen route before parsing |
| `X-OCR-Timestamp` | unix seconds, included in the signed string |
| `X-OCR-Signature` | `sha256=<hex>` — HMAC-SHA256 of `"{timestamp}.{raw_body}"` using the shared secret |

**Verification on Carmen's side:** recompute the HMAC over the *raw* body bytes (before
JSON parsing) and compare in constant time; reject if `X-OCR-Timestamp` is more than
5 minutes from now.

**Delivery semantics:**

- **At-least-once.** Retries mean Carmen can receive the same event twice — dedupe on
  `id`, and make handlers idempotent.
- Success = any `2xx`, returned within **10 seconds**. Anything else is a retry.
- Retries use exponential backoff over roughly 24 hours; after that the event is parked
  as undeliverable and raises an alert on our side. We can replay parked events on request.
- Ordering is **not** guaranteed. Use `occurred_at` when order matters (e.g. an
  `activated` arriving after a `lapsed` for the same BU).
- One endpoint URL per Carmen host is enough; tell us if you would rather have one URL
  per event type.

### 3.2 `notification.created`

Fires when a new in-app notification is created for a BU, so Carmen can show the badge
without polling.

```jsonc
{
  "type": "notification.created",
  "data": {
    "notification_id": "a91c…",
    "notification_type": "order_paid",     // see the list below
    "unread_count": 3,
    "created_at": "2026-07-31T03:15:00Z"
  }
}
```

The payload deliberately carries **no message text** — copy differs per language and
changes often. Carmen should render its own text from `notification_type`, or call our
notifications endpoint to fetch the full list.

Current `notification_type` values: `order_created`, `order_paid`, `order_rejected`,
`order_expired`, `credits_low`, plus the document events introduced by this feature
(§3.4). We will add to this list over time — **treat an unknown type as "something
happened", not as an error.**

### 3.3 `subscription.activated` / `subscription.lapsed`

This is what tells Carmen whether Email Automation may be switched on for a BU.

```jsonc
{
  "type": "subscription.activated",
  "data": {
    "plan_code": "growth",
    "billing_period": "monthly",           // "monthly" | "annual"
    "doc_allowance": 500,                  // documents per month
    "period_start": "2026-07-31T00:00:00Z",
    "period_end":   "2026-08-30T23:59:59Z",
    "entitlements": { "email_automation": true }
  }
}
```

```jsonc
{
  "type": "subscription.lapsed",
  "data": {
    "plan_code": "growth",
    "ended_at": "2026-08-30T23:59:59Z",
    "entitlements": { "email_automation": false }
  }
}
```

- `activated` fires when a package purchase is approved, and again on each renewal.
- **`lapsed` matters as much as `activated`** — without it Carmen would leave the
  setting switched on after the package ends. It fires from the same daily job that
  closes an expired subscription window on our side.
- `entitlements` is an object on purpose: more features will appear there. Read the key
  you care about and ignore the rest.
- The `entitled` field in `GET /settings` (§2.2) is always authoritative — if Carmen
  ever misses an event, re-reading settings gives the current truth. Please treat the
  webhook as an optimisation, not as the only source.

### 3.4 `document.posted` / `document.failed` — **proposed**

Not in the original request, but with no human approval step these are the only way
Carmen (or the customer) learns what happened to a forwarded document.

```jsonc
{
  "type": "document.posted",
  "data": {
    "document_id": "d41f…",
    "bank_code": "KTC",
    "doc_no": "INV-2026-0001",
    "doc_date": "2026-07-30",
    "total_amount": "12345.67",
    "jv_reference": "…",                   // shape depends on §4
    "posted_at": "2026-07-31T03:16:00Z"
  }
}
```

```jsonc
{
  "type": "document.failed",
  "data": {
    "document_id": "d41f…",
    "reason_code": "tax_id_mismatch",
    "message": "This document belongs to a different company.",
    "credit_refunded": true
  }
}
```

`reason_code` values (stable identifiers; the `message` is display text and may change):
`tax_id_mismatch`, `bank_not_identified`, `mapping_incomplete`, `unbalanced_jv`,
`duplicate_document`, `unreadable_document`, `wrong_pdf_password`, `out_of_credits`,
`carmen_rejected`.

> **Question for the Carmen team:** do you want these, and if so should they also raise
> an in-app notification for the customer, or only feed Carmen's own screens?

### 3.5 What we need to start sending

1. **Endpoint URL** per Carmen host (a staging URL first).
2. **A shared secret per endpoint**, exchanged out-of-band — please do not send it over
   email or chat; we will agree a channel.
3. Confirmation that the receiver responds `2xx` **before** doing its own work
   (accept-then-process), so a slow downstream job does not turn into a retry storm.

---

## 4. Part C — Posting the JV — **settled**

The problem this had to solve: posting a JV to Carmen uses the **logged-in user's Carmen
token**, which lives about 30 minutes. Automatic posting happens on a schedule with nobody
logged in, so a session token cannot be used.

**Decision: Carmen issues a token per BU with no expiry, and we post directly.** It is
minted when the customer switches Email Automation on, delivered through §2.6, and
invalidated when they switch it off. Rotation is the same path — off, then on.

Two properties of that token are what make it acceptable rather than alarming, and both
are decisions Carmen makes at mint time, not features anyone has to build:

- **It is scoped to the BU, not to a person.** It does not carry an employee's identity,
  so it does not die when they leave, and it does not put their name on documents they
  never saw.
- **Carmen's own permission model still applies to it.** It can do what that BU's
  automation needs and no more.

What we do on our side to keep a credential without an expiry date manageable:

| | |
|---|---|
| Stored encrypted, per BU | never returned by any endpoint, never logged |
| Verified before it is stored | a token Carmen rejects never reaches the database (§2.6) |
| Re-verified daily | the only substitute for an expiry — a revocation is otherwise silent |
| Fingerprinted | both sides can name a credential without revealing it |
| Scoped API key on the settings endpoints | one customer's key cannot touch another's credential |

Two things that still need Carmen's side, and are the reason §5 is not empty:

1. **Revocation must actually happen on the OFF switch.** Deleting our copy is not
   revoking; if the OFF switch only updates a flag, the credential outlives the setting.
2. **Mark automated postings in `JvhSource`.** No human saw these documents. Accounting
   needs to tell them apart from wizard postings when reviewing later.

The JV content itself is unchanged from what the wizard posts today
(`JvhSeq/JvhDate/Prefix/JvhSource/Detail[]`), and the GL accounts come from the mapping
the customer has already configured in the OCR app.

**One proposal still open, and it is independent of the above:** *a GL mapping that an LLM
guessed should never post by itself.* Mapping the customer saved is deterministic and can
post untouched; a guessed one should be confirmed once — by the customer — and then saved,
so every later document with that payment type is deterministic too. This is not the
per-document approval step this version deliberately removes: the customer approves a
*rule*, once, and the number of such confirmations falls to zero quickly.

---

## 5. Checklist for the Carmen team

The posting credential is three items, and all three live inside the ON/OFF switch Carmen
is already building:

| # | We need | Blocks |
|---|---|---|
| 1 | **ON** → mint the BU token, `PUT /api/v1/carmen/settings/token` (§2.6) | automated posting |
| 2 | **OFF** → invalidate that token on Carmen's side, then `DELETE` the same route | revocation |
| 3 | The JV endpoint accepts that token | automated posting |

There is no item 4 on the credential. Rotation, liveness checking, fingerprinting and
expiry alarms are all on our side — and **there is no onboarding step at all**: the calls
above authenticate with the token the settings screen already holds (§2.1), so nothing has
to be exchanged between us when a new customer or a new BU appears.

The rest of the integration:

| # | We need | Blocks |
|---|---|---|
| 4 | Webhook endpoint URL + secret exchange channel (§3.5) | both webhooks |
| 5 | Which Carmen field holds the BU tax ID (§2.4) | switching the feature on |
| 6 | Yes/no on the proposed `document.*` events (§3.4) | outcome reporting |
| 7 | Confirmation that automated JVs are distinguishable in `JvhSource` (§4) | audit review |

> Item 7 of the previous revision — "confirm Email Automation is gated on the monthly
> package" — is closed: it is gated, and enforced both at the toggle (`422 not_entitled`)
> and in the ingest loop, so a package lapsing mid-month stops posting rather than only
> blocking the switch.

---

## 6. Out of scope for v1

AP-invoice ingestion by email · per-tenant mailboxes · customer-editable GL mapping from
Carmen's side (it stays in the OCR app) · posting anything other than credit-card
commission / fee documents.
