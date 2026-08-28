# Data Model

Two tables, both introduced in `supabase/migrations/20260803000000_email_automation.sql`.
ORM in `backend/app/models/email_automation.py`.

## `email_ingest_settings`

One row per BU (`tenant_id` is the primary key). What Carmen wrote through
`PUT /api/v1/carmen/settings` / `.../settings/token`.

| Column | Type | Added by | Meaning |
|---|---|---|---|
| `tenant_id` | `uuid` PK, FK → `tenants(id)` | `20260803000000` | The BU this row belongs to |
| `ingest_tag` | `varchar(32)`, **nullable** | `20260803000000`, dropped `20260805000000`, re-added nullable `20260806000000` | The `+tag` in the ingest address. See [Schema drift](#schema-drift-worth-knowing) below |
| `enabled` | `boolean not null default false` | `20260803000000` | Whether the feature is switched on |
| `enabled_at` | `timestamptz`, nullable | `20260818010000` | The last off→on edge. Mail that arrived before it is `skipped / ingest_paused` instead of replayed — switching off means the BU is keying those documents by hand. Null = no filtering |
| `owner_emails` | `jsonb not null default '[]'` | `20260807010000` | Optional sender allow-list — empty accepts any sender |
| `tax_ids` | `jsonb not null default '[]'` | `20260803000000` | This BU's registered tax IDs — unique across all BUs |
| `rules` | `jsonb not null default '[]'` | `20260803000000` | Bank → filename-pattern rules; `pdf_password_enc` inside each is Fernet-encrypted |
| `carmen_token_enc` | `text`, nullable | `20260803000000` | Fernet-encrypted posting credential |
| `carmen_uri` | `text`, nullable | `20260804000000` | Origin this BU posts to; falls back to `https://<tenants.host>` when empty |
| `carmen_token_fp` | `varchar(16)`, nullable | `20260804000000` | First 8 hex of `sha256(token)` — names the credential without revealing it |
| `carmen_token_verified_at` | `timestamptz`, nullable | `20260804000000` | Last time the token was proven live; cleared (not deleted) on a failed re-check |
| `gmail_confirm_code` | `varchar(32)`, nullable | `20260807000000` | Kept as a fallback; expect `null` — see [06-decision-log.md](06-decision-log.md) |
| `gmail_confirm_at` | `timestamptz`, nullable | `20260807000000` | When a confirmation code was last seen |
| `gmail_confirmed_at` | `timestamptz`, nullable | `20260807020000` | When the poll followed the confirmation **link** and Google accepted it — the real "forward is live" signal today |
| `created_by` / `updated_by` / `created_at` / `updated_at` | via `TimestampMixin` + `WriterMixin` | `20260803000000` | Standard audit columns |

**Index:** `uq_email_ingest_tag` — unique on `ingest_tag` **where `ingest_tag is not null`**
(a partial index, so multiple BUs may simultaneously have no tag yet).

### Schema drift worth knowing

The original migration declared `ingest_tag varchar(32) not null unique`. Three days later,
`20260805000000` dropped the column entirely (a short-lived design that routed on tax ID
alone — see [06-decision-log.md #4](06-decision-log.md)), and `20260806000000` re-added it
**nullable**, with a partial unique index instead of a plain one. The ORM at
`models/email_automation.py:41,69-76` matches the *current* (nullable + partial-unique)
shape — if you're reading only the first migration file, the column looks mandatory when
it no longer is.

## `email_documents`

One row per `(message, attachment)` ever looked at — the seen-message ledger and the audit
trail for every outcome, `reason_code` taxonomy included.

| Column | Type | Meaning |
|---|---|---|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid not null`, FK → `tenants` | |
| `message_id` | `varchar(500) not null` | RFC-822 `Message-ID`, or `no-id-<uid>` when a message has none |
| `attachment` | `varchar(255) not null default ''` | Filename, truncated to 255 chars |
| `status` | `varchar(20) not null default 'received'` | `received` \| `posted` \| `failed` \| `skipped` |
| `task_id` | `uuid`, FK → `ocr_tasks(id)`, nullable | Set once extraction has created a task |
| `bank_code` | `varchar(20)`, nullable | Recorded even on failure — see below |
| `doc_no` | `varchar(100)`, nullable | The document number, once known |
| `jv_no` | `varchar(50)`, nullable | Carmen's JV reference, once posted |
| `reason_code` | `varchar(50)`, nullable | Stable identifier — see the taxonomy below |
| `error_message` | `text`, nullable | Human-readable detail |
| `attempts` | `integer not null default 0` | Always `1` in practice — see [Not built](02-architecture.md#not-built)-adjacent note in 05-operations |

**Indexes:** `uq_email_documents_message` — unique on `(tenant_id, message_id, attachment)`,
**this index is the dedupe**, not a constraint that happens to also prevent duplicates.
`ix_email_documents_tenant_created` on `(tenant_id, created_at desc)`, for the per-BU
document-history read.

`bank_code` and `doc_no` are recorded on failed rows too, deliberately: several BUs failing
on the same issuer at once is the only early warning that a bank changed its report format,
and that pattern is invisible if a failed row forgets which bank it came from.

### Why `email_documents` is its own table

From the migration header (`20260803000000_email_automation.sql:1-8`):

> `ocr_tasks` / `credit_cards` are both created **after** a document credit is charged, so
> a mail that fails earlier (wrong PDF password, no attachment, unknown tag) leaves no
> trace anywhere — and the next poll would pick it up again forever. This table is the
> "we have seen this message" ledger, keyed on the RFC-822 Message-ID.

Concretely: `unsupported_attachment`, `sender_not_allowed`, `no_rule_match`,
`unreadable_document` and `wrong_pdf_password` all happen *before* `consume_document()` — if
the only record of a message were `ocr_tasks`, none of those five outcomes would ever be
written down, and the same doomed attachment would be re-fetched and re-rejected on every
poll indefinitely.

`unsupported_attachment` is the one the migration header named and the code did not raise
until 2026-08-18: a mail whose every attachment was refused (an `.xlsx`, a `.rar`, a `.zip`
of CSVs) left `_process_message` on the same line as a mail carrying no file at all, so
nothing was written anywhere. A message that names **no file at all** is still a free silent
skip — a bank's "your statement is ready" notice must not fill the ledger.

## Relationships

```
tenants ──1:1── email_ingest_settings
tenants ──1:N── email_documents
email_documents ──0:1── ocr_tasks ──0:1── credit_cards
                                              │
                                    submitted_at stamped by
                                    _mark_submitted() after posting
```

`email_documents.task_id` is only set once extraction has run — a pre-charge `skipped` row
has `task_id = null`. Indirectly, a posted row also touches `llm_usage_logs` (the extraction
call), `credit_ledger` (the charge, and any refund), and one `job_runs` row per poll
(`job_name = "email-ingest"`), not per document.

## `reason_code` taxonomy

The single table everything else in this folder points back to — cross-checked against
every raise site in `_run_document()` / `_open_or_fail()` and the three `except` clauses at
`email_ingest_service.py:842-886`.

| `reason_code` | Raised from | Charged first? | Refunded? | Final `status` |
|---|---|---|---|---|
| `unsupported_attachment` | `_attachments()` refused every named part — wrong extension, an empty part, or a `.zip` holding nothing readable | No | — | `skipped` |
| `ingest_paused` | The message arrived before `email_ingest_settings.enabled_at` — the BU had automation switched off and was keying those documents by hand | No | — | `skipped` |
| `sender_not_allowed` | `sender_allowed()` fails | No | — | `skipped` |
| `no_rule_match` | `match_rules()` returns empty | No | — | `skipped` |
| `unreadable_document` | `_open_or_fail()` — bad magic bytes or corrupt PDF | No | — | `skipped` |
| `wrong_pdf_password` | `_open_or_fail()` — every password tried, none worked | No | — | `skipped` |
| `unreadable_document` | `create_task` / `extract_stateless` / `finalize_extraction` threw — **inside the refund boundary** | Yes | **Yes** — the only refund left in the pipeline | `failed` |
| `tax_id_mismatch` | `foreign_tax_id()` finds a conflict | Yes | No | `failed` |
| `duplicate_document` | `extracted.is_duplicate` | Yes | No | `failed` |
| `mapping_incomplete` | GL mapping still missing after the AI-fill attempt | Yes | No | `failed` |
| `unreadable_document` | `build_jv_rows()` produces no postable amount | Yes | No | `failed` |
| `carmen_rejected` | No posting credential, or no Carmen host known for the BU | Yes | No | `failed` |
| `carmen_rejected` | `post_gljv()` returns a non-zero `Code` | Yes | No | `failed` |
| `carmen_rejected` | `CarmenAPIError` — transport/network failure | Yes | No | `failed` |
| *(none)* | Full pipeline completes | Yes | — | `posted` |

The rule, stated once: **the charge follows the vision call, not the outcome.** A pre-charge
exit is the customer's own configuration answering "not this file" and is filed `skipped`.
Once `finalize_extraction` has returned, the model has run and been billed to us, so the
document keeps its charge no matter what happens next — a duplicate, a foreign tax ID, an
unmappable account and a Carmen refusal are all decisions taken *about a document we
successfully read*, not failures to read it.

The single exception is the **refund boundary** in `_run_document()`: the `try` wrapping
`create_task` + `extract_stateless` + `finalize_extraction`. Everything in it can fail
without the model ever running — a dead pool connection, an OpenRouter socket that never
opened — and that is our failure to deliver, so the credit goes back. `_Skip` therefore
carries no refund flag at all; if you find yourself wanting one, the case belongs inside
that boundary instead.

This deliberately matches the wizard, which has always charged for a duplicate:
`finalize_extraction` sets an `is_duplicate` flag rather than raising, so the wizard user
pays for the read and sees the warning. Ingest used to refund the same event, which made
one pipeline disagree with the other about what a document costs.

**Published but not currently raised.** `../CARMEN_INTEGRATION.md §3.3` lists
`out_of_credits`, `bank_not_identified` and `unbalanced_jv` alongside the codes above as the
full contract vocabulary. None of the three appears in the current pipeline: running out of
credits fails earlier, inside `consume_document()`, before a `_Skip` with a `reason_code` is
even constructed; bank identification failing degrades to the generic prompt rather than
stopping; and `build_jv_rows()` either produces a balanced set of rows or none at all (which
is `unreadable_document`). Treat those three as reserved for future use, not as codes a
caller needs to handle today.

## Migration lineage

In order, with the *why* behind each — this sequence is also the fastest way to understand
how the design changed (full narrative in [06-decision-log.md](06-decision-log.md)):

| Migration | What it did |
|---|---|
| `20260803000000_email_automation.sql` | Both tables created |
| `20260804000000_email_carmen_token.sql` | Per-BU Carmen posting credential: `carmen_uri`, `carmen_token_fp`, `carmen_token_verified_at` |
| `20260804010000_credit_cards_submitted_unique.sql` | Partial unique `(tenant_id, bank_code, doc_no) WHERE submitted_at IS NOT NULL` on `credit_cards` — added after the same report, forwarded both automatically and by hand, posted two JVs (found 2026-08-04, docs `RE2026-05269`, JVs 966/967) |
| `20260805000000_email_drop_ingest_tag.sql` | **Dropped** `ingest_tag` — routed on tax ID alone instead (premise: a manual forward "carries no trace of the original recipient" — later found false) |
| `20260805010000_banks_tax_invoice_identity.sql` | `banks.legal_name` / `.tax_id` / `.address` — the issuer identity the input-tax (ACTX) record needs, previously only available to the wizard's frontend constant |
| `20260806000000_email_ingest_tag.sql` | **Re-added** `ingest_tag`, nullable, with a partial unique index; tax ID demoted to a second factor. The reversal that matters most — see decision log |
| `20260807000000_email_gmail_confirm_code.sql` | `gmail_confirm_code`, `gmail_confirm_at` |
| `20260807010000_email_owner_emails.sql` | `owner_emails` — the optional sender allow-list |
| `20260807020000_email_gmail_auto_confirm.sql` | `gmail_confirmed_at` — the real completion signal, once it was found Google no longer prints a code |

## Deliberately not stored

Attachment bytes, message bodies (beyond the ephemeral in-memory read needed to find a
Gmail confirmation link), and extracted line items — all consistent with the wider
"no file storage, extract-and-display" pattern documented in the root `CLAUDE.md`
(*Key Design Decisions* → **No file storage**, **Credit card line items are NOT
persisted**). Only the `credit_cards` header row and this ledger persist.
