# Human in the loop

Design for the review step that sits between extraction and the Carmen post, and for
the screen it lives on. **Built and shipped 2026-08-28.** Read §1–§8 as the design, then
§9 and §10 for where the built version now differs from it: §9 is what a customer
requirement changed about the queue on 2026-08-31, §10 what building the review screen
taught us about the review screen the same day.

Read [`02-architecture.md`](02-architecture.md) and [`06-decision-log.md`](06-decision-log.md)
first. This document changes one sentence in each of them: the ledger state machine gains a
non-terminal state, and decision #18's "v2 removed the approval step" becomes "v2 removed it,
v3 put it back under a per-BU switch."

---

## 1. Why

Ingest posts to Carmen with nobody in between. That was the right call for a pipeline
whose whole point was to remove the human, and it is why `CARMEN_INTEGRATION.md` publishes
*"No human approval step"* as a property of the contract.

It is the wrong call for a pipeline nobody trusts yet. A BU switching email ingestion on
today is asked to believe, on day one, that an LLM read their bank statement correctly and
that the GL mapping it guessed is the one they would have picked. The evidence for that
belief arrives only after the JV is already in their books.

So: **review is the default, and a BU turns it off when they have seen enough.** The
automation does not get quieter over time, it gets less supervised.

The second thing this changes is what a user sees when they open the module. Today that is
step 1 of a wizard, which says "your job is to upload documents." The queue says "the robot
already did fourteen of these; two need you." That is the product.

---

## 2. Settled decisions

Every row here was decided in the design session, not inferred.

| # | Decision |
|---|---|
| 1 | **Approve-to-post.** Ingest stops between the gate ladder and `post_gljv`. Nothing reaches Carmen until a human clicks. |
| 2 | **`#/CreditCardOCR` becomes the queue.** Carmen's SSO deep-link is unchanged, so whatever renders there is the first screen. |
| 3 | **Full-depth correction.** Header, line items, GL mapping *and* input tax are all editable in review. |
| 4 | **No approver identity.** There is no users table; `carmen_user_id` is opaque and FK-less. Anyone with a valid session for the BU can approve. Stamp `approved_by`, enforce nothing. |
| 5 | **`auto_post` lives on `email_ingest_settings`**, written through `PUT /api/v1/carmen/settings`, defaulting `false`. |
| 6 | **No Carmen API change.** Same endpoint, same payload, later. Update the doc; no coordinated release. |
| 7 | **Automation and manual are separate pages.** `#/CreditCardOCR` is the queue and only the queue; the wizard moves to `#/CreditCardOCR/manual` unedited. An empty automation page is accepted as the cost, and its not-set-up state is what has to earn it. |
| 8 | **Backlog capped at 50 pending.** Past that, mail is handed back unread via the existing `_HOLD` path and costs nothing. |
| 9 | **Review is one surface, not steps.** Four blocks, all open, in a modal over the queue (revised 2026-08-28 — the first cut collapsed them, and collapsing made the reviewer work for the answer). |
| 10 | **One click posts both documents.** JV then input tax, with a per-document opt-out for the tax post. |
| 11 | **JV posted + tax failed stays `posted`.** Note on the row. No `partially_posted` state. |
| 12 | **No refund on reject.** Decision-log #17 unchanged: the charge follows the vision call. |
| 13 | **Reject is terminal**, with an optional free-text reason. |
| 14 | **Payload persists only while pending**, cleared on approve/reject. |
| 15 | **Approve posts synchronously**, under the BU's stored credential, authed by the session JWT. |
| 16 | **Rows carry a reason line** — the one derived phrase that says why this document might need you. |
| 17 | **Auto-post switch is in a settings popover**, not on the main surface. |
| 18 | ~~**Queue lists email documents only.** A manual scan is something you just did; it is already in Carmen.~~ **Superseded 2026-08-31** — see §9. The page lists both sources; "already in Carmen" is what the Source and JV columns now say out loud. |

---

## 3. The cut

