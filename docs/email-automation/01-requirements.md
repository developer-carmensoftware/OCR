# Requirements

## Problem statement

A hotel's accounting staff receives bank commission and fee reports by email, downloads
each PDF, and uploads it into the Credit Card OCR wizard by hand — one document, one
upload, one review, one submit. Email Automation removes the human step for this document
type: once a mail-forward rule is set up, every report after that is extracted, GL-mapped
and posted automatically.

## Actors

| Actor | Role |
|---|---|
| Bank | Sends the commission/fee PDF, by their own schedule (often daily) |
| Customer accounting staff | Sets up the forward once; may also manually forward individual mails |
| Carmen settings screen | The only UI for this feature — reads and writes settings through our API |
| Shared IMAP mailbox | Receives mail for every BU on the platform, disambiguated by `+tag` |
| pg_cron | Polls the mailbox on a schedule (not yet configured — see [05-operations.md](05-operations.md#scheduling)) |
| The BU's Carmen ERP | Receives the posted JV and the input-tax record, using a credential Carmen itself issued |

## The two arrival modes

Both are supported and behave differently in ways worth knowing before changing the
routing or sender-gate code. Full rationale: `../CARMEN_INTEGRATION.md §0.1`.

| | Auto-forward | Manual forward |
|---|---|---|
| Sender of the mail we receive | The bank | The employee who forwarded it |
| Which BU it belongs to | The `+tag` in the address it was sent to | The same `+tag` |
| Where the tag is read from | `Delivered-To` (or a fallback header) | The same headers |
| Which bank issued it | Matched from the sender address (`bank_sender_email`) | Detected from the document itself, since the sender is the employee |
| Tax ID on the document | Checked against the BU's register | Checked the same way |

A `+tag` survives both modes: on an auto-forward it's stamped by the mail server; on a
manual forward, the employee *types* the destination — whatever address Carmen's screen
showed them — so the tag travels there too. This is why routing is tag-first rather than
content-first; see [06-decision-log.md #4](06-decision-log.md) for the design this replaced.

## Functional requirements

Each is traceable to the code that implements it.

| # | Requirement | Implementation |
|---|---|---|
| FR-1 | The owning BU is identified from the envelope, before any LLM spend | `tag_from_recipients()` (`email_ingest_service.py:300`), `resolve_by_tag()` (`email_settings_service.py:104`) |
| FR-2 | A tax ID printed on the document is checked as an independent second signal; disagreement parks the document rather than picking a winner | `foreign_tax_id()` (`email_settings_service.py:176`) |
| FR-3 | An attachment is only processed if it passes two free gates: the BU's sender allow-list, then its filename rules | `sender_allowed()` (`email_ingest_service.py:419`), `match_rules()` (`email_ingest_service.py:446`) |
| FR-4 | A file is opened (magic-byte check, then this BU's PDF passwords) before anything is charged | `_open_or_fail()` (`email_ingest_service.py:1007`) |
| FR-5 | The same mail is never processed twice, and the same document arriving in two different mails is never posted twice | IMAP `\Seen` + atomic `_claim()` on `(tenant_id, message_id, attachment)`; `credit_cards.submitted_at` stamped post-post (`_mark_submitted()`, `email_ingest_service.py:1068`) |
| FR-6 | Extraction runs through the same pipeline the wizard uses; a GL mapping the BU never configured is filled by AI and saved for next time | `_suggest_missing_mappings()` (`email_ingest_service.py:951`) |
| FR-7 | The GL JV is posted, then the input-tax record; the second can never fail the first | `_post_input_tax()` (`email_ingest_service.py:892`) |
| FR-8 | Every attachment's outcome is recorded with a stable `reason_code`, whether it posted, was skipped, or failed | `_finish()` (`email_ingest_service.py:1094`) — full taxonomy in [04-data-model.md](04-data-model.md#reason_code-taxonomy) |
| FR-9 | Gmail's forwarding-confirmation handshake is completed automatically — no support call needed | `auto_confirm_forwarding()` (`email_ingest_service.py:371`) |
| FR-10 | The feature requires an active monthly package, checked both when the BU switches it on and on every poll (a lapsed package doesn't rewrite settings) | `is_entitled()` gate in `save_settings()` and `_process_message()` |

## Non-functional requirements

- **Cost boundary.** Nothing is charged — no credit, no LLM call, no ledger row beyond the
  claim — until an attachment has passed the sender gate, the rule gate, and the
  file-opening gate. See the gate ladder diagram in
  [02-architecture.md](02-architecture.md#diagram-7--gate-ladder-and-the-cost-boundary).
- **Tenant isolation.** One BU's PDF passwords are never tried against another BU's file —
  the tag establishes ownership before any file is opened (`rule_passwords()`,
  `email_settings_service.py:565`).
- **Secret handling.** PDF passwords and the Carmen posting token are Fernet-encrypted at
  rest, never returned by any endpoint, and identified in logs/support only by a
  fingerprint (first 8 hex of a SHA-256 hash).
- **SSRF protection.** Every outbound request this feature makes (token verification, JV
  posting) targets an origin rebuilt from `tenants.host`, run through the same
  `_validate_uri` check `/auth/exchange` uses — never a raw value from the request payload.
- **Abuse resistance on the unauthenticated probe surface.** A caller with no valid Carmen
  token still costs us a DB read and an outbound HTTP call before being rejected; this is
  bounded by a plausibility pre-check, per-IP and global rate limits, and a 30-second
  negative cache of rejected tokens (`email_automation.py:58-118`).
- **Throughput.** `IMAP_BATCH_SIZE` messages per poll, attachments within a message
  processed serially — a full batch costs roughly `batch_size × (one vision call + two
  Carmen posts)`, which sets a practical floor on the poll interval (≥10 minutes; see
  [05-operations.md](05-operations.md#scheduling)).

## Business rules

| Rule | Why |
|---|---|
| A tax ID belongs to exactly one BU system-wide | A second claim is almost always a copy-paste mistake and would route another company's document into these books — `409` on write |
| A bank's own tax ID cannot be registered by a customer | It's printed on the same invoice the customer is reading to find theirs — `422 reserved_tax_id` |
| `filename_patterns` is required, at least one entry, on every rule | An attachment matching no pattern is never processed — this is not an optional filter |
| At most one rule per `bank_code` (including `null` = "Other") | A rule identifies a bank, never a BU; ambiguity here would mean guessing which prompt to extract with |
| The ingest tag is issued once and never reissued | A BU's mailbox rule points at it forever; reissuing would make their documents vanish with no error |
| `owner_emails` defaults to empty (accept any sender) | "Start broad, narrow later" — a gate nobody asked for that silently refuses real documents is worse than no gate |
| `enabled: true` requires at least one tax ID and an active entitlement | Both are checked at write time so the failure is visible on the settings screen, not silently blocking every future document |

## Out of scope for v1

AP-invoice ingestion by email · per-tenant mailboxes (one shared mailbox serves everyone) ·
retry of a failed document (single pass, ledger records the reason for a human to act on) ·
outbound SMTP (there is no send path in this codebase — see [02-architecture.md](02-architecture.md#not-built)) ·
outcome webhooks to Carmen (`../CARMEN_INTEGRATION.md §3` is a proposal; nothing in it is
built) · posting anything other than credit-card commission/fee documents.
