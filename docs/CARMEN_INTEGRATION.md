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
                                              OCR ingest (AIAGENT+<tag>@…)
                                                          │
                                 the tag names the BU → the bank rule admits the file
                                        → extract → the tax ID confirms the BU
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
| Which BU it belongs to | **the `+tag` in the address it was sent to** | **the same `+tag`** |
| Where we read that tag | the `Delivered-To` header | the same header |
| Which bank issued it | matched from the sender address | **detected from the document itself** |
| Tax ID on the document | checked against the BU's register | checked the same way |

Four consequences worth stating plainly:

- **The address is what identifies the BU, and it works for both modes.** On an
  auto-forward the tag survives in the delivery headers; on a manual forward the employee
  *types* the destination, so it is whatever Carmen's screen told them to send to. Each BU
  gets its own address — see §2.5.
- **The tax ID is the second check, not the routing key.** The address says who owns the
  mail; the tax ID printed on the document says who owns the document. If they disagree,
  the document is parked rather than posted (§2.4). It costs an LLM call to read, which is
  why it cannot be the thing that identifies the owner in the first place.
- **A document forwarded twice is not charged twice.** If the same report arrives both
  automatically and by hand, the second one is recognised by document number and rejected
  as a duplicate, with the credit refunded.
- **Mail to an address we cannot resolve is dropped before it costs anything** — no LLM
  call, no ledger row, no credit, no JV. There is nobody to report it to either, which is
  the accepted trade (§2.5).

> **DKIM is not checked.** An earlier version of this document said the bank's DKIM
> signature "survives, and we check it" on auto-forwarded mail. It never did, and this
> corrects the record. The signature is broken by a manual forward in any case, so it
> could only ever have covered one of the two modes; the per-BU address now does the work
> it was being credited with. If we implement it later it will be a read of the
> `Authentication-Results` header the receiving mail server stamps, and this section will
> say so.

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

> Nothing needs to be exchanged out-of-band any more. The webhook secret in §3.4 is now the
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
  "entitled": true,                       // active monthly package — authoritative
  "ingest_address": "AIAGENT+a1b2c3d4@carmensoftware.com",  // per BU, null until enabled — §2.5
  "tax_ids": ["0105536000127"],
  "rules": [
    {
      "id": "b3f1…",
      "bank_code": "KTC",                 // null = "Other" (generic prompt + auto-detect)
      "bank_label": null,                 // display name, used when bank_code is null
      "bank_sender_email": "no-reply@ktc.co.th",
      "filename_patterns": ["MDR", "Commission"],  // required, ≥1 — see §2.3
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
      "filename_patterns": ["MDR", "Commission"],  // REQUIRED, at least one
      "pdf_password": "1234",             // write-only: omit = keep, "" = clear
      "is_active": true
    }
  ]
}
```

- The payload **replaces** the BU's rule list (send the full list, not a delta).
- **`filename_patterns` is required and decides whether a document is processed at all.**
  Each entry is a case-insensitive **substring** of the filename (`MDR` matches
  `2026-08_MDR_report.pdf`), and **any one entry matching is enough**. An attachment that
  matches no rule of this BU is **never scanned** — it is recorded in the BU's document
  history with `no_rule_match` and costs the customer nothing.

  Please present this to the user as **"start broad, narrow later"**, which is the
  opposite of how an optional filter is normally presented. `.pdf` accepts every PDF from
  that bank and is the intended escape hatch. It is a list because banks alternate names
  between sends (`MDR_…` one month, `Commission_…` the next) and employees rename files
  before forwarding — one pattern forces a choice that will eventually be wrong.
- A rule is keyed by **`bank_code`**, not by the sender address. Manually forwarded mail
  arrives from an employee, so the issuing bank is detected from the document itself; the
  sender address is only a fast path for automatically forwarded mail. `bank_sender_email`
  may therefore be `null`, and a BU that only ever forwards by hand never has to fill it in.
- **A rule identifies a bank, never a BU.** "`no-reply@ktc.co.th` sends KTC fee invoices" is
  equally true whoever the document belongs to. Ownership is the address's job (§2.5),
  confirmed by the tax ID (§2.4); a rule picks the bank-specific extraction prompt and
  decides whether the attachment is a document at all.
- `pdf_password` is accepted on write, stored encrypted, and **never returned** by any
  endpoint. Reads expose `has_password: true/false` only. Only **this BU's own** passwords
  are ever tried on its files; they are tried in turn because two overlapping rules can
  leave the issuing bank ambiguous.
- A rule matches only when **both** its conditions hold. Mail from KTC's address carrying
  a file that only the BBL rule names is stopped, not scanned as KTC. A sender that matches
  no rule leaves every rule eligible, so manual forwarding (which never carries a bank's
  address) still works.
- **`owner_emails` is an optional second layer, and empty is the default.** Empty accepts
  any sender. Non-empty means a message must carry one of those addresses in `From`, `To`
  or `Cc`, or its attachments are recorded `sender_not_allowed` and never scanned. It is
  **not** the routing key and cannot become one: those three headers are written by
  whoever composed the message, while the `+tag` is written by a mail server (§2.5). What
  it catches is accidents — a personal Gmail forwarding a document, someone outside the
  accounting team — not an attacker who already knows the tag.

  Present it as **"leave empty unless you want it"**, and warn about the one way it bites:
  the two arrival modes put the customer in *different* headers. An auto-forward has the
  mailbox in `To:`; a manual forward has the employee in `From:`. Registering only the
  mailbox refuses every hand-forward, so both belong in the list.
- Supported `bank_code` values: `GET /api/v1/carmen/bank-codes` — the same `banks`
  registry the OCR wizard reads, so a bank added there needs no change here. `null` is
  always valid and means "anything else". A `bank_code` (including `null`) may appear
  in **at most one** rule per BU — `422 duplicate_bank` otherwise.

Errors are returned as `422` with a per-field list so Carmen can render them inline:

```jsonc
{ "errors": [ { "field": "tax_ids[0]", "code": "invalid_checksum",
                "message": "Tax ID checksum does not match" } ] }
