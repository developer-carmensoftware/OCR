# Human in the loop

Design for the review step that sits between extraction and the Carmen post, and for
the screen it lives on. Nothing here is built yet.

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
| 18 | **Queue lists email documents only.** A manual scan is something you just did; it is already in Carmen. |

---

## 3. The cut

One place in [`email_ingest_service.py`](../../backend/app/services/email_ingest_service.py).
Everything above line 767 is unchanged: the gate ladder still runs in full, still charges,
still auto-fills missing GL mappings, still parks on `tax_id_mismatch` or `mapping_incomplete`.

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
  "flags":     [ "mapping_guessed", "unbalanced", "warnings" ]  // computed once, at park time
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

`+ Manual scan` is `.btn-outline`, not `.btn-primary`. On this page the primary action is
approving what the robot already did; scanning by hand is the secondary path, and the button
weight should say so.

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