One place in [`email_ingest_service.py`](../../backend/app/services/email_ingest_service.py).
Everything above line 767 is unchanged: the gate ladder still runs in full, still charges,
still auto-fills missing GL mappings, still parks on `tax_id_mismatch` or `mapping_incomplete`
(the latter now parks *for review* rather than failing, with review on — §10 #30).

```python
        if not carmen_uri:
            raise _Skip("carmen_rejected", "No Carmen host known for this BU")

        # ── NEW: the review fork ──────────────────────────────────────────────
        if not auto_post:
            await _park_for_review(ledger_id, extracted, rows, config, bank_code, doc_no, task_id)
            return "pending_review"

        payload = build_gljv_payload(...)
        result = await post_gljv(payload, carmen_token)
```

Why here and not earlier: at this point every cheap rejection has already happened, so a
document that reaches the queue is one a human can actually act on. Parking before the GL
step would fill the queue with documents whose only problem is a missing mapping the AI was
about to fill by itself.

**`carmen_token` and `carmen_uri` are deliberately not persisted.** Approve re-reads them via
`es.posting_target(db, row)`. They rotate, and `sweep_token_health` may have unverified them
while the document sat.

### What must be re-checked at approve time

- **`has_submitted_doc`.** `extracted.is_duplicate` was computed at extraction and is stale by
  definition. A document can be manually keyed into Carmen while it waits.
- **The posting credential.** See above.
- **Tax profiles.** `get_tax_profiles()` is a live call; it comes free.

### Duplicate while parked

`finalize_extraction`'s duplicate check reads `credit_cards.submitted_at`, which stays `NULL`
for the whole review window. A second copy of the same statement extracts, charges, and parks
a second identical row.

Fix on the **ingest side only** — before parking, look for an existing `pending_review` row
with the same `(tenant_id, bank_code, doc_no)` and file the newcomer as
`skipped/duplicate_document`. Not inside `has_submitted_doc`: that function is shared with the
wizard, where a pending row means nothing.

### Backpressure

`_process_message` already reads `email_ingest_settings` per message. Add the pending count to
that read; past `REVIEW_BACKLOG_CAP = 50`, add the tag to `exhausted` and return `retry_later`
exactly as an out-of-credits BU does. Mail is handed back unread, replays on a later poll,
costs nothing, and self-cleans at `IMAP_HOLD_DAYS = 14` into the `beyond_window` alert that
already exists.

---

## 4. Schema

Two columns. Both additive, both nullable or defaulted, no backfill.

```sql
alter table email_documents
  add column review_payload jsonb,          -- null except while pending_review
  add column reviewed_by    varchar(36),    -- carmen_user_id, audit only, no FK
  add column reviewed_at    timestamptz;

alter table email_ingest_settings
  add column auto_post boolean not null default false;

create index ix_email_documents_pending
  on email_documents (tenant_id, created_at desc)
  where status = 'pending_review';
```

`status` stays `varchar(20)`: `pending_review` is 14 characters, `rejected` is 8. Both fit.

**The state machine gains one non-terminal state.** [`02-architecture.md`](02-architecture.md)
diagram 8 needs updating:

```
[*] --> received
received --> pending_review : auto_post = false
received --> posted | failed | skipped
pending_review --> posted   : approved
pending_review --> rejected : rejected
```

### `review_payload` and the no-persistence rule

`CLAUDE.md` says *"Credit card line items are NOT persisted"* and
[`04-data-model.md`](04-data-model.md) lists extracted line items under
**"Deliberately not stored."** This narrows that rule rather than repealing it:

> Line items are not stored **after a document is resolved**. A document waiting on a human
> keeps its payload, because the alternative is a second vision call the customer pays for
> twice.

`_finish` clears `review_payload` to `NULL` on every terminal transition. Update
`04-data-model.md`'s "Deliberately not stored" section in the same PR, or the doc becomes a lie.

Shape — everything the review screen needs, nothing it doesn't:

```jsonc
{
  // ExtractedCreditCardData verbatim, minus raw_text — i.e. exactly what /extract returns.
  // `id` is the credit_cards row, which is what approve needs for _mark_submitted.
  "extracted": { "id": "uuid", "doc_no": "...", "doc_date": "...", "bank_name": "...",
                 "branch_no": "...", "company_name": "...", "tax_ids": [ "..." ],
                 "details": [ { "transaction": "...", "pay_amt": "...", "commis_amt": "...",
                                "tax_amt": "...", "total": "..." } ],
                 "warnings": [ "..." ], "is_duplicate": false },
  "flags":     [ "mapping_guessed", "unbalanced", "warnings" ],  // computed once, at park time
  "unmapped":  [ "WeChat Pay" ],                    // nothing could map these, AI included
  "guessed":   [ "tax", "Mastercard" ],             // which rules the AI chose
  "suggested": { "tax": { "dept": "OPS", "acc": "511300" },   // …and what it chose for them
                 "Mastercard": { "dept": "GEN", "acc": "1130M" } }
}
```

The payload is the **raw extraction shape**, not a hand-built one, because the browser
already knows how to load that: `useOcrExtraction.applyExtractedData` takes a `/extract`
response verbatim. Building a bespoke shape would mean writing a mapping layer on both
sides for no gain. `raw_text` is dropped — bulkiest field, read by nothing, and this row
sits in the database until a human clicks.

`flags` exists so the queue can paint a reason line without loading every payload or resolving
the accounting config per row. `mapping_guessed` is knowable only here — it is whether
`_suggest_missing_mappings` filled anything on the way past. `unbalanced` is arithmetic on
`details` alone. Anything else the review screen can derive live.

`suggested` is the one entry that is not a summary but a **carrier**. Since decision #25
ingest no longer writes its guess to `bu_accounting_mapping_entries` — a human approving is
what does that — so the live config the review screen derives its rows from does not have
these codes and nothing else remembers them. `guessed` is `sorted(suggested)` for any row
written after that; a row parked before it has the names and not the codes, which is exactly
right, because for those rows ingest *did* write to the config and the pickers find them
there. That is also why the review screen seeds its badge list from `guessed` and its picker
values from `suggested`.

**The JV rows are deliberately NOT stored.** An earlier draft of this document stored them;
reading [`AccountingReview.tsx:77-81`](../../frontend/src/components/credit-card/AccountingReview.tsx#L77)
killed the idea. That component derives rows itself with `buildJvRows(details, config)` against
the **live** accounting config every time it renders, which is exactly right for a review
screen: the reviewer must see what would post *now*, not what would have posted at extract
time. Storing rows would mean displaying one thing and having a second, stale copy on disk.

The frontend sends the rows it displayed with the approve call, so what is approved is what
posts. This is the same contract the wizard already has — `AccountingReview`'s `onSubmit(rows)`
hands its own derived rows to `handleSubmitFinal`.

### `SettingsIn.auto_post`

```python
auto_post: bool = False
# ponytail: absent means false, so a Carmen client that predates this field resets the
# flag on every unrelated settings save (PUT /settings is a full replace). Switch to
# `bool | None = None` + merge-on-omit — the idiom `_merge_rule` already uses for
# pdf_password_enc — if a customer reports review turning itself back on.
```

Chosen deliberately over the merge-on-omit variant. The failure mode is real but silent and
recoverable; the customer turns the switch back on.

---

## 5. API

New router `backend/app/routers/email_review.py`, prefix `/api/v1/email`, every route
`Depends(get_current_session)`. **Not** the `_caller`/`_resolve` Carmen-token path in
`email_automation.py` — that exists for Carmen's server calling us; this is our own
authenticated frontend.

| Route | Returns |
|---|---|
| `GET /documents` | `Page[EmailDocumentRow]` for `current_tenant_id`, `status` filter, newest first |
| `GET /documents/{id}` | the row plus `review_payload` |
| `POST /documents/{id}/approve` | `{ header, details, rows, post_input_tax: bool }` → `{ jv_no, tax_note }` |
| `POST /documents/{id}/reject` | `{ reason?: str }` → `204` |
| `GET /settings/auto-post` · `PUT /settings/auto-post` | `{ auto_post: bool }` |

Schemas go in the existing `app/models/schemas/email_automation.py`. `paginate()` and the
`Page[T]` envelope as everywhere else.

### Approve, precisely

```python
# routers/email_review.py — the shape, not the code
async with async_session() as db:
    doc = await _claim_for_approval(db, doc_id, tenant_id)   # SELECT ... FOR UPDATE,
                                                             # refuse if status != pending_review
    token, uri = await es.posting_target(db, settings_row)    # fresh, never persisted

tenant_ctx = current_tenant_id.set(tenant_id)                 # both ContextVars, or
uri_ctx = current_carmen_uri.set(uri)                         # post_gljv has no host
try:
    if await has_submitted_doc(tenant_id, doc_no, doc_date):  # re-check, not the stale flag
        raise DuplicateDocument(...)
    result = await post_gljv(build_gljv_payload(...), token)
    await _mark_submitted(card_id)
    tax_note = await _post_input_tax(...) if body.post_input_tax else None
    await _finish(doc.id, status="posted", jv_no=..., error=tax_note)   # clears review_payload
finally:
    current_carmen_uri.reset(uri_ctx); current_tenant_id.reset(tenant_ctx)
```

Three things that will be got wrong if not written down:

1. **Do not post through `routers/carmen.py:proxy_gljv`.** It reads `session.carmen_token` —
   the *reviewer's* token. An ingested document must post under the **BU's stored credential**,
   or the JV is attributed to whoever happened to open the queue.
2. **Both ContextVars, reset in `finally`.** `post_gljv` reads the host from
   `current_carmen_uri`; `log_llm_usage` reads `current_tenant_id`. This is the same setup
   `_process_attachment` does at lines 591-592.
3. **`SELECT ... FOR UPDATE` on the claim.** Two people in the same BU can have the queue open.
   The second click must find a row that is no longer `pending_review` and say so.

### Notification

Add `document_pending_review` to the existing bell: `TYPE_META` entry (icon `ClockAlert`, tone
`warning`), a switch case, `en` + `th` keys. No migration — `user_notifications` already carries
free-form type strings.

**One notification per ingest run, carrying a count** ("3 documents need review"), not one per
document. A 20-attachment batch must not produce 20 bell rows. Clicking it lands on the queue
rather than opening the detail modal, unlike `document_posted`.

---

## 6. The screen

Design system: [`DESIGN.md`](../../DESIGN.md). Carmen Blue ≤15% of surface, IBM Plex Mono on
anything the user must verify, semantic pill badges, no side-stripe accents, no modal-first,
every table gets a real empty state.

### Two pages, three routes

Automation and manual are separate screens. The landing page is automation; manual is
somewhere you go on purpose.

| Route | Page | What it is |
|---|---|---|
| `#/CreditCardOCR` | **Automation** | The landing page. Carmen's SSO deep-link lands here. The queue, and nothing else. |
| `#/CreditCardOCR/manual` | **Manual scan** | Today's 4-step wizard, moved verbatim. |
| `#/CreditCardOCR/review?id=…` | **Review** | One queued document. Deep-linked from the bell. |

`main.tsx` already string-matches `creditcardocr/mapping` as a sub-route
([`:138-140`](../../frontend/src/main.tsx#L138)), so this is four lines in the existing switch,
not a router.

**The wizard does not change.** The current body of
[`CreditCardOCR.tsx`](../../frontend/src/pages/CreditCardOCR.tsx) — `StepWizard` plus the four
step branches — moves to `pages/ManualScan.tsx` unedited, and `useOcrWizard` is untouched. This
makes the split *cheaper* to build than a single screen that shape-shifts: nothing has to merge.

**The cost, stated plainly.** Every BU today has email ingestion off, so on day one the
automation page is empty for all of them and a manual scan costs one extra click. That is the
price of the clean separation, and the not-set-up state below is what has to earn it. It is
deliberately not solved by redirecting a BU without ingestion straight to the wizard: that hides
the automation from exactly the people who have not discovered it yet.

### Automation — `#/CreditCardOCR`

No `StepWizard` here; there is no step to be on. `AppHeader` keeps `backPath="/glJv"` so Carmen
is still one click away, and gains one action.

**Work waiting.** The default state once a BU is live.

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ Carmen │ ▪ AI JV Automation                    [ 27 docs ] 🌙 │
├──────────────────────────────────────────────────────────────────┤
│  Inbox                            [⚙ Settings]  [+ Manual scan]  │
│  3 waiting for you · 8 posted today                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ⬤ KBANK    31/07/2026   0012345678            ฿48,200.00 ›│  │
│  │   statement_july.pdf · 14 lines · GL mapping guessed       │  │  amber reason
│  ├────────────────────────────────────────────────────────────┤  │
│  │ ⬤ SCB      28/07/2026   0117889900            ฿ 9,140.00 ›│  │
│  │   scb_0728.pdf · 6 lines · nothing flagged                 │  │  tertiary reason
│  ├────────────────────────────────────────────────────────────┤  │
│  │ ⬤ BBL      27/07/2026   —                     ฿12,400.00 ›│  │
│  │   bbl_stmt.pdf · 9 lines · amounts didn't reconcile        │  │  rose reason
│  └────────────────────────────────────────────────────────────┘  │
│                        ‹ 1–3 of 3 ›                              │
└──────────────────────────────────────────────────────────────────┘
```

~~`+ Manual scan` is `.btn-outline`, not `.btn-primary`. On this page the primary action is
approving what the robot already did; scanning by hand is the secondary path, and the button
weight should say so.~~ **Superseded 2026-08-31 (§9)** — it is `Upload documents`, primary.
The reasoning above held while the page was only the robot's inbox; now that it lists manual
scans too, uploading one is a first-class action on it rather than an escape from it.

**All clear.** Ingestion is on, nothing pending. This is where a working BU spends most of its
time, so it must read as success rather than as absence.

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ Carmen │ ▪ AI JV Automation                    [ 27 docs ] 🌙 │
├──────────────────────────────────────────────────────────────────┤
│  Inbox                            [⚙ Settings]  [+ Manual scan]  │
│  Nothing waiting · 8 posted today                                │
│                                                                  │
│                              ✓                                   │
│                     You're all caught up                         │
│                                                                  │
│         Statements forwarded to AIAGENT+ab12@carmen…             │
│         land here for approval before they post.                 │
│                                                                  │
│                    [ Recently posted ▾ ]                         │
└──────────────────────────────────────────────────────────────────┘
```

`Recently posted` expands the last handful of `posted` rows in place — read-only, each with its
JV number. It is the evidence that the automation is working, which is the whole reason this
page exists, and without it "all caught up" is indistinguishable from "nothing ever arrived".

**Not set up.** Every BU today. The one screen allowed to sell, because it is the only place the
feature can be discovered.

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ Carmen │ ▪ AI JV Automation                    [ 27 docs ] 🌙 │
├──────────────────────────────────────────────────────────────────┤
│                                                  [+ Manual scan] │
│                                                                  │
│        ✉   Let statements post themselves                        │
│                                                                  │
│        Forward a bank statement to this address. We read it,     │
│        map it to your GL, and queue it here. Nothing reaches     │
│        Carmen until you approve it.                              │
│                                                                  │
│        ┌──────────────────────────────────────────────┐          │
│        │ AIAGENT+ab12@carmensoftware.com         [⧉] │          │  mono, copyable
│        └──────────────────────────────────────────────┘          │
│                                                                  │
│        ①  Forward it    ②  We read it    ③  You approve          │
│                                                                  │
│        Not switched on yet?  [ Open email settings ]             │
└──────────────────────────────────────────────────────────────────┘
```

Three sub-states hide under "not set up", and they are not the same screen:

| Condition | What changes |
|---|---|
| Entitled, never configured | As drawn. `Open email settings` is the call to action. |
| Configured but `enabled = false` | Address shown, plus *"Forwarding is switched off."* and a switch-on affordance. |
| Not entitled (no active package) | Address hidden, `Open email settings` replaced by the pricing link. Showing an address that cannot receive mail is worse than showing none. |

These map onto the `blockers` vocabulary `build_settings_response` already returns
(`not_configured`, `no_tax_id`, `no_rule`, `disabled`, `not_entitled`) — reuse it rather than
re-deriving state on the client.

**Loading.** `RowSkeleton`s built from the real row markup with content hidden. The header strip
renders immediately; it does not depend on the fetch.

### The row

```
⬤ KBANK   31/07/2026   0012345678                        ฿48,200.00   ▸
  statement_july.pdf · 14 lines · GL mapping guessed
```

- Mono: date, doc no, amount. Proportional: filename, reason line. This is `DESIGN.md`'s Mono
  Signal Rule — mono means "verify this."
- `⬤` is the bank dot, not a status badge. Every row in the list has the same status.
- The **reason line** is one phrase, chosen in priority order: `amounts didn't reconcile` →
  `GL mapping guessed` → `<n> extraction warnings` → `nothing flagged`. With auto-post off most
  parked documents are fine, and the reviewer's real job is finding the two that are not. A row
  that cannot say why it might be wrong makes them open all fourteen.
- **The flags are computed once, at park time, and stored** in `review_payload.flags`. The list
  must not need the accounting config to render a row: `mapping_guessed` is knowable only inside
  `_run_document` (it is whether `_suggest_missing_mappings` filled anything), and recomputing
  `unbalanced` per row per request would mean loading every payload to paint a list.
  `unbalanced` is pure arithmetic on `details` — Σ`PayAmt` vs Σ(`CommisAmt`+`TaxAmt`+`Total`) —
  and needs no config either.
- Amount is right-aligned and is **Σ`PayAmt` from `details`**, the gross, which is what lands on
  the credit side of the JV. Not derived from `rows`: those do not exist until the review screen
  builds them against the live config.

**Reuse, not rebuild.** [`OrderHistory.tsx`](../../frontend/src/pages/OrderHistory.tsx) is the
existing customer-facing list pattern — `AppHeader` + `useFitRows` + `<Pager>` + expandable
`<li>` rows. Follow it, including two lessons it paid for:

- Page size measured off a **fixed-height sub-element** of the row (`useFitRows('.order-row-head', 4)`),
  not the row itself, because an expanded row is arbitrarily tall. Capped at the endpoint's limit.
- The skeleton is **the real boxes with their content hidden** (`visibility`), so it is exactly as
  tall as what replaces it. Guessed pixel heights are what made that page jolt on load
  ([`OrderHistory.tsx:160-163`](../../frontend/src/pages/OrderHistory.tsx#L160)).

`DataTable` is the wrong tool here: its columnar model fights a two-line row, and its
measured-page-size high-water-mark machinery solves a problem this list does not have.

**What the wizard's components give us for free, verified by reading them:**

| Component | Reusable as a review section? |
|---|---|
| [`HeaderCard`](../../frontend/src/components/credit-card/HeaderCard.tsx#L32) | **Yes, unchanged.** Already takes `readOnly`. |
| [`DetailTable`](../../frontend/src/components/credit-card/DetailTable.tsx#L19) | **Yes, unchanged.** Already takes `readOnly`. |
| [`AccountingReview`](../../frontend/src/components/credit-card/AccountingReview.tsx#L30) | **One new prop.** It owns a `form-actions` footer with its own Back / Mapping / Submit buttons (`:300-330`), and the review page owns those. Add `embedded?: boolean` to suppress the footer; everything else — the missing-mapping alert, the imbalance block, the `MISSING` cells, the totals row — is exactly the review logic we want and must not be reimplemented. |

`AccountingReview` also already **blocks submit on an unbalanced JV** (`isImbalanced`, `:102`)
and names the offending line numbers. That is the "amounts didn't reconcile" reason line,
already computed.

### Manual scan — `#/CreditCardOCR/manual`

Today's wizard, unedited. Two differences, both in the chrome:

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ Automation │ ▪ Manual scan                     [ 27 docs ] 🌙 │  ← back to the queue
├──────────────────────────────────────────────────────────────────┤
│  ①─Upload ──── ②─Review ──── ③─Accounting ──── ④─Input Tax      │  ← unchanged
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                  [ UploadSection, unchanged ]                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

`AppHeader` takes `onBack` + `backLabel` instead of `backPath="/glJv"`, so Back returns to the
automation page. Carmen is then two clicks away rather than one, which is the correct ordering:
the automation page is the module's home now.

### Review — a modal over the queue, at `#/CreditCardOCR/review?id=…`

**Revised 2026-08-28 after looking at the built version.** The first cut was a route with
collapsible sections that auto-expanded only when flagged. Two things were wrong with it in
practice, and both were only visible once it existed:

- **Collapsing made the reviewer work for the answer.** Their question is "does this document
  add up", which is answered by seeing all four parts at once — not by remembering which they
  have already expanded. The auto-expand heuristic was solving a problem (too much on screen)
  that a document with four short parts does not have.
- **Leaving the queue to answer it lost the queue.** Approving is a rhythm — open, check,
  post, next — and a full page navigation puts a list re-render between every beat.

So: a modal over the queue, everything open, no disclosure controls at all.

```
┌─ queue, still there behind ───────────────────────────────────────┐
│ ┌───────────────────────────────────────────────────────────┐    │
│ │ KBANK   0012345678   31/07/2026                       [✕] │    │
│ ├───────────────────────────────────────────────────────────┤    │
│ │ Document      0012345678 · 31/07/2026                  ✓  │    │
│ │   [ HeaderCard, editable ]                                │    │
│ │ Lines         14 lines · 48,200.00                     ✓  │    │
│ │   [ DetailTable, editable ]                               │    │
│ │ GL mapping    6 accounts · balanced                    ✓  │    │
│ │   [ AccountingReview, embedded ]                          │    │
│ │ Input tax     Will be recorded                         ✓  │    │
│ │   ☑ Post the input tax record                             │    │
│ ├───────────────────────────────────────────────────────────┤    │
│ │  [ Reject ]                          [ Approve and post ] │    │
│ └───────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
```

Still a **route**, not local state: the bell has to be able to open one document, `OrderHistory`
already establishes the `?id=` convention, and Back closes the modal instead of leaving the app.
`main.tsx` renders `ReviewQueue` for both routes and the queue owns the modal, so opening and
closing a document never refetches the list behind it.

Block-header state vocabulary, using the existing badge semantics:

| Marker | Meaning | Effect |
|---|---|---|
| `✓` emerald | nothing to look at | — |
| `⚠` amber | worth a look, can still post | Approve enabled |
| `⛔` rose | cannot post | Approve **disabled** |

Only the unbalanced-JV case and a missing GL account on a posting row are `⛔`, because those
are the two things `AccountingReview` already refuses to submit
([`:320`](../../frontend/src/components/credit-card/AccountingReview.tsx#L320)). Everything else
is the reviewer's judgement, and the button stays live.

**There is no document preview**, and there cannot be one: attachment bytes are never stored, by
the rule this whole feature had to negotiate once already. Do not add a preview pane here
expecting it to work — storing the PDF is a much bigger decision than storing its extracted
numbers.

Escape and a backdrop click close it, except while a post is in flight: the modal is the only
place the Carmen error is about to appear.

Block bodies reuse the wizard's components — `DetailTable`, and `AccountingReview` with
`embedded` — with one exception. **The document block is its own card** (`ReviewDocCard`),
not `HeaderCard`:

| | `HeaderCard` (wizard) | `ReviewDocCard` (review) |
|---|---|---|
| Fields | 10, in entry order | 6, in the order a person checks a statement |
| Labels | English label + the raw field name under it | one label, uppercase, above the value |
| Fields the reviewer cannot act on | `DateProcessed` (today's date, made up in the browser), `BankName`, `BankCompanyName`, `DocName` | none — the bank and doc type are in the modal header already |
| Empty field | blank input | says *"Not on the document"*, in the amber the block header used |
| Chrome | boxed inputs throughout | flat until hover/focus, so the card reads as the document and becomes a form when someone goes to change it |

`headerData` still carries all ten: `AccountingReview` reads it and approve posts it. They
simply are not things to look at here. The wizard keeps `HeaderCard` unchanged — data entry
and verification are different jobs, and one component doing both is how the review screen
ended up looking like a form to fill in.

### Manual scan — `#/CreditCardOCR/manual`

Today's wizard, unedited. Two differences, both in the chrome:

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ Automation │ ▪ Manual scan                     [ 27 docs ] 🌙 │  ← back to the queue
├──────────────────────────────────────────────────────────────────┤
│  ①─Upload ──── ②─Review ──── ③─Accounting ──── ④─Input Tax      │  ← unchanged
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                  [ UploadSection, unchanged ]                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

`AppHeader` takes `onBack` + `backLabel` instead of `backPath="/glJv"`, so Back returns to the
automation page. Carmen is then two clicks away rather than one, which is the correct ordering:
the automation page is the module's home now.

### Review — `#/CreditCardOCR/review?id=…`

A route, not a modal. `DESIGN.md` reserves modals for destructive or irreversible actions, and
this is neither until the Approve click — but the deciding reason is the bell: a notification
saying "3 documents need review" has to be able to open one, and `OrderHistory` already
establishes the `?id=` deep-link convention
([`:196-200`](../../frontend/src/pages/OrderHistory.tsx#L196)). Back returns to the queue.

**The 80% case — nothing flagged.** Everything collapsed, two clicks from posted. Each section
header carries its own summary, so a collapsed section still answers "is this right?" without
being opened.

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ Back to queue     KBANK · 0012345678 · 31/07/2026    [preview] │
├──────────────────────────────────────────────────────────────────┤
│ ▸ Document      0012345678 · 31/07/2026 · branch 00000        ✓  │
│ ▸ Lines         14 lines · ฿48,200.00                         ✓  │
│ ▸ GL mapping    6 accounts · balanced                         ✓  │
│ ▸ Input tax     ☑ Post input tax record                          │
├──────────────────────────────────────────────────────────────────┤
│  [ Reject ]                        [ Approve and post to Carmen ]│
└──────────────────────────────────────────────────────────────────┘
```

**A document that needs attention.** Only the sections with a problem open, and the section
header states the problem rather than just a warning icon.

```
┌──────────────────────────────────────────────────────────────────┐
│ ‹ Back to queue     BBL · — · 27/07/2026               [preview] │
├──────────────────────────────────────────────────────────────────┤
│ ▾ Document      Document number is missing                    ⚠  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │ Company Name      Doc Date          Doc No                 │ │
│   │ ACME CO., LTD.    31/07/2026 📅     [            ] ← empty │ │  HeaderCard,
│   │ Bank Company      Branch No         Merchant ID            │ │  readOnly={false}
│   │ KASIKORNBANK      00000             0012345678             │ │
│   └────────────────────────────────────────────────────────────┘ │
│ ▾ Lines         Line 4 doesn't add up                         ⚠  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │ Transaction     Pay Amt  Commis   Tax    Total             │ │
│   │ VISA           4,000.00   120.00   8.40  3,871.60          │ │  DetailTable,
│   │ MASTERCARD     2,100.00    63.00   4.41  2,032.59          │ │  readOnly={false}
│   │ JCB            1,500.00 [ 45.00 ]  3.15  1,451.85  ⚠       │ │
│   └────────────────────────────────────────────────────────────┘ │
│ ▾ GL mapping    Unbalanced: Dr 12,400.00 vs Cr 12,355.00      ⛔ │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │ Dept   Acc Code  Account Name      Description   Dr    Cr  │ │
│   │ 1100   510300    Bank charge       …          228.00   —   │ │  AccountingReview
│   │ 1100   ⚠MISSING  —                 …           15.96   —   │ │  embedded
│   │ 1100   110200    Bank - KBANK      …             —  12,156 │ │
│   │                                    TOTAL:  12,400  12,355  │ │
│   │                        [⚙ Mapping settings]  [↻]           │ │
│   └────────────────────────────────────────────────────────────┘ │
│ ▸ Input tax     ☑ Post input tax record                          │
├──────────────────────────────────────────────────────────────────┤
│  [ Reject ]                        [ Approve and post ] disabled  │
└──────────────────────────────────────────────────────────────────┘
```

Section-header state vocabulary, using the existing badge semantics:

| Marker | Meaning | Section behaviour |
|---|---|---|
| `✓` emerald | nothing to look at | collapsed |
| `⚠` amber | worth a look, can still post | expanded, Approve enabled |
| `⛔` rose | cannot post | expanded, Approve **disabled** |

Only the unbalanced-JV case and a missing GL account on a posting row are `⛔`, because those
are the two things `AccountingReview` already refuses to submit
([`:320`](../../frontend/src/components/credit-card/AccountingReview.tsx#L320)). Everything else
is the reviewer's judgement, and the button stays live.

`[preview]` toggles [`SplitLayout`](../../frontend/src/components/common/SplitLayout.tsx) — but
**there is no file to show.** Attachment bytes are never stored, by the rule this whole feature
had to negotiate once already. The toggle is therefore absent on a queued document and present
only on a manual scan. Do not add a document-preview pane here expecting it to work; storing
the PDF is a much bigger decision than storing its extracted numbers.

**Sections auto-expand only when they have a problem.** A document with nothing flagged opens
fully collapsed and is two clicks from posted. This is the whole reason for one page instead of
four wizard steps, and it is a deliberate departure from `DESIGN.md` §6's *"new screens must
integrate with the wizard"* — that rule was written when every screen was a wizard step, and
"current step is always visible" has no meaning for a document that is already extracted. Record
it in [`06-decision-log.md`](06-decision-log.md).

Section bodies reuse the wizard's components rather than reimplementing them: `HeaderCard`,
`DetailTable`, and the mapping controls out of `AccountingReview`.

**Input tax** carries the per-document checkbox, default on. Auto-post mode keeps today's
behaviour and always attempts. Unchecking it is how a reviewer handles a statement whose tax
record they intend to key by hand.

### States

`DESIGN.md` requires all of these; none is optional.

| State | Treatment |
|---|---|
| Loading | `RowSkeleton` built from the real row markup, content hidden by `visibility`. Not a spinner, and not a guessed height. |
| Empty | Two different screens, never one generic one: **all clear** (ingestion on, caught up) and **not set up** (three sub-states off `blockers`). Neither says "no data". |
| Approving | `SwapLabel` busy state on the button, whole panel `inert`. The post is synchronous and Carmen is slow, so this state is visible for seconds, not milliseconds. |
| Approved | Toast with the JV number, back to the queue, row gone. No celebration animation — `PRODUCT.md` bans them for routine actions and this is the routine action. |
| Carmen rejected on approve | Inline error on the panel carrying Carmen's `UserMessage`. Document **stays** `pending_review` so it can be corrected and retried. The one place a failed post is not terminal: the human is right there, which is the entire point of the feature. |
| Input tax failed, JV posted | Toast is still success with the JV number, plus an amber line: *"Input tax record was not created."* Document is `posted` and gone from the queue. It is done; the tax record is a separate errand. |
| Rejecting | `CustomModal` `confirmVariant="danger"` with the optional reason field. Terminal and non-refundable, which is what earns a modal here. |
| Stale — someone else approved it | 409 from the endpoint → toast *"Already handled by someone else"* → back to the queue. Two people in one BU with the queue open is the expected case, not the edge case. |
| Offline / 5xx on the list | Inline retry, not an empty state. An empty list and a failed list must never look the same. |

### i18n

Customer-facing, so bilingual — `en` **and** `th` in `dict.ts` or `dict.test.ts` fails CI.
New namespace `review.*`. Reason-line phrases and reject reasons included.

---

## 7. Deliberately not built

- **No approver roles.** Nothing to hang them on (§2 #4).
- **No re-open of a rejected document.** Re-extracting is what the Manual button is for.
- **No retry sweep.** Unchanged from `01-requirements.md`'s non-goals. Approve is user-triggered;
  a failed approve stays reviewable rather than queueing for a robot.
- **No per-BU input-tax default.** The checkbox is per document; auto-post keeps today's
  behaviour. Add the column if a BU asks for it.
- **No AP invoice.** Email ingest is credit-card only — `_run_document` hardcodes
  `Module.CREDIT_CARD_OCR`.
- **No email to the reviewer.** The bell is the channel. SMTP still has no code in this repo.

---

## 8. Verification

Backend:

1. `pytest backend/tests -k email_ingest` — existing suite must stay green; the fork is behind
   `auto_post`, so every current test runs the auto-post path unchanged.
2. New: park → approve → `posted` with a `jv_no` and `review_payload IS NULL`.
3. New: park → reject → `rejected`, no refund (assert `credit_ledger` unchanged), payload cleared.
4. New: two approves of one document — the second gets a 409, not a second JV.
5. New: 51 pending documents → `_process_message` returns `retry_later` and writes no ledger row.
6. New: duplicate arriving while one is pending → `skipped/duplicate_document`, charged once.

End to end, against the dev mailbox:

1. `auto_post = false`, forward a statement to `AIAGENT+<tag>@…`.
2. `POST /api/v1/carmen/email-ingest/run` → summary reports `pending_review`.
3. Open `#/CreditCardOCR` — row present, reason line correct, bell shows the count.
4. Change a GL account in review, approve, confirm the JV in Carmen carries the *changed* value.
5. Flip `auto_post = true`, forward another — posts without stopping, exactly as today.

6. **The regression check that matters most:** a BU with `enabled = false` opens
   `#/CreditCardOCR`, sees the not-set-up screen, clicks `+ Manual scan`, and completes a scan
   end to end. That path is every existing customer on day one.

Frontend: `npm run contrast` (new tokens, if any), `npm test`, the dark-mode pass on all four
automation states, and `/impeccable audit` on the two new pages before the PR.

Per `CLAUDE.md`: `changelog/<today>.md` in the same commit, a `releaseNotes.ts` entry (this is
user-visible), and a **MINOR** `VERSION` bump — a new user-visible capability.

---

## 9. Amendment 2026-08-31 — the activity table

A customer requirement plus a mockup replaced the queue's shape. It is the same page and the
same review flow; what changed is what the page claims to be.

**Was:** the robot's inbox. Four tabs (Needs review / Posted / Not posted / Skipped), each
holding one status, two-line card rows, the whole row clickable while pending.

**Is:** the module's history. One table, all statuses mixed, a Status pill per row, filter
chips instead of tabs, and an explicit action button only where there is an action.

### What changed, and why

| # | Change | Why |
|---|---|---|
| 19 | **Decision #2 stands; decision #18 falls.** The page lists email documents **and** manual scans. | A `Source` column that says "Email" on every row is not a column. #18's reasoning — "a manual scan is already in Carmen" — is true and is exactly what the row now says, in the Source and JV columns, instead of being a reason to hide it. |
| 20 | **Manual rows are `submitted_at IS NOT NULL` only.** | A draft someone abandoned mid-wizard is not a notification. They were sitting right there. |
| 21 | **`credit_cards.jv_no` is a new column** (`20260831000000`), stamped in `proxy_gljv` from Carmen's `InternalMessage`. | Without it a Manual row cannot link into Carmen the way an Email row does. Nullable, no backfill — scans posted before the migration render `—`, because we genuinely do not know. |
| 22 | **`GET /api/v1/credit-card/activity` is its own router**, not another route on `email_review.py`. | That file's contract is email documents; a manual scan in it would make its own docstring a lie. Approve / reject / detail / status are unchanged and stay there. |
| 23 | **`DataTable` is still the wrong tool** — the note in §6 survives the reshape. | Rows are one line now, so the columnar objection is gone, but its URL-state and measured-page high-water-mark machinery still solve problems this list does not have. A plain `<table>` plus the existing `<Pager>` is smaller. |
| 24 | **The `Function` column from the mockup is not built.** | At Credit-Card-only scope it is 1:1 with `Source` on every row ("Email → Credit Card Commission Tax", "Manual → JV Creation"). Add it the day AP invoice or bank e-Tax joins the table. |
| 25 | **The Actions cell is keyed on `reason_code`, not on `status`.** | Status looks like the natural key and is the wrong one. `status = "skipped" if charged is None else "failed"` is a *billing* split — did we charge a credit before this failed — and says nothing about whether a person can act. Keying on it renders **zero buttons on all 154 rows** of the live dev database, because every customer-clearable cause (`no_rule_match` ×46, `sender_not_allowed` ×8, `wrong_pdf_password` ×5, `ingest_paused` ×2) is filed `skipped`, under the chip #24 above calls "mostly noise". That is the 2026-08-28 `sender_not_allowed` incident in UI form: the fix was one field away and nothing pointed at it. |
| 26 | **A button only where pressing it does something.** | `pending_review` → Review (the modal). `mapping_incomplete` → Fix mapping. The five settings-clearable codes → Open settings. `carmen_unauthorized` → **Reconnect Carmen**, its own word because one expired token fails *every* document of the BU rather than being "a setting that is off". Empty for `carmen_rejected` (Carmen's complaint, fixed in Carmen), `duplicate_document` (nothing owed), `unreadable_document` / `unsupported_attachment` (attachment bytes are never stored, so there is nothing to re-read — the Upload button is the whole answer) and `rejected_by_reviewer` (terminal, #13). A resolved row also has no `review_payload` left, so the mockup's blanket View button would have opened nothing. |

### The one that will get broken

Email ingest calls the same `finalize_extraction` the wizard does, so **every ingested
document also has a `credit_cards` row**. The Manual half of the query is therefore

```sql
NOT EXISTS (SELECT 1 FROM email_documents ed WHERE ed.task_id = credit_cards.task_id)
```

Drop that and one forwarded statement appears twice — once as Email, once as Manual — and
every count on the page is wrong. `test_credit_card_activity_api.py` asserts the predicate
against the compiled SQL, because a mock DB cannot execute it.

### Not changed

The review modal, approve, reject, the backlog cap, the refund rule, the notification, and
every decision #1–#17 above except the two struck through.

---

## 10. Amendment 2026-08-31 (later) — the review screen

§6's four blocks and §9's activity table were built. Using them surfaced two things the
design had wrong about what the review screen is for.

**Nothing on it is unfinished data entry.** `_run_document` suggests and *saves* GL mappings
before a document parks, and a document it cannot map became `failed` and never arrived. So
every field is filled and every rule is live by the time a human sees it. Four equal blocks
(Document / Lines / GL mapping / Input tax) read like four tasks; there is one task, and it
is a comparison. The screen is now two panes — what the document says, and what will post —
with the four reconciliation totals pinned above both.

**The block headers were chrome.** A ✓/⚠/⛔ summarising what is visible one line below makes
the reader find the row themselves. A problem is now marked on the thing that has it.

| # | Decision |
|---|---|
| 27 | **GL rules are editable in the review screen.** Leaving for `#/CreditCardOCR/mapping` lost the document you were reading. That page stays: the wizard uses it, and it owns `filePrefix` / `description` / `fileSource`, which are not per-document decisions. |
| 28 | **A picker edits a rule, not a row.** `buildJvRows` binds each JV row 1:1 to a config key (`JvRow.key`), and two lines of one payment type share a key. There is no per-row identity to hang a per-document override on, so a correction always persists — with the consequence stated before the button and an Undo beside it. The "remember for next time?" checkbox this started with would have needed a shadow config nothing else in the system has. |
| 29 | **`PUT /config/accounting` must never be called from here.** It is a full replace: unconditional column assignment plus `DELETE` + re-insert of every mapping entry. `PUT /config/accounting/mappings` (`set_mappings`) upserts named keys only. `fill_missing_mappings` is not an alternative — it never overwrites, and a correction is an overwrite. |
| 30 | **`mapping_incomplete` parks for review instead of failing**, unless `auto_post` is on. It was terminal because nothing could fix it in place. Reverses the "Fallback, not a closed door" comment at the raise site. |
| 31 | **`review_payload` records `unmapped` and `guessed`.** `mapping_guessed` says a rule was invented, not which — enough for a queue reason line, useless for a badge that has to point somewhere. *(Extended 2026-09-04, §17: `suggested` carries the dept/acc too, because ingest stopped writing them anywhere else.)* |
| 32 | **`JvEditor` is a new component, not `AccountingReview` with a flag.** Same split as `HeaderCard` vs `ReviewDocCard`: data entry and verification are different jobs. `buildJvRows` keeps the arithmetic single-sourced. `AccountingReview`'s `embedded` mode is deleted. |

Decision #9 ("review is one surface, not steps") survives and is what this sharpens: one
surface, but two columns rather than four stacked sections.

---

## 11. Amendment 2026-09-01 — the columns, and which statuses reach the reader

§9 turned the page into the module's history and made `all` the default. §6's heading, its
three empty states and its reason line were all written for the inbox and were never
rewritten, so the page has been telling the reader two different things about what it is.
This settles it in the inbox's favour and reorders the table behind that answer.

### What changed, and why

| # | Change | Why |
|---|---|---|
| 33 | **The page opens on `review`, not `all`.** `all` stays the API default and stays a chip, moved to the end of the strip. | The heading counts `review`, the empty state says "you're all caught up", and the reason line exists to triage a queue. Meanwhile the default view mixed in the rows the BU's own filename rules threw out — 61 of 154 on the dev DB. Every word on the page was written for the work view; only the filter disagreed. |
| 34 | **Source is no longer a column.** It is a ✉/⬆ icon at the head of the filename line, with an `sr-only` word beside it. | `MANUAL_FILTERS = ("all", "success")` means a manual scan can only appear under two of the five chips, so under `review` / `failed` / `skipped` the column read "Email" on every row **by construction**. That is #19's own argument against decision #18, turned back on itself. Provenance is a fact about a row, not something anybody scans a column for. |
| 35 | **Status leads; JV no. and Actions move to the right edge.** Order is now Status · Document · Message · Received · JV no. · Actions. | The pill is what distinguishes one row from the next once statuses are mixed — that is §9's whole premise — and it sat fifth. The two columns that are mostly em dashes (`JV no.` is empty on every non-posted row; Actions renders nothing for six reason codes) cost least at the far right. |
| 36 | **Received prints a time today and a short date otherwise**, with the full stamp on the cell's `title`. | `31/08/2026 14:22` bought 9.5rem to print today's date on every row that matters. Fixed-width columns fell 39.5rem → 28.5rem; `Document` and `Message`, the two cells that were truncating, took the difference. |
| 37 | **`GET /activity` returns `attention` beside `counts`** — same keys, counting the rows under each chip that someone in the BU could clear themselves. The chip renders an amber dot plus an `sr-only` sentence. | #25 established that `status` is the wrong key for actionability (`status = "skipped" if charged is None else "failed"` is a billing split) and fixed the Actions column for it. The chips were left keyed on status, which did not matter while `skipped` was in the default view. Under #33 it is not, so without this the 2026-08-28 `sender_not_allowed` incident has its exact conditions back: fixable rows, nothing pointing at them. `FIXABLE_REASONS` in the router mirrors `FIX` in `QueueRow.tsx`; nothing can assert that across the language boundary, so each names the other. |
| 38 | **`received` gets its own pill word and the `warn` tone**, and `attention` counts one older than `STUCK_AFTER` (1 h). | `received` is the state every row is *claimed* into — the backlog cap writes no ledger row at all — so one still sitting there means the pipeline picked a message up and never finished it. It wore the same calm grey `Skipped · no reason recorded` as a filename rule doing its job. Age is the only thing separating stuck from in flight, because the state carries no `reason_code`. |

### Considered and not done

- **An Amount column.** The gross is a triage signal on the §6 mockup and is not one here:
  the reader confirmed they open the document rather than scan for it. It stays on the
  Document cell's second line.
- **Re-keying the chips by `reason_code`.** The dot answers what #25 identified without
  giving the strip a second vocabulary the API does not speak.
- **§6's `[Recently posted ▾]` panel**, still unbuilt. With `review` as the default the chip
  strip sits directly above the empty state, so `Posted 61` is already the evidence §6 wanted.
  Revisit if a supervisor asks for recency rather than a total.

### Not changed

The review modal, approve, reject, the anti-join, the backlog cap, the refund rule, the
notification, and every decision #1–#32 except where the table above supersedes them.

---

## 12. Amendment 2026-09-02 — what the page claims to be, settled

§11 said it settled the page "in the inbox's favour" and then left §9's history table
underneath. The page went on saying three things about itself at once: the title named a
*mechanism* (`AI JV Automation`), the heading named an *inbox* (`3 waiting for you`), and a
strip of five status chips over a table of every row named a *history*. The Home card that
links to it named a fourth thing and described the wizard one level below it.

Settled by the reader, in six rounds, against the recommendation in four of them:

> The page is **the robot's inbox**, for the credit-card module only, and it exists so that
> the amount of manual work goes down.

Everything below follows from that sentence, and nothing on the page may contradict it.

### What changed, and why

| # | Change | Why |
|---|---|---|
| 39 | **One name, three places.** `AI JV Automation` on the Home card, on the queue and on `#/CreditCardOCR/manual` — same header, same eyebrow, back button reads `Back`. `home.ccDesc` now describes the destination (forward mail → read → approve) instead of the wizard. | The wizard's header used to introduce a differently-named page, and Home sold a scanner to someone about to land in a queue. Which of the two pages you are on is the `StepWizard` directly below the header; that was judged context enough. |
| 40 | **The heading is deleted**, and with it `loadingHeading` / `waitingHeading` / `nothingWaiting` and the `Posting without review` badge. The chip strip moved up into its row. | `3 waiting for you` printed the number the `Needs review` chip already carries two rows below, in a page whose one heading could say nothing true to a BU that posts without review. §6's second clause (`· 8 posted today`) was considered as the fix and rejected by the reader on its own merits: a lifetime total only goes up, so nobody can act on it. |
| 41 | **Five chips become three**: `Needs review` · `Posted` · `Not posted`. `all` survives as an API value and as `counts.all` — it has no chip. | `failed` vs `skipped` is `status = "skipped" if charged is None else "failed"`, a *billing* split, and both words mean "it did not post" to the person reading them. #25 and #37 both diagnosed this and both patched around it. The Message column already names all seven causes, and `all` was an escape hatch from a strip that no longer holds anything back. |
| 42 | ~~**The opening chip follows `auto_post`**: off → `review`, on → `success`.~~ **Superseded by #62 (2026-09-03)** — it falls through `today` → `review` → `success` now, off the counts rather than off configuration. The reasoning below survives intact; it was the *mechanism* that was too narrow. | A BU that has switched review off has an empty `review` chip *for ever* — the end state this whole feature is aimed at would have opened on a permanently empty page saying "All clear", the morning after the robot posted forty documents. Falling through an empty chip answers that, and answers a BU that has merely caught up as well. "Chosen once" survives too: the fall-through runs on the first response only. |
| 43 | **The dot means "something is off", not "you can fix it"** (`_attention`). It now covers every `failed`/`rejected`, the fixable `skipped` reasons as before, stale `received`, and — new — a `posted` row carrying an `error_message`. | The old line excluded `carmen_rejected` and every other failure with no button, so a dot's *absence* meant nothing. The `posted` case is the quietest outcome in the system: the JV reached Carmen, the input-tax record did not, and the row wears the Success pill. Nothing anywhere said so. |
| 44 | **`All clear` is written to be true in both modes**, and the second person is gone from the page. It also serves an empty `Posted`; an empty `Not posted` keeps the plain line. | "…land here for approval before they post" described, to a BU that had turned review off, the exact thing it had stopped doing. An empty pile of failures is not an achievement and does not get the tick. |

### Considered and not done

- **A second heading clause** (`· 8 posted today`, or a 30-day automated-vs-manual ratio).
  Rejected with the heading itself. The ratio is the number that actually measures decision
  #1's goal, and is worth revisiting the day a BU has the volume to make a percentage
  honest — at three documents a month one manual scan moves it 33 points.
- **Re-keying the chips on who-can-act** (`Needs review / Needs a fix / Posted / Nothing to
  do`). It is the split the reader's question really wants, and it costs a vocabulary the
  API does not speak. The dot carries it instead, as in #37.
- **Sorting `unposted` so fixable rows lead.** Rejected in favour of plain time order. The
  consequence is stated plainly: the 2026-08-28 conditions now live *inside* one chip
  rather than being hidden behind one, and the dot plus the Actions column are what point
  at them.
- **Showing the not-set-up pitch to a BU that has manual scans.** `NotSetUp` is still gated
  on `counts.all === 0`, so the BUs doing the most manual work are the ones that never see
  the address again. Raised, and deliberately left: this page does not sell, onboarding
  does. Home (#39) is the surface that carries the pitch.
- **Demoting `Upload documents` to `.btn-outline`**, which §6 specified and §9 overturned on
  reasoning that decision #1 has now retired. Kept primary anyway: today most people arrive
  here to press it, and that fact outranks the definition until email volume passes manual
  volume. Worth re-reading then.
- **The review modal.** Untouched this round, deliberately: it was rebuilt over §10 and
  should be judged against the new queue rather than alongside it.

### Not changed

The anti-join, the backlog cap, the refund rule, the notification, `FIXABLE_REASONS` as the
key to the Actions column, `MANUAL_FILTERS`, and every decision #1–#38 except where the
table above supersedes them.

### Addendum, same day — two numbers that could only go up

Reading §12 back on the built page found the same fault twice, and #43 above had just
introduced the worse half of it.

| # | Change | Why |
|---|---|---|
| 45 | **Only `Needs review` carries a count.** `Posted` and `Not posted` lost theirs. | Backpressure caps pending at 50, so `Needs review` lives in 0–50 and falls as it is worked. The other two are lifetime totals that never fall: at four figures the number is furniture, on screen every day for ever, and nothing anyone can act on. The size of the list is in the `Pager` once the chip is open, which is where it answers something. The old comment's defence — *"a count that disappears makes the strip reflow"* — argued for printing a **zero**, not for the number existing; it still holds on the one chip that has one, and the other two cannot reflow because they never have a number to lose. |
| 46 | **`ATTENTION_WINDOW` = 7 days.** The dot counts anomalies from the last week, not from all time. `counts` stays unwindowed. | #43 widened the dot to cover every failure — and `email_ingest_service.py` says `ponytail: single pass, no retry of a failed document`, with the mail already `\Seen`. A failed row is therefore terminal: fixing the filename rule today does not clear the 46 `no_rule_match` rows behind it. As written, #43's dot would have been lit for ever on any BU that has ever had a bad week, which is a warning nobody reads by the third day — including the day something new breaks. Seven days because these documents arrive monthly: long enough to notice and fix before next month's statement, short enough that the dot means "recently" rather than "ever". The window lives in `_counts_stmt`, asserted against compiled SQL (`test_the_dot_only_looks_at_the_last_week`) because a mock DB executes no date predicate. |

Both are the same rule, and it is worth stating once: **a number on this page has to be able
to go down.** It is what killed §6's `· 8 posted today` (#40) and it is what these two
missed. `counts` is exempt only because it is not presented as progress — it sizes the list
the reader is about to page through, which is why it survives in the `Pager` and not on the
chip.

### Amendment 2026-09-02 (later) — #46 replaced: the dot is put out by a person

`ATTENTION_WINDOW` was a placeholder and said so. Any number of days is a guess about how
long somebody stays interested; what should end the dot is somebody *looking*.

| # | Change | Why |
|---|---|---|
| 47 | **`ATTENTION_WINDOW` is deleted.** `attention` is a lifetime count again, and a new `unseen: dict[str, bool]` decides the dot: true while a chip's anomaly count is above the number this BU has already acknowledged. The mark is one row per tenant in a new **`email_queue_seen`** table, written by `POST /api/v1/credit-card/activity/seen` with the count the *server* computes. | The mark is per **business unit**, not per browser and not per person: the queue is shared, so "has anybody here seen this" is a fact about the BU. `attention` survives beside `unseen` because the two answer different questions — the dot asks whether anything is new, the screen-reader sentence beside it reports the size of the pile. |

**Three designs were tried before this one.** Each is recorded because each looks obviously
right until you check it:

- **A per-browser mark in `localStorage`.** Killed by `clearAppStorage()`, which fires on
  session *expiry* (`AuthContext.tsx:76`), not just logout — sessions die on a 30-minute
  clock, so the mark would be wiped several times a day and the dot relit at every login,
  the exact failure it was built to fix. And a read receipt is the wrong model for a shared
  queue.
- **A per-BU *timestamp* compared against `max(created_at)`** — what the note this replaces
  actually prescribed. It is wrong: `created_at` is when the document **arrived**, not when
  it became anomalous. A document that parks on Monday, gets a mark set on Tuesday and is
  rejected on Wednesday still carries Monday, so the dot never comes back; the same holds
  for a JV that posts without its input-tax record days after arrival, which is the case
  #43 exists to surface. On those the timestamp is strictly worse than the placeholder. A
  count is evaluated at read time and has no such hole.
- **A column on `email_ingest_settings`**, which already has the one row per BU. That row is
  booby trapped: `tags_awaiting_confirmation` gates a **per-minute IMAP sweep** on its
  `updated_at`, and `WriterMixin`'s `before_update` listener stamps `updated_by` on any ORM
  write. A filter-chip click would reopen a mailbox connection and rewrite who last changed
  the BU's email settings. A Core `UPDATE` dodges both and nothing enforces that it keeps
  being used.

**The ceiling, stated.** A high-water count assumes anomaly counts only rise. They do today:
every anomalous status is terminal, a stuck `received` row never resolves (single pass, no
retry), and nothing purges `email_documents`. Add a retry sweep and a count can fall, which
costs exactly one missed dot — the `ponytail:` comment at the write site names a per-chip
timestamp as the upgrade path, and the paragraph above says why it is not the starting
point.

**Not changed:** the three chips (#41), the opening chip following `auto_post` (#42), what
counts as an anomaly (#43), and #45's rule that the only number on a chip is one that can go
down — `attention` is not printed on the strip, only spoken beside the dot.

---

## §13 — Charged means reviewable, and the chips re-keyed on who can act (2026-09-03)

Five pieces of feedback from using the queue. Four are small; one is a defect in the
pipeline's economics that everything else here follows from.

### The defect

The pipeline charges a credit the moment the vision call returns, and `_finish()` nulls
`review_payload` on every terminal transition. So a document that was **read successfully**
and then hit a *decision* gate — a foreign tax ID, a payment type nothing maps, a Carmen
refusal — became a dead red row. The customer paid for an extraction they never got to use,
and the only recovery was to re-scan the same file by hand and pay for it twice.

The rule was already written down, in the refund boundary's own comment: those outcomes are
*"decisions taken about a document we successfully read, not failures to read it."* §10 #30
had already acted on it once, for `mapping_incomplete` alone — *"it was terminal because
nothing could fix it in place; now something can."* This generalises that.

**The criterion, and it decides everything below: did the vision call run, and do we still
have what it returned?**

| | Charged, payload kept | Never charged, or refunded |
|---|---|---|
| Status | `pending_review` | `skipped` / `failed` |
| Chip | `review` | `review` if `FIXABLE_REASONS`, else `unposted` |
| The reviewer can | open, edit every field, post, or Reject | follow the fix link, or Dismiss |

### Decisions

| # | Decision | Why |
|---|---|---|
| 48 | **A post-extraction refusal parks instead of failing.** `tax_id_mismatch`, `duplicate_document`, `mapping_incomplete`, `carmen_unauthorized`, `carmen_rejected`, and a document with no postable amount. | All six were charged, none was a failure to read. `_park_or_finish` is the whole rule. |
| 49 | **Three stay terminal.** The generic `except`; the refund boundary; a second copy of something already queued. | The generic one can fire *after* `post_gljv` succeeded — an Approve button on a JV already in Carmen's books invites a double post. The refund boundary gave the money back, and `extracted` is dropped there before the re-raise so that is true by construction. The duplicate's twin is already in the queue, and two identical rows is what raising it prevented. |
| 50 | **A Carmen transport failure parks, carrying the approve path's own caveat** — *check whether the JV posted before approving this document.* | `_mark_submitted` never ran, so `has_submitted_doc` cannot catch a JV that landed as the socket died. That is the risk the approve path has always taken; the row now carries the warning to the person taking it. |
| 51 | **`auto_post = true` no longer means "post or destroy".** A BU with review off can now accumulate a queue. | The alternative was burning the credit. Parked failures also count toward `REVIEW_BACKLOG_CAP`, so a dead credential stops ingestion — which is the cap working, and those 50 become postable the moment the token is replaced. |
| 52 | **The bell is batched, not per document.** `_park_for_review` notifies nothing; `_notify_pending` raises one extra `document_blocked` per BU per poll when the queue holds anything with a `reason_code`. | A dead credential fails *every* document of the BU — exactly the twenty-row burial `_notify_pending`'s own rule exists to prevent. `document_failed` would now be a lie: the document is waiting, not finished. |
| 53 | **The chips are re-keyed on who can act.** `review` = parked documents **plus** undismissed `FIXABLE_REASONS`; `unposted` = did not post and nothing is owed. | This is the re-key §12 considered and declined — *"it costs a vocabulary the API does not speak."* The API speaks it now: `_chip_expr()` is a SQL `CASE` the list filters on and the counts group by, so a row cannot be counted under one chip and listed under another. Filing the seven clearable causes under the chip §12 itself calls the one nobody works is the 2026-08-28 incident in UI form. |
| 54 | **`dismissed_at`, and one ✕ per row.** | Nothing retries a failure, so fixing the filename rule today never clears the 46 rows behind it — without a way out the chip fills with dead rows until nobody can find the live ones, and #45's rule (a number here has to be able to go down) breaks. Not a soft delete: the row keeps its story under Not posted. Hence no confirmation and no undo. |
| 55 | **Dismiss only on rows with no payload, and only on the Review chip.** | A parked document already has the audited verb — Reject stamps the reviewer and takes a reason — and two ways to retire a real document with different audit trails is worse than one. Elsewhere the row is not in anybody's way, and "stop showing me this" on a history view is an invitation to hide history. |
| 56 | **The migration starts every existing terminal row dismissed, and clears `email_queue_seen`.** | Otherwise the chip's first number after deploy is every historical failure the BU ever had — 54 on dev — and nobody fixes a filename rule for a logo from three weeks ago. The marks go because anomalies move between chips in this release; a stored `{"unposted": 49}` would silence a chip whose real count is near zero while `review` lights against a mark it never had. |
| 57 | **`_attention` stops meaning "there is work here".** `pending_review` counts only rows carrying a `reason_code`; `rejected` and dismissed rows stop counting; `failed` still counts all. | `review` holds work by definition now, so a dot drawn from its size would be lit whenever the feature was doing its job. A reviewer's own rejection is not an anomaly — a signal you set off by doing your job is one you learn to ignore. `failed` keeps counting all because what is left there is a crash or an unhandled bug. |
| 58 | **A fourth chip, `Today`** — every row since midnight ICT, unfiltered, first in the strip. Count, never a dot. | The strip could answer "what is owed" and "what posted, ever", but not "what has the robot been doing today", and every status chip is a lifetime pile. Unfiltered because a day on which forty logos were thrown out is a fact worth seeing. No dot because `unseen` measures against a stored lifetime mark and a number that resets at midnight cannot be. |
| 62 | **The page opens on `Today`, then falls through to `Review`, then to `Posted`** — the first chip that has anything. | #58 first said Today must *not* be the landing chip, because a BU with twelve documents owed must not be shown a quiet morning. Correct, and the wrong fix: it left the opening chip as `auto_post ? success : review`, a guess made from configuration rather than from what is in the queue. Falling through an empty chip answers both — and it is what the `auto_post` rule was reaching for, since review-off makes that chip empty for ever. Costs one extra request on a quiet morning only: every chip's count arrives with the first response, so the fall-through knows where to go rather than trying each in turn, and `loading` stays on across it so no empty table flashes. It runs **once**, so a refresh never throws the reader back to the top and a chip worked down to zero does not move them mid-task. |
| 63 | **An empty `Today` gets the green tick**, not the plain line. | Reverses the same day's call, which was made while Today was not the landing chip. It is now only ever *reached* when Review and Posted are empty as well, so arriving there means the BU genuinely has nothing to do — which is what the tick says. §11's rule against celebrating a non-event still holds for `unposted`, where an empty pile of failures is not an achievement. |
| 59 | **The chip is labelled `Review`, not `Needs review`.** | It holds one status no longer. The shorter word stays true as it widens, and it is the word the Status pill and the row's action button already used. |
| 60 | **A parked document says why it stopped** — the reason outranks every flag on the row, and renders in a banner above the fields in the dialog, with its fix link. | `reasonFor` answers "why this might be worth opening"; a reason code answers "why this got no further", which is the stronger claim on a reviewer's time. The banner carries the pipeline's own message — Carmen's verdict, the conflicting tax ID, the double-post caveat — and it is the only place the reviewer will ever read it. |
| 61 | **The input-tax panel names the tax invoice it files** — `Tax invoice no.` and `Tax invoice date`, read-only. | A VAT claim is filed against a tax invoice and the panel previewing it never said which. They are the JV header's document number and date, which is why they were left off; a reviewer signing off a claim should read the invoice it names rather than reconstruct it. Read-only on this panel's existing test: not a judgement a reviewer can make better, and corrected by fixing the document field it comes from — as `Tax period` beside them already is. |

### Considered and not done

- **A retry sweep.** Unchanged from `01-requirements.md`'s non-goals, and this release is not
  a step toward one: nothing retries anything. What changed is that most of what was being
  retried was never a failure — it was a question, and a person can now answer it.
- **Dismiss on a parked document.** #55. Reject is that verb.
- **Per-cause dismissal** ("dismiss all 46 `no_rule_match`"). The migration clears the
  historical pile in one go and the ongoing rate is a few rows a day, so per-row is enough
  until it demonstrably is not.
- **A dot on Today.** #58.
- **Sorting `review` so documents lead.** Rejected again, as §12 rejected it for `unposted`:
  plain time order, as everywhere else in the app. The two kinds of row are told apart by
  the Message column and by which button they carry.

### The ceiling, stated

`_chip_expr()` is a `CASE` in a `WHERE` clause, which cannot use an index. Correct at this
repo's volumes — the largest business table holds 342 rows
([SQL_PERFORMANCE_AUDIT.md](../SQL_PERFORMANCE_AUDIT.md)) — and the `ponytail:` comment at
the definition names the upgrade path: expand it into three explicit clauses keyed off the
same function, so there is still one place to read.

---

## §14 — Posted and Not posted mean charged; All is the log (2026-09-03, later)

Read back against §13, the strip said two different things about what its words meant.

`Review` had just been re-keyed on **who can act** and was right. `Posted` and `Not posted`
were still keyed on **what happened**, which sounds like the same axis and is not: `unposted`
was the `else_` arm, so it collected everything that was neither posted nor owed — including
the 61 rows (of 154, on dev) the BU's own filename rules threw out before a credit was ever
charged. A signature logo the system refused to read was being reported to the customer as a
document that did not post.

And the escape hatch was gone. §12 #41 removed the `All` chip on the grounds that *"three
chips that between them hold every row"* left nothing to escape from. True then. The moment
`Posted`/`Not posted` narrow to what a credit was spent on, it stops being true, and the
rows that answer *"did my statement even arrive?"* have no chip at all.

**The criterion, and it is the same one §13 used, applied one level out: was this BU charged
for reading it?** `Review` asks a different question — is there an action owed — and outranks
it, so a filename rule somebody can still widen stays in `Review` whether or not it cost
anything.

| | Charged | Never charged |
|---|---|---|
| Posted | `Posted` | — |
| Did not post | `Not posted` | `All` only |
| Action owed | `Review` | `Review` |

### Decisions

| # | Decision | Why |
|---|---|---|
| 64 | **`_chip_expr()` gains a fourth arm, `uncharged`** — `status = 'skipped'`, taken after the `review` arm. It has no chip; `all` is where it is read. | `status` is already the charge marker: `_park_or_finish` writes `status = "skipped" if charged is None else "failed"`, and every other writer of `skipped` is upstream of `consume_document()`. So the split needs no join, no new column and no second vocabulary — the one the billing system already speaks turns out to be the one the reader wanted, just never shown to them. |
| 65 | **`All` is a chip again, last on the strip.** No count, no dot. | It is the module's log, and now the only view holding #64's bucket. Last because nobody arrives asking for everything — it is where you go when a document you expected is in none of the others. No count by #45's rule (a number here has to be able to go down, and a lifetime total never does; the `Pager` prints the size once it is open). No dot because every row under it is counted under a status chip too, so anything wrong with one is already being pointed at — and `mark_chip_seen` refuses to store a mark for it, so a dot there could never be put out. Same reasoning as `today`, which is why `unseen` is now keyed off `STATUS_CHIPS` rather than off `attention` (which does carry an `all` entry). |
| 66 | **A stuck `received` row stays under `Not posted`**, in the `else_` arm. | Its charge is genuinely unknown — the pipeline died between the claim and `_finish` — and it certainly did not post. #38 gave it a pill and a dot precisely because it is the one row that says the machine stopped mid-document; moving it to a chip with no dot would put that signal out. Filed under the chip a person still reads, deliberately, rather than under the criterion. |
| 67 | **Dismiss moves a row out of the status chips, not from `Review` to `Not posted`.** | #54's gesture is unchanged and so is its reason; where the row lands is now the charge. A dismissible row is one with no `review_payload`, and the fixable causes that reach that endpoint without one are all pre-charge skips — so in practice it lands in `uncharged` and `Not posted` never sees it. A charged one would land under `Not posted`, which is equally right, so the endpoint needs no branch. Nothing is destroyed either way: the row keeps its story under `All`. |

### Considered and not done

- **A chip for the never-charged pile** (`Ignored`, `Not a document`). It is a fifth status
  word, which is the vocabulary §12 spent two rounds removing — and the reader asked for the
  log, not for another bucket to learn. `All` holds it at no cost in strip width.
- **`?filter=uncharged`.** The bucket is a `counts` key, not a view. Add it the day somebody
  wants to page through only the noise, which nobody has.
- **Joining `ocr_tasks.charged_docs` to get the charge per row.** The `ponytail:` comment at
  the CASE names it. `status = 'skipped'` gets exactly one row wrong — a crash *inside* the
  refund boundary gives the credit back and still finishes `failed` — and that row is an
  infra failure worth a reader's eye wherever it lands.
- **Re-keying the pill words to match.** The Status column still prints the ledger's own
  vocabulary (`Skipped`, `Failed`, `Unfinished`), which is what the Message column then
  explains. The chips are the reader's question; the pill is the record.

### Not changed

The review modal, approve, reject, the anti-join, the backlog cap, the refund rule, the
notification, `FIXABLE_REASONS`, `MANUAL_FILTERS`, the fall-through (`today` → `review` →
`success`, #62 — `all` is deliberately not in it), the green tick's rule (#63 — restated per
chip by #68 below), and every decision #1–#63 except where the table above supersedes them.

`counts["all"]` does not change value. What changed is which chip a never-charged row is
findable under.

### Addendum, same day — the empty states, which §6 specified and nobody revisited

Adding a fifth chip meant looking at what each one says when it holds nothing, and the
answer was that they all said the same thing. `clearFilter = review || success || today`
sent three chips to one `AllClear` card, so an empty **Posted** read *"All clear · Statements
forwarded to aragent+1ad4e0b6@… appear here"* — which is not what an empty Posted means, and
prints a 40-character identifier mid-sentence to say it. The other two chips fell to a bare
grey `<p>`, so the page had two unrelated empty states as well as one wrong sentence.

§6 wrote *"two different screens, never one generic one"* and the built version had drifted
into one and a half.

| # | Decision | Why |
|---|---|---|
| 68 | **One card, five per-chip states**, from an `EMPTY` map beside `FILTER_LABEL`. The tick stays on `review` and `today`; `success`, `unposted` and `all` get a neutral glyph in a muted well. | The rule §6 and #63 were both reaching for is *the tick is earned*, and a `clearFilter` boolean could not express it once there were five chips. In the map each state's tone sits next to its words, so the two cannot drift. Bare glyph for a semantic colour, glyph-in-a-well for a neutral one, is the convention `orders-empty-icon` already set. |
| 69 | **The ingest address is gone from this screen.** It stays on `NotSetUp`, with the mono field and copy button it always had. | Two branches apart, the same string was a proper field on one screen and unspaced prose on the other. A BU that is receiving mail knows its address; a BU that is not gets the screen built to teach it. Removing it is also what lets each body be *specific* again — the old sentence was vague because it had to be true with `auto_post` on and off, and none of the five replacements names forwarding or approval at all. |
| 70 | **One action: `View all activity`**, when `filter !== 'all'` and `counts.all > 0`. | `DESIGN.md:333` requires an empty state to teach the next step and this one taught none. It is also a real dead end since #65: the dev BU with 101 never-charged rows lands on Today, is told there is nothing, and had no way to reach its own log. Deliberately **not** a second `Upload documents` — that button is primary in the bar directly above, and repeating a primary CTA inside the empty state is what makes a screen read as filler. |
| 71 | **`.rq-empty` loses its shadow**; `.rq-intro` keeps one. | `DESIGN.md:238` — a shadow promises the surface holds something to act on. `NotSetUp` always has a button; an empty chip is mostly a sentence. |

---

## §15 — Auto-post posts what is ready to post (2026-09-04)

§13 asked *"was this BU charged for reading it?"* and §14 applied the same question one level
out, to the chips. This asks it of the switch: `auto_post` was the one place left where the
answer to *"is there anything to say about this document"* was computed, stored, and then
ignored.

### The defect

`_review_flags()` runs on every document. With review on it paints the row's Message column
and a reviewer acts on it. With review off it was written to `review_payload` — a column
`_finish()` immediately nulls, because the document posted — and nobody ever read it.

So a statement whose lines did not reconcile, whose GL rule the AI had invented thirty
seconds earlier, or whose fee VAT was assumed at 7% because the footer could not be read,
reached the customer's ledger with exactly the same silence as a clean one. The system knew.
It had the sentence written down. It filed it and posted anyway.

That is the 2026-08-18 note (*"warnings ถูกเมินตอน auto-post"*), parked at the time. #22
closed one half of that gap — a charged reading is kept for a human instead of being thrown
away. This closes the other: a charged reading is *questioned* before it posts.

**The criterion:** did the pipeline have anything to say about this document? An empty
`_review_flags()` is the whole test, and the row already prints that case as **Ready to
post**.

|  | Nothing flagged | Anything flagged |
|---|---|---|
| `auto_post = true` | posts | **parks** — was: posted |
| `auto_post = false` | parks | parks |

### Decisions

| # | Decision | Why |
|---|---|---|
| 72 | **`auto_post` gates on `_review_flags()` being empty**, not on having reached the fork. The switch decides whether a *clean* document waits; it can no longer decide that a doubtful one does. | A BU turning automation on was being asked to accept an uncertain reading posting silently, which is the bet nobody should have to take to stop approving ordinary documents. The switch now buys what it was always meant to buy. |
| 73 | **The gate is the row's own reason column, not a second rule.** | Two definitions of "worth a human's eye" drift, and the drift is silent in exactly one direction: a document posts behind the back of the person who would have been shown a reason for it. `review.reasonClean` already said *Ready to post* — the words and the rule are now the same test read two ways. |
| 74 | **A fifth flag, `doc_no_missing`.** Ranked below the mapping reasons and above `warnings`, tone `warn`. | The only flag about what we could not *check* rather than what we read. Both duplicate guards key on `doc_no` — `has_submitted_doc` and `_already_pending` answer False without one — so an unnumbered statement forwarded twice posts twice with nothing able to catch it. A flag and not a `_Skip` because a reviewer can post one on purpose: it stops the machine, not the person. |
| 75 | **`REVIEW_BACKLOG_CAP` and `_already_pending` stop reading `not auto_post`.** | Both guards were written when a BU with review off could not park anything. #51 ended that and #72 makes parking routine there, so both had become holes on the main path: an auto-post BU had **no backpressure at all** — a dead credential charging for every document while its queue filled — and a re-sent statement parked a second identical row, which is the thing `_already_pending` exists to prevent. |
| 76 | **The `mapping_incomplete` raise is deleted, not kept for the auto-post half.** | It was the `and auto_post` branch of a condition whose other half already fell through to the fork. `mapping_missing` is a flag, so it parks under both settings — one path, which is what stops the two modes drifting on what the row says. Costs the `reason_code` on new rows; `reasonFor` names the unmapped fields from `review_payload.unmapped`, and on a `pending_review` row Review already outranked the Fix-mapping link. The code stays in `reviewReasons.ts` for rows that already carry it. |

### What a BU will notice

Documents in the queue that used to post silently. That is the feature, and it is the one
support conversation this creates — *"it used to post everything"*. The honest answer is on
the switch itself, which now names what still stops rather than promising that nothing does.

The volume is bounded by how often a reading is imperfect, not by document count: on the
banks measured, all seven `warnings` sites in `credit_card_service.py` are exception paths
(assumed VAT rate, reconciliation drift, negative amounts, no fee lines found), and
`mapping_guessed` fires once per *new payment type* — the guess is saved, so the second
document carrying it is clean and posts.

### Considered and not done

- **A per-BU choice of which flags block.** Five booleans on the settings screen to save a
  clerk one click a month. The flag set is already the ranked list of what is worth a human's
  time; a BU that wants `warnings` to post unattended is a BU that should be told which
  warning, not given a switch to silence the category.
- **Refunding a document that parks under auto-post.** #17 unchanged: the charge follows the
  vision call. It was read; the reading is what parks.
- **Removing `auto_post`.** Considered and rejected in the same session. With the gate in
  place the switch is no longer a bet, and a BU handling a daily commission file should not
  have to press a button for a document nothing can be said about.
- **A `no_doc_no` `_Skip` instead of a flag.** #74.

---

**Considered and not done.** §6's `[ Recently posted ▾ ]` panel (`:365`) is still unbuilt and
still deferred — §12 left it for *"the day a supervisor asks for recency rather than a
total"*, and #70's link answers the same dead end for the price of one button. §6's
`Nothing waiting · 8 posted today` header line stays deleted (#40: a lifetime total only
goes up). And `components/admin/ui/EmptyState.tsx` was not adopted: it is admin-only, its
CSS lives in `admin.css`, its `action` slot has no CSS rule and no call site, and it puts
body copy on `--text-4`, which `DESIGN.md:176` says can never reach AA.

---

## §16 — The row's Actions cell holds one button (2026-09-04, later)

Two changes to the queue table, both subtractions.

### The gross leaves the Document cell

§9's Document cell carried four values on two lines: bank, document number, filename, and —
on pending rows only — the gross appended after a `·`. #33's *"Considered and not done"*
already declined an Amount **column** on the grounds that *"the reader confirmed they open
the document rather than scan for it"*; keeping the figure as a suffix on the filename kept
the cost of the column (a fourth value competing in the cell that was already truncating)
without the benefit it was rejected for lacking. It is in the dialog, in the JV's own total
row, beside the legs it is made of — which is where a number anybody decides on belongs.

### `Details`, and the ✕ goes with it

#54 put the way out of the chip beside the repair: a `Fix mapping` / `Open settings` link,
and a bare ✕ whose only label was a `title`. Two problems, both about the pair rather than
about either control.

- **The ✕ was the smaller target and the bigger action.** It is the one that changes state,
  and it was a 36px icon with no visible word, in a column sized to 10.5rem so the two would
  fit side by side.
- **Side by side they read as a choice between equals**, which #54 itself said they are not
  (*"putting the row away is the lesser of the two things to do with it"*). An icon was the
  compromise; the honest answer is that the cell is the wrong place for two controls.

So the cell holds one `Details` button on the Review chip, and both actions move into a
dialog behind it, where each can carry a full label and the dismiss can say what it costs.

| | |
|---|---|
| Title | *This document did not post* |
| Message | `stopText(row)` — the **same sentence the Message column prints** |
| Body | the attachment name (`.modal-doc`), then `Dismiss this row` + its hint |
| Actions | `[ Close ]` `[ Open settings / Fix mapping / Reconnect ]` |

|  | Decision | Why |
|---|---|---|
| 77 | **`CustomModal`, not a dialog of this page's own.** | It already carries the portal, the scroll lock, focus trap and restore, Escape, and the reduced-motion path. `.rd-modal` is the review screen's, and it is a 64rem work surface — the wrong shape for four lines and three buttons. |
| 78 | **Dismiss is not in the cancel slot.** It is a quiet text button in the body; `Close` takes the slot. | `CustomModal` fires `onCancel` on Escape. A keypress that means *"never mind"* must never be the one that changes something. It also gets the rank right: the repair is what a reviewer came to do, `Close` is the way out of the dialog, and dismiss is what you reach for when the repair does not apply. |
| 79 | **The hint — *"Takes it off this list. The record stays under Not posted."*** | #54 chose no confirmation and no undo, correctly, because nothing is destroyed. That only works if the reader knows it before pressing. The ✕ could not say so; a button in a dialog can. |
| 80 | **`CustomModal`'s focus trap now reads the DOM, not three refs.** | It cycled `[cancel, input, confirm]`, so anything a caller passed in `children` was unreachable by keyboard — Tab from cancel jumped to confirm and Shift+Tab wrapped to it. This dialog is the second caller to hit it; the bell's `Open JV` link was the first, and is fixed by the same change. `tabIndex >= 0` keeps the password-reveal button (`tabIndex -1`) out. |
| 81 | **Off the Review chip the Actions cell is empty.** No dialog, and no repair link either — `RowAction` returns null unless `onDismiss` was passed, which happens on the work chip alone. | The repair belongs to the chip where the row is *work*. `_wants_a_human()` keeps every undismissed fixable row under `review`, so the copy of one appearing under `Today` or `All` was the same row offering the same button a second time — and under `unposted` / `uncharged` a fixable reason means **dismissed** (#67), where a repair button argues with the person who just put the row away. The 2026-08-28 lesson is untouched: the cause is still pointed at, by the chip that carries the amber dot. |

`.rq-c-act` drops 10.5rem → 8.5rem. It now holds one word plus at most a glyph — `Review`,
`Details`, or `Open JV` with its arrow — where before it had to fit the longest repair label
(`Fix mapping`) *and* the ✕ beside it.

### Considered and not done

- **A confirmation on Dismiss.** #54's reasoning is unchanged: nothing is destroyed. The
  hint is the cheaper answer, and it is on screen before the press rather than after it.
- **Naming the button after the repair** (`Open settings` opening a dialog). The label would
  describe something the button does not do. The Message column already names the cause, and
  the dialog's confirm button carries the repair's real word.

---

## §17 — An AI-suggested rule is the BU's rule once a person approves it (2026-09-04, later)

Reported as a copy problem: *"message ที่ว่า GL mapping missing ไม่ควรมีอยู่ แต่ควรจะขึ้นว่า AI
suggest mapping"* — with the model behind it spelled out, and correct: a document whose
mapping is missing goes through the suggester **before** it reaches the queue, so what the
reviewer should be shown is a proposal flagged per row, and that should happen **once per
payment type**, not once per document.

The design was already that. Four things stopped it being true.

### The wording

`review.reasonGuessed` was *"GL mapping guessed"* in EN while TH had said `AI เดาผังบัญชีให้`
since it shipped — the two locales disagreeing about whether the row held a machine's
proposal or a missing value. Now `AI suggested mapping` / `AI แนะนำผังบัญชี`.
`reasonMissingMapping` drops the "GL": the fields are named after the colon and the noun was
carrying nothing.

`mapping_missing` stays. It is the fallback for a payment type the suggester genuinely could
not map, and a document holding one cannot post — removing it moves the refusal to Carmen,
where it arrives as a blank account instead of a sentence.

### The row that said "mapping missing" and meant "your credential is dead"

Decision-log #26. `_suggest_missing_mappings` caught every `CarmenAPIError`, so an expired
posting token — the one that reads the GL master — produced an empty suggestion rather than
an error. 401/403 now re-raises into the handler that already knows what to do with it.

This is the finding recorded on 2026-09-04 as *"a dead posting credential is invisible in the
queue"*, and it is the one that made the complaint reproducible: carmencloud's queue showed
`mapping missing` on documents whose only problem was the token.

### The guess that was saved before anybody read it

Decision-log #25, and the substantive change. `fill_missing_mappings` ran inside
`_run_document`, so the second document carrying that payment type found the rule already
saved, carried no flag, and — with `auto_post` on — posted unattended. The flag was riding on
the *document*, and documents are the thing that differ.

Ingest now keeps the pairs on the ledger row and the review screen's existing
`patchAccountingConfig` call saves them. **The mechanism is entirely `overrides` arriving
pre-seeded**: the screen has written GL rules on approve since it shipped, and it now has
something to write on a document nobody edited. That is what makes "confirmed once per
payment type" literally true rather than a description of the common case.

### The badge the AI's own fill was turning off

`guessed = !changed && guessedKeys.includes(row.key)` where `changed = row.key in overrides`
— but `JvEditor`'s background `suggestPaymentTypes` fill goes through `onOverride` exactly
like a keystroke. So an AI fill rendered as the reviewer's own edit, Undo button and all, and
the ✨ badge worked only for the ingest-time list and only until anything touched the row.

`guessedKeys` is now live state on `ReviewDocument` (`aiKeys`): seeded from `doc.guessed`,
added to when `onOverride` fires with `byUser` false, removed when a person types over the
pick. `JvEditor` reads it directly and derives `changed` as the complement, so the two claims
a row can make — *"check this, a machine chose it"* and *"you changed this, here is the way
back"* — are one decision rather than two that can both be wrong.

### A key that could never match twice

Not part of the report, found underneath it. GHL's line description comes back as three lines
run together with the invoice's own date inside — and that string is the mapping **key**
(`canonical_payment_type`) *and* the JV line's description (`build_jv_rows`). So every
monthly invoice was a brand-new payment type: suggested again, parked again, saved again as a
rule good for one document, with the date and "Gross Amount" going into the customer's books.

`_clean_transaction_labels` takes the first non-empty line and cuts date tokens. It lives in
`finalize_extraction`, **after** the normalizers (they match on the raw label —
`_is_summary_row` reads "TOTAL") and before anything treats the string as a key. Both entry
paths run through there, so the wizard and the pipeline cannot disagree about what the key
is, and neither `cc_jv.py` nor its `ccJv.ts` twin had to move.

Digits otherwise survive, for the reason `_fold` already leaves them alone: this BU has both
`04-4100-03 SiamPay` and `04-4100-04 SiamPay`, one character apart and different accounts.
A label that cleans away to nothing keeps what it had — a blank key is worse than a noisy one.

### Considered and not done

- **A `source` / `confirmed_at` column on `bu_accounting_mapping_entries`**, letting ingest
  keep saving while `_review_flags` flagged until a human confirmed. It buys one thing the
  chosen fix does not — no repeat suggestion call for documents arriving before the reviewer
  — at the price of a migration, a third state on a table with two writers, and junk keys
  still landing in the customer's config. The suggestion is a cheap text-model call.
- **`mappings` on `ApproveIn` + `fill_missing_mappings` after `post_gljv`.** Better on
  ordering: a rule confirmed by a JV that actually went through, rather than by a click that
  Carmen might still refuse. Rejected because it is a *second writer* of the same table on
  the same click, and the two would drift on the additive-vs-overwrite split that already
  separates `fill_missing_mappings` from `patch_config`. If the ordering ever bites — a
  reviewer approves, Carmen refuses for a closed period, and the rule is saved anyway — this
  is the fix, and it is small.
- **Cleaning the junk keys already in `bu_accounting_mapping_entries`.** Nothing new lands
  there now. Removing what is there is a SQL errand against live customer config, not a code
  change, and it wants somebody to look at the list first.