```

### 2.4 Tax IDs — required, and why

**The BU's 13-digit tax ID must be set before Email Automation can be switched on.** It is
the **second** of the two signals that decide where a document is posted: the address it
arrived at says who owns the mail (§2.5), and the tax ID printed on the document says who
owns the document.

Two signals exist so that they can disagree. Money in the wrong company's general ledger
is the one failure unattended posting cannot recover from, and no email-level check can
detect it — a correctly-addressed mail can still carry the wrong company's invoice, e.g.
when an employee forwards the wrong message. So:

- A document carrying a tax ID **registered to a different BU** is parked, not posted —
  `reason_code: tax_id_mismatch`, credit refunded.
- A document carrying **no recognised tax ID** still posts. Some fee invoices never print
  the buyer's TIN, and refusing those would break legitimate documents to catch nothing.
  The address already established the owner.

Rules for the value itself:

- Send **all** tax IDs that legitimately appear on this BU's bank documents (several
  branches or legal entities under one BU is fine — it is a list).
- Format: 13 digits, no dashes or spaces. We validate the standard check digit and
  reject a malformed value at write time rather than silently at 3am.
- A tax ID may belong to **only one BU across the whole system**. A second BU claiming
  the same number is rejected with `409` — please surface that error to the user, it
  usually means a copy-paste mistake.
- **A bank's own tax ID is rejected** — `422 reserved_tax_id`. This is not a hypothetical
  mistake: the user is looking at a bank invoice to find "the tax ID", and the bank's is
  printed on the same page, often one line away. Accepted, it would make every document
  that bank issues look like a conflict.
- **We would like Carmen to fill this automatically from its company master** rather
  than asking the user to type it. It is data Carmen already holds, and a typed number
  is a number that can be typed wrong.

> **Request to the Carmen team:** confirm which field in Carmen's company/BU master
> holds the tax ID (and branch, if separate), so we can agree the mapping.

### 2.5 The forwarding address — **settled: one address per BU**

`GET /settings` returns `ingest_address`. Carmen's screen **displays that string** and tells
the customer to forward their bank mail to it. That is the entire integration for this
section — no action needed from Carmen beyond showing the value.

```text
AIAGENT+a1b2c3d4@carmensoftware.com
        └── issued per BU, once, when the feature is first switched on.
            null until then. Do NOT cache it across BUs.
