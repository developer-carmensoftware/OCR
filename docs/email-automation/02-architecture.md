# Architecture

This is the centrepiece of the folder — how the pieces fit together and what happens, in
order, for every flow the feature supports. Diagrams use Mermaid (rendered natively by
GitHub and VS Code's Markdown preview); `docs/Software_Requirements_Specification.md`
already uses the same notation elsewhere in this repo.

## Diagram 1 — component map

```mermaid
flowchart LR
    Bank["Bank"] -->|"commission / fee mail"| CustMbx["Customer's mailbox"]
    CustMbx -->|"auto-forward rule"| Shared["Shared IMAP mailbox\nAIAGENT+tag@carmensoftware.com"]
    Staff["Accounting staff"] -->|"manual forward"| Shared

    Cron["pg_cron"] -->|"POST /email-ingest/run"| API["FastAPI\nrouters/email_automation.py"]
    API --> Ingest["email_ingest_service.run_ingest"]
    Ingest -->|"IMAP FETCH"| Shared
    Ingest -->|"vision LLM call"| Vision["Vision LLM\n(OpenRouter)"]
    Ingest -->|"JV + input-tax post"| Carmen["This BU's Carmen ERP"]

    CarmenScreen["Carmen settings screen"] -->|"PUT/GET /api/v1/carmen/settings*"| API

    Ingest --> DB[("Postgres")]
    DB -.-> T1["email_ingest_settings"]
    DB -.-> T2["email_documents"]
    DB -.-> T3["ocr_tasks / credit_cards"]
    DB -.-> T4["llm_usage_logs"]
    DB -.-> T5["job_runs"]
```

## Diagram 2 — onboarding

The entire customer-facing setup, driven from Carmen's own screen — this app has no UI for
any of it except the internal test surface at `#/email-settings`
(see [Frontend surface](#frontend-surface)).

```mermaid
sequenceDiagram
    participant User as Customer (Carmen screen)
    participant Carmen as Carmen backend
    participant API as OCR API

    User->>Carmen: Turn on Email Automation
    Carmen->>API: PUT /api/v1/carmen/settings/token (Carmen posting credential)
    API->>Carmen: verify_token() — GET /department with it
    API-->>Carmen: 200 token_status (fingerprint, verified_at)
    Carmen->>API: PUT /api/v1/carmen/settings (tax_ids, rules, enabled=true)
    Note over API: save_settings() allocates a fresh ingest_tag<br/>only here, only when none exists yet
    API-->>Carmen: 200 settings body incl. ingest_address
    Carmen-->>User: Show ingest_address, ask to set a mail-forward rule
    User->>User: Configure auto-forward (or forward mail by hand)
```

## Diagram 3 — Settings API auth: proof, not assertion

Every settings call is authenticated with the *customer's own* Carmen token, verified
against that customer's own Carmen — not a key we issue. This diagram is worth reading
closely before touching `_caller`, `_resolve`, or `_safe_carmen_uri`.

```mermaid
sequenceDiagram
    participant Carmen as Carmen (caller)
    participant Router as email_automation.py
    participant Limiter as Rate limiters
    participant DB as Postgres (tenants)
    participant TargetCarmen as Customer's Carmen (target)

    Carmen->>Router: PUT /settings, Authorization header = the raw Carmen token
    Router->>Router: _caller() — not "Bearer " so treat as a Carmen token
    Router->>Router: _token_is_plausible() — shape check, no I/O
    alt fails shape check
        Router-->>Carmen: 401 Malformed Carmen token
    end
    Router->>Limiter: per-IP 20/60s, then global 300/60s
    alt over limit
        Router-->>Carmen: 429
    end
    Router->>DB: resolve_tenant(host from uri, bu)
    alt unknown (host, bu)
        Router-->>Carmen: 400
    end
    Router->>Router: _safe_carmen_uri(tenant) — rebuild origin from tenants.host, SSRF-check it
    Router->>Router: _recently_rejected(token, origin)? — 30s negative cache
    alt recently rejected
        Router-->>Carmen: 401 (no outbound call made)
    end
    Router->>TargetCarmen: GET /Carmen.API/api/interface/department, with the token
    alt Carmen answers 401
        TargetCarmen-->>Router: 401
        Router->>Router: remember_rejection() — cache the "no"
        Router-->>Carmen: 401 re-login to Carmen
    else Carmen unreachable
        TargetCarmen--x Router: timeout / network error
        Router-->>Carmen: 502 transient, retry
    else Carmen answers 200
        TargetCarmen-->>Router: 200
        Router->>Router: proceed — never cache the success
        Router-->>Carmen: 200 settings body
    end
```

Successes are never cached, on purpose — a token Carmen accepts today may be revoked a
minute later, and a stale "yes" would be a security hole. A stale "no" costs nothing: a
real user re-authenticates and gets a different token.

## Diagram 4 — Gmail forwarding handshake

Setting up an auto-forward in Gmail is normally a two-party handshake: Google emails the
*destination* mailbox and asks it to confirm. The destination here is the shared ingest
mailbox, which no customer can open — so without this, it's the one step of an otherwise
self-service setup that needs a support call. The poll completes it instead.

```mermaid
sequenceDiagram
    participant Google as Google (forwarding-noreply@google.com)
    participant Mbx as Shared IMAP mailbox
    participant Poll as email_ingest_service poll
    participant DB as Postgres

    Google->>Mbx: "Gmail Forwarding Confirmation" to AIAGENT+tag@…
    Poll->>Mbx: _fetch_unseen()
    Poll->>Poll: _confirmation_body() — only decoded because From matches Google's sender
    Poll->>Poll: gmail_confirm_link(body) — matches only /mail/vf-… (never /mail/uf-…, which cancels)
    Poll->>Poll: tag_from_recipients() — same tag extraction as any document
    Poll->>Poll: httpx.URL(link).host in {mail-settings.google.com, mail.google.com}?
    alt link absent or host not Google
        Poll->>Poll: drop — never followed off Google
    else host checks out
        Poll->>Google: GET link (302s to an interstitial form)
        Poll->>Poll: check every redirect hop stayed on a Google host
        Poll->>Google: POST the same URL — the click
        alt Google returns < 400
            Poll->>DB: record_gmail_confirmed(tag)
        else Google refuses
            Poll->>Poll: log and continue — never raises
        end
    end
```

Kept for completeness but effectively dead: `gmail_confirm_code()` still parses
`(#123456789)` out of the subject, but measured against four real confirmation mails on
2026-08-07, Google no longer prints one — only the link. `GET /settings` still returns the
`gmail_confirm` field; expect it `null` forever.

## Diagram 5 — one poll

```mermaid
sequenceDiagram
    participant Cron as pg_cron
    participant Router as /email-ingest/run
    participant Ingest as run_ingest()
    participant IMAP as IMAP4_SSL
    participant DB as Postgres

    Cron->>Router: POST /email-ingest/run (Bearer INTERNAL_JOB_TOKEN)
    Router->>Router: require_maintenance_auth
    Router->>Ingest: run_ingest(limit)
    alt IMAP_HOST empty
        Ingest-->>Router: {"status":"disabled"}
    else configured
        Ingest->>IMAP: login, SELECT quoted folder
        Ingest->>IMAP: SEARCH UNSEEN SMALLER max_file_size_mb×1MB
        alt server rejects SMALLER
            Ingest->>IMAP: SEARCH UNSEEN (fallback)
        end
        loop each unseen UID, up to imap_batch_size
            Ingest->>IMAP: FETCH RFC822
            Ingest->>IMAP: STORE +FLAGS \Seen (marked immediately, even if junk)
        end
        Ingest->>Ingest: _process_message() per message — see Diagram 6
        Ingest->>DB: insert job_runs row (job_name="email-ingest")
        alt unrouted >= 5 in this poll
            Ingest->>DB: anomaly_service.open_alert_if_absent("email_ingest_unrouted")
        end
        Ingest-->>Router: {messages, posted, failed, skipped, unrouted}
    end
```

## Diagram 6 — one document, happy path

The exact order from `_run_document()` (`email_ingest_service.py:675`). This ordering is
deliberate — every step before "first charge" is free, and everything before "first LLM
spend" is a database read, not a network call to a model.

```mermaid
sequenceDiagram
    participant Ingest as _run_document()
    participant DB as Postgres
    participant Vision as Vision LLM
    participant GLSuggest as gl_suggestion_service
    participant Carmen as This BU's Carmen ERP

    Ingest->>Ingest: sender_allowed(owner_emails, From/To/Cc)
    Ingest->>Ingest: match_rules(rules, sender, filename)
    Ingest->>Ingest: _open_or_fail() — magic bytes, then this BU's passwords
    Note over Ingest: Everything above this line is free.
    Ingest->>DB: consume_document() — first charge
    Ingest->>DB: create_task()
    Ingest->>Vision: extract_stateless() — first LLM spend
    Vision-->>Ingest: ExtractedCreditCardData
    Ingest->>Ingest: finalize_extraction(), detect_bank_code()
    Ingest->>DB: foreign_tax_id() — second-factor check
    Ingest->>DB: is_duplicate check
    Ingest->>DB: get_accounting_config() — existing GL mappings
    opt payment types with no mapping
        Ingest->>GLSuggest: suggest_fixed_fields() / suggest_payment_types()
        GLSuggest->>Carmen: get_account_codes(), get_departments()
        GLSuggest-->>Ingest: suggested {dept, acc} pairs
        Ingest->>DB: fill_missing_mappings() — saved for next document
    end
    Ingest->>Ingest: build_jv_rows()
    Ingest->>Carmen: post_gljv(payload, carmen_token)
    Carmen-->>Ingest: {Code: 0, InternalMessage: jv_no}
    Ingest->>DB: _mark_submitted() — credit_cards.submitted_at
    Ingest->>Carmen: post_input_tax() — cannot fail the JV above
    Ingest->>DB: _finish(status="posted", ...)
```

## Diagram 7 — gate ladder and the cost boundary

Every exit from `_run_document()`, and the one distinction that matters most: whether a
credit had already been charged when the exit happened. This is the diagram that prevents
the next bug in this feature — get the charged/refund/status triple wrong here and either
a customer is charged for nothing, or a document silently never posts.

```mermaid
flowchart TD
    Start(["Attachment arrives, tag already resolved to a BU"]) --> G1{"sender_allowed?"}
    G1 -- no --> S1["skipped\nsender_not_allowed\nnot charged"]
    G1 -- yes --> G2{"match_rules finds a rule?"}
    G2 -- no --> S2["skipped\nno_rule_match\nnot charged"]
    G2 -- yes --> G3{"file opens?\n(magic bytes + passwords)"}
    G3 -- no, bad bytes / password --> S3["skipped\nunreadable_document / wrong_pdf_password\nnot charged"]
    G3 -- yes --> Charge(["consume_document() — CHARGED"])
    Charge --> Extract["extract_stateless()"]
    Extract --> G4{"foreign_tax_id conflict?"}
    G4 -- yes --> F1["failed\ntax_id_mismatch\nREFUNDED"]
    G4 -- no --> G5{"is_duplicate?"}
    G5 -- yes --> F2["failed\nduplicate_document\nREFUNDED"]
    G5 -- no --> G6{"GL mapping complete\n(incl. AI fill)?"}
    G6 -- no --> F3["failed\nmapping_incomplete\nREFUNDED"]
    G6 -- yes --> G7{"build_jv_rows has\npostable amounts?"}
    G7 -- no --> F4["failed\nunreadable_document\nREFUNDED"]
    G7 -- yes --> G8{"post_gljv succeeds?"}
    G8 -- "Carmen declines (Code != 0)" --> F5["failed\ncarmen_rejected\nNOT refunded — extraction was fine"]
    G8 -- "transport error" --> F6["failed\ncarmen_rejected\nNOT refunded — JV's fate unknown"]
    G8 -- yes --> Posted(["posted\ninput-tax record attempted, cannot fail this"])
    Extract -- "any other exception" --> F7["failed\nunreadable_document\nREFUNDED"]

    style Charge fill:#f5c542,color:#000
    style Posted fill:#5cb85c,color:#000
```

The rule stated once: **pre-charge exits are the customer's own configuration saying "not
this file"**, and file as `skipped` — never `failed`, because a failed row would put a red
line on Carmen's screen for what might just be a signature logo in a forwarded chain.
**A Carmen decline is never refunded**, because the extraction itself was fine — only the
ERP's business rules rejected it. **A transport failure is never refunded**, because the
JV's fate is unknown; refunding could double-post if it actually went through.

## Diagram 8 — ledger state machine

```mermaid
stateDiagram-v2
    [*] --> received: _claim() inserts the ledger row
    received --> posted: JV + input-tax attempted
    received --> failed: charged, then a gate failed
    received --> skipped: a free gate failed, never charged
    posted --> [*]
    failed --> [*]
    skipped --> [*]
```

All three are terminal. There is no retry sweep — `attempts` is always written as `1`
(`ponytail` note, `email_ingest_service.py:35`); a failed document needs a human to
re-forward it, or a retry job to be built when real failure volume justifies it
(see [05-operations.md](05-operations.md#known-gaps--roadmap)).

## Trust model of mail headers

Routing reads three delivery headers plus a `Received:` fallback (`_DELIVERY_HEADERS`,
`_RECEIVED_FOR`, `email_ingest_service.py:119-132`) — **never `To:`**. On an auto-forward,
`To:` is still the *customer's own mailbox address*, not the ingest address, because a
forward preserves the original envelope's display headers. Reading it would route every
real auto-forward nowhere.

`Delivered-To` is not guaranteed either: measured against the live dev mailbox on
2026-08-06, Gmail omits it entirely when sender and recipient are the same account — mail
is accepted at submission and never traverses the inbound MX hop that stamps it. The
`Received: … for <addr>` fallback caught the tagged address in that case. Both sources
share the same trust level: they're written by a mail *server*, not by whoever composed
the message — which is exactly the distinction that keeps `To:`, `From:` and `Cc:` out of
routing and reserves them for the weaker `owner_emails` gate instead.

**The tag is a capability, not a secret to protect at all costs — but it isn't public
either.** Knowing it lets someone attribute a file to that BU; it does not let them post
anything by itself, because the file still has to pass the rule gate, the tax-ID check, and
Carmen's own validation. It's 8 random hex characters, never derived from the BU code, so
it isn't a guessable dictionary attack surface.

## Context propagation

A cron job has no HTTP request, so nothing has populated the ContextVars that
`carmen_service`, `consume_document`, `assert_module_enabled` and `log_llm_usage` normally
read from request middleware. `_process_attachment()` sets `current_tenant_id` and
`current_carmen_uri` itself before calling into the shared pipeline, and resets them in a
`finally` (`email_ingest_service.py:654-672`). Anyone adding a new step to the pipeline that
calls shared service code needs to know these vars exist and are already set — don't thread
`tenant_id` through as an extra parameter where the rest of the codebase reads it from context.

## Two dedupe keys, two different things

| Key | Catches | Where |
|---|---|---|
| `(tenant_id, message_id, attachment)` unique index | The same **mail** processed twice (a re-delivered or re-polled message) | `_claim()`, `email_ingest_service.py:1043` |
| `credit_cards.submitted_at` + partial unique `(tenant, bank_code, doc_no) WHERE submitted_at IS NOT NULL` | The same **document** arriving in two different mails (e.g. forwarded automatically *and* by hand) | `_mark_submitted()`, `email_ingest_service.py:1068`; `is_duplicate` check upstream in `finalize_extraction` |

Both exist because they answer different questions. The ledger key is checked first and is
free; the document key can only be known after extraction, since it depends on the printed
document number.

## Frontend surface

`#/email-settings` (`frontend/src/pages/EmailSettings.tsx`) is an internal test surface, not
a customer-facing screen — per `../CARMEN_INTEGRATION.md §0`, *"the OCR app has no settings
UI for this feature"*; Carmen's own screen is where customers configure it. Three things
about it are deliberate:

- **Not linked from Home** — reachable by URL only (`frontend/src/main.tsx:232-235`,
  explicit comment: *"deliberately not linked from Home while it is a test surface"*).
- **English-only** — `EmailSettings.tsx:14`, *"this is an internal surface"*, unlike the
  bilingual customer-facing purchase flow and admin dashboard.
- **Bypasses `apiFetch`** (`lib/api/emailAutomation.ts:108-128`) — it sends the raw Carmen
  token with no `Bearer` scheme, matching exactly what `_caller()` expects and what Carmen
  itself sends. A 401 here means *Carmen* rejected the token, which the page renders
  inline; going through the shared `apiFetch` would instead treat a 401 as "our own session
  died" and wipe the OCR session.

There is no admin UI at all for this feature — see
[05-operations.md #known-gaps](05-operations.md#known-gaps--roadmap).

## Not built

Outbound SMTP does not exist anywhere in this codebase. `scripts/email_ingest_e2e.py`
constructs an `email.message.EmailMessage` and delivers it with IMAP `APPEND` (so it can
also write a `Delivered-To` header), not SMTP — it is a test fixture, not a send path. The
proposed webhook events in `../CARMEN_INTEGRATION.md §3` (`document.posted`,
`document.failed`) are similarly unbuilt; nothing in this repo issues an HMAC-signed
outbound POST to Carmen.