```

**The BU is identified by the tag in the address the mail was delivered to.** It is read
from the message's delivery headers, which costs nothing, so the owner — and therefore the
document credit, the audit row and the cost record — is known **before** anything is read
by a model.

This reverses an earlier decision, and the reasoning is worth recording because it was
wrong on a point of fact. A previous version of this document dropped the per-BU tag on the
grounds that it "only ever worked for auto-forwarded mail, because a manual forward comes
from an employee's own client, which rewrites the recipient". The recipient is indeed
rewritten — **to whatever the employee typed**, which is the address Carmen showed them.
The tag survives a manual forward exactly as it survives an auto-forward. What the tag
actually costs is one longer string to copy.

Routing on the tax ID instead meant every attachment had to be read by the vision model
before anyone was known to own it. That is the cost the tag removes, and it was the larger
one.

Three consequences, all accepted deliberately:

- **Mail to the bare, untagged address is refused.** Nobody is ever shown that address —
  `ingest_address` is `null` until a tag exists — so there is no correct way to arrive
  without one. A mail that does is dropped before any cost.
- **A mistyped tag is silent.** It cannot be attributed to a tenant, so there is nobody to
  tell. The address is copied from Carmen's screen rather than typed, which is the
  mitigation; we watch the volume on our side. If it happens in practice, an auto-reply
  from the ingest mailbox is the obvious next step.
- **A multi-BU group manages one address per BU.** A 20-BU hotel group gets 20 addresses.
  This is inherent to per-BU isolation and is the price of the guarantee in §2.4.

**The tag is a capability, not a secret to protect at all costs, but it is not public
either.** Knowing it lets someone send us a file that will be attributed to that BU; it
does not by itself let them post anything, because the document still has to pass the
bank-rule gate (§2.3), the tax-ID check (§2.4) and Carmen's own validation. It is 8 random
hex characters, never derived from the BU code — a guessable value would be a short
dictionary attack against a customer's ledger.

The value is stable for the life of the BU. **It is never reissued** — not on disable and
re-enable, not after a lapsed package — because the customer's own mailbox rule points at
it, and a new one would make their documents disappear with no error anywhere.

**Gmail's confirmation code — `gmail_confirm`, one more string to display.** Setting up an
auto-forward in Gmail is a two-party handshake: Google mails a code **to the destination**
and it has to be typed back into the customer's own Gmail screen. The destination is our
shared mailbox, which no customer can open — so without help this is the one step of an
otherwise self-service setup that needs a support call.

The confirmation mail arrives at `AIAGENT+<tag>@…` like everything else, so the envelope
already says who is waiting for it. The poll reads the code out of the subject and
`GET /settings` returns it:

```jsonc
"gmail_confirm": { "code": "123456789", "at": "2026-08-07T09:30:00Z" }   // or null
```

Carmen's screen shows it near the forwarding address, the customer pastes it into Gmail,
and nobody opens the shared mailbox. It is `null` when no code is waiting, overwritten by
the next one, and not a log — a confirmation code is single-use and short-lived. Mail from
`forwarding-noreply@google.com` is the only source; the sender is checked as well as the
pattern, because `(#123456789)` is an unremarkable thing for a bank to put in a subject.

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
  "token": "…"                                   // write-only, never returned
}
```

There is no `carmen_uri` field. The origin is always `https://<host>` — `tenants.host` was
itself derived from the URI Carmen sent at login, and the token is validated against that
same origin, so a second field could only ever disagree with the first: verify against one
Carmen, post to another. An old caller still sending one is ignored, not rejected.

**We verify the token against Carmen before storing it** — we call
`GET https://<host>/Carmen.API/api/interface/department` with it, an ordinary authenticated
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

`invalid_uri` means `https://<host>` failed the same SSRF check `/auth/exchange` applies:
https only, no loopback or private address (whether written literally or reached through
DNS), and the host allowlist when one is configured. A `host` that logged in normally
cannot fail it; the gate stays because the origin is a URL we make server-side requests to.

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
  "type": "notification.created",
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
- Ordering is **not** guaranteed. Use `occurred_at` when order matters (e.g. a
  `document.failed` retry arriving after the `document.posted` for the same document).
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
(§3.3). We will add to this list over time — **treat an unknown type as "something
happened", not as an error.**

> **There is no `subscription.*` event, deliberately.** Whether a BU may switch Email
> Automation on is `entitled` in `GET /settings` (§2.2), which Carmen already reads every
> time the settings screen opens — and which this document already declares authoritative
> over any webhook. An event that can only ever agree with a field Carmen is about to read
> is a second source of truth to keep in sync for no gain. The write path enforces it
> anyway: enabling without a live package is `422 not_entitled`, and a package that lapses
> mid-month stops the ingest loop rather than only the switch.

### 3.3 `document.posted` / `document.failed` — **proposed**

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
    "reason_code": "duplicate_document",
    "message": "This document has already been posted.",
    "credit_refunded": true
  }
}
```

`reason_code` values (stable identifiers; the `message` is display text and may change):
`bank_not_identified`, `mapping_incomplete`, `unbalanced_jv`, `duplicate_document`,
`unreadable_document`, `wrong_pdf_password`, `out_of_credits`, `carmen_rejected`,
`tax_id_mismatch`, `no_rule_match`, `sender_not_allowed`.

- **`sender_not_allowed`** — the BU set `owner_emails` (§2.3) and none of them appeared in
  the message's `From`/`To`/`Cc`. Nothing was charged. Expect this when a colleague
  forwards from an address nobody registered.

The other two are worth reading closely, because they are the two ways a document that
*arrived correctly* still does not post:

- **`tax_id_mismatch`** — the document carries a tax ID registered to a different BU (§2.4).
  The address said one owner and the document said another, so it is parked rather than
  posted to either. The credit is refunded. This is the outcome most worth surfacing to the
  customer: it usually means someone forwarded the wrong message.
- **`no_rule_match`** — the attachment matched none of the BU's `filename_patterns` (§2.3),
  so it was never scanned. Nothing was charged. Expect this for every signature logo in a
  forwarded chain, and also when a customer's patterns are too narrow — which is why the
  guidance in §2.3 is "start broad, narrow later".

Mail sent to an address whose tag we cannot resolve produces no event at all: there is no
BU to report it to and nobody has been charged (§2.5).

> **Question for the Carmen team:** do you want these, and if so should they also raise
> an in-app notification for the customer, or only feed Carmen's own screens?

### 3.4 What we need to start sending

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

**GL mapping the customer has not set is filled by AI, and saved.** A BU that never opened
the mapping page in the OCR app would otherwise have every document park at
`mapping_incomplete` — silence, for a feature sold as automatic. So when a payment type or
a fixed field has no mapping, we ask the same suggester the wizard uses (against that BU's
own Carmen account and department master, with Carmen's `DefaultAccount` restrictions
enforced), post with the result, and **write it back to the BU's config**. Only the first
document of a given payment type is a guess; every later one is deterministic.

Two consequences worth stating plainly, because they are the price of not blocking:

- **A guess can be wrong.** The customer sees and corrects the mapping in the OCR app —
  and a correction sticks, because saving never overwrites what they set. A JV already
  posted under a wrong account has to be fixed in Carmen.
- **`mapping_incomplete` still exists**, but only as the fallback for when the suggester
  produced nothing usable or Carmen's master was unreachable — not as a door that stays
  shut until the customer configures something.

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
| 4 | Webhook endpoint URL + secret exchange channel (§3.4) | every webhook |
| 5 | Which Carmen field holds the BU tax ID (§2.4) | switching the feature on |
| 6 | Yes/no on the proposed `document.*` events (§3.3) | outcome reporting |
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
