# Decision Log

ADR-style record of what was decided, why, what it cost, and — where relevant — what was
tried first and reverted. Sourced from migration headers, service docstrings, and the
changelog (2026-07-31 through 2026-08-11). Read this before proposing a design that looks
obviously better than the current one; several of the current choices are the *second*
attempt, and the first attempt's failure mode is recorded here so it doesn't get repeated.

## 1. Inbound transport is IMAP polling

**Decided:** 2026-07-31. **Not:** a webhook, not the Gmail API.

A shared mailbox is free storage that fits the project's no-file-storage rule (nothing is
ever written to disk — the mailbox holds the message, not us), needs no DNS change per
customer, and needs no OAuth consent flow per customer's mail provider. Revisit trigger:
Google Workspace's forwarding volume ceiling, if it's ever hit.

## 2. A poll loop behind an endpoint, not a worker process

pg_cron already calls FastAPI endpoints with the internal job token for every other
scheduled job in this codebase (`backend/app/routers/admin/maintenance.py` and friends).
One mailbox does not need a message broker or a long-running worker; `run_ingest()` is a
plain async function a cron-triggered HTTP call invokes.

## 3. One shared mailbox, one `+tag` subaddress per BU

Not one mailbox per tenant. A single mailbox is one thing to provision, monitor and secure;
Gmail/most providers support unlimited `+tag` subaddresses on one account for free, so this
costs nothing extra per BU while still giving each BU an address of its own.

## 4. Routing on the tag — reverted to tax-ID-only — reverted back

The single most expensive mistake in this feature's history, worth reading in full because
the reasoning that caused it looked sound at the time.

**v1 (2026-08-03):** route on the `+tag`.

**Reverted 2026-08-05** (`20260805000000_email_drop_ingest_tag.sql`): the premise was that
a `+tag` "only ever worked for auto-forwarded mail, because a manual forward comes from an
employee's own client, which rewrites the recipient." Routing moved to the tax ID printed
on the document instead — already required, already unique per BU.

**What that cost:** the tax ID is only readable by running the vision LLM. Every attachment
reaching a deliberately-public mailbox address was now extracted *before* anyone was known
to own it — unbounded spend with no attribution, and no `llm_usage_logs` row could even be
written for any of it (`llm_usage_logs.tenant_id` is `NOT NULL`, so a tenant-less call
couldn't be logged at all). One OCR-derived signal became the *only* thing standing between
a document and a company's general ledger.

**Restored 2026-08-06** (`20260806000000_email_ingest_tag.sql`), because the premise was
simply wrong: on a manual forward, the employee *types* the destination address — whichever
one Carmen's screen told them to send to. The recipient is rewritten, yes, but rewritten to
the tagged address, not stripped of it. The tag survives a manual forward exactly as it
survives an auto-forward; the entire cost was one longer address to copy. Tax ID was kept,
demoted to an independent second-factor check rather than the routing key — see #6.

## 5. Ingest tag: random 8-hex, never derived, never reissued

Not derived from `bu_code`, for three separate reasons that each independently rule it out:

- **Not unique.** Tenant identity is `(host, bu_code)`; two different customers each having
  a BU called `hq` is ordinary, and a unique index on a derived tag would reject the second
  customer outright.
- **Guessable is a bypass.** With the bare untagged address refused, the tag *is* the
  authorization to attribute mail to a BU. `hq` / `bkk01` / `head-office` is a short
  dictionary; 8 random hex characters is not.
- **Derived values drift.** `tenants` is upserted on `(host, bu)` at login, so a BU renamed
  on Carmen's side would silently change a derived address while the customer's mailbox
  rule still pointed at the old one.

Never reissued for the same reason across a different axis: the customer's own mail-forward
rule points at the tag, so a new one would make their documents vanish with no error
anywhere — including across disable → re-enable and a lapsed-then-renewed package.

## 6. Two signals, and disagreement parks the document rather than picking a winner

The envelope tag routes (who the mail is *addressed to*); the printed tax ID verifies (who
the *document* says it belongs to). They exist to be able to disagree — money in the wrong
company's ledger is the one failure unattended posting can't recover from, and no
envelope-level check alone can catch "an employee forwarded the wrong message to the right
tag." Positive evidence only: a document with **no** recognized tax ID still posts, since
some fee invoices never print the buyer's TIN and refusing those would break legitimate
documents to catch nothing.

## 7. Auth is the customer's own Carmen token — no API key

Replaced an earlier scoped-API-key design (changelog, 2026-08-04). Every customer runs
their own Carmen installation, so an API key model means one key per installation, handed
over out of band, stored in a secret manager, redone for every new customer — unbounded
manual work, forever. Reusing the token the logged-in user's own Carmen session already
holds means the 101st customer needs no action from anyone on either side. It also
eliminates a class of bug: `uri`/`bu` in the payload stop being a claim that needs checking
and become the thing the token is *proven against* — see
[02-architecture.md — Diagram 3](02-architecture.md#diagram-3--settings-api-auth-proof-not-assertion).

## 8. `host` → `uri`

**Breaking change, 2026-08-10.** The Settings API used to take a bare `host`; it now takes
the full origin `uri`, the same value Carmen already sends to `/auth/exchange`, and derives
the hostname from it. One spelling for Carmen to pass around instead of two.

## 9. Posting credential is per-BU, no expiry, verified at write and re-verified daily

A logged-in user's Carmen session token lives about 30 minutes; automatic posting happens
on a schedule with nobody logged in, so a session token can't be used. Carmen mints a
service token per BU instead, scoped to the BU rather than to a person (so it doesn't die
when an employee leaves, and doesn't put their name on documents they never saw), subject
to Carmen's own permission model. Since it has no expiry, this project supplies the
liveness check Carmen doesn't: verify before storing, daily health sweep after
(`POST /email-ingest/health`), clear (never delete) `verified_at` on failure so a transient
Carmen outage isn't mistaken for a permanent revocation.

## 10. Claim before charge

The atomic insert into `email_documents` on the `(tenant_id, message_id, attachment)`
unique index is the dedupe, checked before anything is opened or extracted. It replaced an
earlier pre-extraction full-table `_already_seen` scan that existed only because, under the
tax-ID-routing design (#4), the tenant wasn't known yet and the unique index couldn't be
used. Once the tag makes the tenant known up front, the index-backed claim became possible
and the scan was removed.

## 11. Missing GL mappings are AI-filled and persisted, not parked

A BU that never opened the GL-mapping page in the OCR wizard would otherwise have every
single document park at `mapping_incomplete` — silence, for a feature explicitly sold as
automatic. Instead, the same suggester the wizard itself uses is called against that BU's
own Carmen account and department master (respecting Carmen's `DefaultAccount`
restrictions), the result is used to post, and it's written back to the BU's stored
mapping. Only the *first* document of a given payment type is ever a guess; every
subsequent one is deterministic. `mapping_incomplete` still exists as the fallback for when
the suggester produces nothing usable or Carmen's master is unreachable — not as a door
that stays shut until the customer configures something by hand.

## 12. The input-tax record can never fail the JV

Two Carmen documents are posted per statement: the GL JV, then a separate input-tax
(ACTX) record. Deliberately posted in that order and deliberately unable to fail the first:
the JV is already in Carmen's books with no rollback available once posted, so a failed
input-tax post is recorded as a note on an otherwise `posted` row for a human to add by
hand — never turned into an exception that would mark a document Carmen has already
accepted as `failed`.

## 13. No retry of a failed document

*(`ponytail` note, `email_ingest_service.py:35`.)* Single pass; the ledger records the
reason and `attempts`. A retry sweep is deferred until real failure volume in production
demonstrates it's worth building, rather than speculatively adding queueing/backoff logic
for a failure rate nobody has measured yet.

## 14. Attachments within a poll are processed serially

*(`ponytail` note, `email_ingest_service.py:38`.)* One mailbox, no queue broker (#2) — a
full batch costs roughly `batch_size × (one vision call + two Carmen posts)`, which is what
sets the ≥10-minute poll-interval floor (see
[05-operations.md — Scheduling](05-operations.md#scheduling)). Documented as the first
thing to parallelize if daily-commission-bank volumes make the backlog visible in
`job_runs`.

## 15. Gmail's confirmation handshake is completed by following the link ourselves

The destination mailbox for Gmail's forwarding confirmation is the shared ingest mailbox,
which no customer can open — without automating this, the last step of an otherwise
self-service setup needed a support call. The original design assumed Google would print a
confirmation *code* to paste back into the customer's own Gmail screen; measured against
four real confirmation mails on 2026-08-07 (Thai personal Gmail, English Workspace), Google
prints no code anywhere, only a link. The `gmail_confirm_code` field and its extraction
logic are kept as a fallback in case Google reinstates it, but expect it `null` forever;
`auto_confirm_forwarding()` following the link is the mechanism that actually works,
verified end to end the same day against a forward that had never been confirmed.

## 16. `owner_emails` defaults to empty — accept any sender

A second, deliberately weaker admission layer over the envelope tag (headers a sender
*composes* rather than ones a mail server stamps, so anyone who already knows the tag can
also forge these). Left empty by default: a gate nobody explicitly asked for that silently
refuses real documents is a worse failure mode than no gate at all — "start broad, narrow
later," the same posture `filename_patterns` and `bank_sender_email` both take.

## 17. The charge follows the vision call, not the outcome (2026-08-24)

Until this date, six post-charge exits refunded the credit: `duplicate_document`,
`tax_id_mismatch`, `mapping_incomplete`, `unreadable_document` (no postable amounts), and
the two `carmen_rejected` cases for a missing credential or unknown host. Only a Carmen
decline or a transport failure kept the charge.

That split was hard to state in one sentence, and it disagreed with the wizard on the same
event. `finalize_extraction` sets an `is_duplicate` flag rather than raising, so the Credit
Card wizard has **always** charged for a duplicate — the identical document cost 1 credit
through one path and 0 through the other, which is not a distinction either pipeline could
justify to a customer.

The rule now: **once `finalize_extraction` returns, the document is charged.** The vision
call has been made and billed to us, and the customer has received the work. A duplicate, a
foreign tax ID, an unmappable account and a Carmen refusal are decisions taken *about a
document we successfully read* — not failures to read it.

Mechanically this became one **refund boundary** in `_run_document()`: the `try` wrapping
`create_task` + `extract_stateless` + `finalize_extraction`, now the only place in the
pipeline that calls `refund_document()`. `create_task` moved inside it (it had been outside,
relying on the outer handler). `_Skip` lost its `refund` parameter entirely — every raise
site was either pre-charge or post-extraction, so the flag had no live value left. Both
outer handlers stopped refunding; leaving it in the generic `except Exception` as well would
have handed back two credits for one document, since the boundary re-raises into it.

**The trade-off, accepted knowingly:** a BU that configures both auto-forward *and* manual
forward now pays twice for each report, where the second copy used to be refunded. §0.1 of
`../CARMEN_INTEGRATION.md` promises both arrival modes work, and they still do — but the
guidance is now to pick one. A redelivered copy of the *same* message stays free: the ledger
key `(tenant, message_id, attachment)` catches it before any charge. Only a genuinely
different email carrying the same document costs twice, which in practice means the
double-forward setup and little else.

## 18. An upstream 401 is not a rejection (2026-08-28)

Three documents of one BU were filed `carmen_rejected — "Carmen rejected the JV"`. Carmen
had not rejected anything: it answered **HTTP 401**, because that BU's stored posting token
had died between two polls (it posted JV 1011 at 09:21 UTC and was refused at 09:35).
Establishing that took a manual join of `email_documents` against `outbound_call_logs`,
which is the only place the status code survived.

The cause was one line in `carmen_service.post_gljv`: it returned `resp.json()` without ever
reading `resp.status_code`, so a 401's framework body (`{"Message": "Authorization has been
denied…"}`) arrived as an ordinary result carrying no `Code`, and the caller fell through to
its generic "rejected" text. `post_input_tax` had been fixed for exactly this in July; its
four siblings had not. `_json_or_raise` is now that rule, shared by every write call, and
`_fail` puts the status into the message so a reader sees `HTTP 401: …` rather than an
opaque body.

Three consequences worth stating, because each is a decision rather than a mechanical fix:

- **`carmen_unauthorized` is its own `reason_code`.** A dead credential and a bad JV are
  fixed by different people on different screens, and a dead credential fails *every*
  document of that BU until someone acts — a distinction the ledger has to be able to show.
  The two pre-post guards (no stored token, no known host) moved into the same bucket.
- **The first 401 clears `carmen_token_verified_at`** (`es.mark_token_unverified`), the same
  "unproven" signal `sweep_token_health` writes, so the settings screen stops claiming a
  credential verified days ago. `email-token-health` is also scheduled now
  (`20260828000000_email_token_health_cron.sql`) — it existed all along and had no caller,
  which is why burnt credits were the first report.
- **The charge still stands.** Extraction happened, so decision #17 applies unchanged: the
  document is charged whatever the posting layer says afterwards. Flagging the credential
  shortens the window; it does not stop a BU spending on mail that arrives before someone
  re-pastes the token. Halting a BU's run after an auth failure is a real improvement and a
  separate decision.

The wizard carried the same defect in a different shape: `routers/carmen.py` stamped
`submitted_at` whenever Carmen answered `Code >= 0`, so a *rejected* JV was recorded as
submitted and the retry was answered "already submitted to Carmen" — the duplicate guard
reporting a failure it had caused itself, over Carmen's actual complaint. It now stamps only
on `Code == 0`, Carmen's documented success contract.

Left alone deliberately: `hooks/ap-invoice/useAPSubmission.ts` treats only `Code < 0` as a
failure, where the credit-card wizard and the input-tax step both use `Code !== 0`. Unifying
that is a behaviour change on a working posting path and needs Carmen's contract for
`/invoice` confirmed first.

## 19. A human approves before anything posts (2026-08-28)

**Reverses the central choice of v2, and partially reinstates v1's.** Ingest posted straight
to Carmen with nobody in between. That is the right shape for a pipeline a BU already
trusts, and the wrong one for a BU switching it on for the first time — the first thing the
automation does on day one is write to their real ledger, and the only way to find out it
misread a figure is to find the JV afterwards.

A document now stops at `pending_review` between the gate ladder and `post_gljv`, and a
human approves it at `#/CreditCardOCR`. The switch back is per BU: `auto_post`, default
`false`, flipped once the queue has been getting it right. (It was first a gear on the queue;
since 2026-09-08 it is a field of the BU's settings, on `#/CreditCardOCR/email-settings` since #34.)

What this is **not** is a return to v1. The differences are the whole reason it could be
built in a week rather than being cherry-picked:

- **No new admin UI, no `email_flow_*` tables.** Four columns on `email_documents`, one on
  `email_ingest_settings`.
- **Review is the Credit Card module's landing page**, not a screen of its own. The wizard
  moved to `#/CreditCardOCR/manual`; the queue took `#/CreditCardOCR`, which is what
  Carmen's SSO deep-link opens.
- **The reviewer edits in the wizard's own components** — `HeaderCard`, `DetailTable`,
  `AccountingReview` — so there is one implementation of the arithmetic, not two.
- **The cost model does not move.** #17 is unchanged: the charge follows the vision call, so
  a parked document is already charged and rejecting it refunds nothing. Backpressure, not
  refunds, is what protects a BU that stops reading its queue — past 50 pending, mail is
  handed back unread and costs nothing.

The one thing v1 got right that this keeps: nothing reaches the customer's ledger that a
person has not looked at, until that person says otherwise.
## 21. A rule says which files are documents; the document says which bank (2026-09-03)

Reported as "several banks configured, everything comes out as KBANK". The rule's
`bank_code` was the verdict: it picked the extraction layout *and* was stored without ever
being checked against the page.

That gives a filename substring authority over the printed issuer. `filename_patterns` is a
case-insensitive `%pattern%` test and `.pdf` is a documented escape hatch, so **one** broad
rule is the sole match for every file the other rules' narrower patterns miss — and labels
all of them itself. Worse, it chose the prompt: a GHL invoice read with the KBANK layout
mismaps its columns and is instructed to answer `bank_name: "ธนาคารกสิกรไทย"`, which then
confirms the wrong bank to every later reader, the browser included.

**Inverted.** Extraction on the email path always uses the combined auto-detect prompt; the
document's own answer decides; the rule's bank survives only as the fallback for an issuer
nothing can read, and as the standing guess on rows that fail before extraction. Where the
two disagree, the reviewer is told which rule over-reached — that warning is the only place
a mis-scoped pattern is visible before it has posted a JV against the wrong vendor.

Two smaller things fell out of the same look:

- **The combined prompt identified the bank and never said so.** Every prompt now returns
  `bank_code`, and `detect_bank_code` takes it as tier 0. The reader looking at the page
  beats keyword-matching the two or three header fields it chose to fill in.
- **The `raw_text` detection tier could never fire** — no prompt has ever asked for
  `raw_text`. Two earlier diagnoses blamed it anyway. Deleted rather than fixed.

**What this does not change:** the per-BU uniqueness of `bank_code` across rules (still one
place to edit a bank's patterns and password), and the gate itself — an attachment matching
no rule is still `no_rule_match`, still free. A rule is a filter, not an identification.

**Prior verdicts this corrects.** 2026-08-28 and 2026-08-31 both closed this class as
customer configuration. Both were factually right and both left the same defect standing:
the configuration could not be got wrong safely.

## 22. A document we charged for stays reviewable (2026-09-03)

**Decision.** A refusal that happens *after* a successful extraction parks at
`pending_review` with its reason recorded, instead of finishing as `failed`. The reviewer
opens it, edits every field, and posts — or rejects it. Six causes move:
`tax_id_mismatch`, `duplicate_document`, `mapping_incomplete`, `carmen_unauthorized`,
`carmen_rejected`, and a document with no postable amount.

**Why.** #17 settled that the charge follows the vision call, not the outcome. The queue did
not honour the other half of that bargain: `_finish()` nulls `review_payload` on every
terminal transition, so the customer paid for a reading and then had it thrown away. The
only recovery was to re-scan the same file by hand and pay for it a second time. The refund
boundary's own comment had already named these as *"decisions taken about a document we
successfully read, not failures to read it"* — this is that sentence applied to the ledger.

Not a new principle: §10 #30 of `07-human-in-the-loop.md` did it for `mapping_incomplete`
alone on 2026-08-31, with the reason that generalises — *"it was terminal because nothing
could fix it in place; now something can."*

**What stays terminal, and why each.**

- The generic `except`. It can fire *after* `post_gljv` returned zero, because
  `_mark_submitted` and `_post_input_tax` both run past that point — offering Approve on a
  JV already in Carmen's books invites a double post.
- The refund boundary. The money went back, so there is no reading to keep. `extracted` is
  dropped there before the re-raise, making that true by construction rather than by
  tracing which handler the exception reaches.
- A second copy of something already in the queue (`_already_pending`). Its twin is there,
  editable and postable; parking this one recreates the two-identical-rows problem raising
  it prevented. The only `_Skip` carrying `reviewable=False`.

**The one risk taken.** A Carmen *transport* failure parks too, and `_mark_submitted` never
ran — so `has_submitted_doc` cannot catch a JV that landed as the socket died, and a
reviewer who approves without checking Carmen can post it twice. This is the risk the
approve path has taken since it shipped (its 503 says *"check whether the JV posted before
approving this document again"*); the difference is that there a human had just pressed the
button, and here a robot failed at 3am. The mitigation is that the same sentence now travels
on the row, which is where that reviewer will read it.

**What it costs.** `auto_post = true` stops meaning "post or destroy" — a BU with review
switched off can now accumulate a queue, and parked failures count toward
`REVIEW_BACKLOG_CAP`. A dead credential therefore fills the queue and stops ingestion. That
is the cap working: those 50 documents all become postable the moment the token is replaced,
so clearing them produces 50 JVs rather than being cleanup.

**Not a retry.** #13 stands: single pass, no sweep. Nothing is retried automatically. What
changed is that most of what was being filed as a failure was never one — it was a question,
and now a person can answer it.

## 23. Posted and Not posted mean charged; All is the log (2026-09-03)

**Decision.** The two chips that report outcomes now hold only documents this BU was charged
for. An attachment that never cost a credit — `status = 'skipped'`, which is every exit
upstream of `consume_document()` — is in neither, and is found under `All`, which is a chip
again. `Review` is unchanged and outranks the split: a cause somebody can still clear from
settings stays there whether or not it cost anything.

**Why.** #17 settled that the charge follows the vision call; #22 made the queue honour that
by keeping a charged document reviewable. This is the same rule facing the reader. `unposted`
was the `else_` arm of `_chip_expr`, so it collected everything that was neither posted nor
owed — on the dev database that is 61 rows of 154 where the customer's own filename rules
refused a signature logo. Reporting those as *"documents that did not post"* makes the phrase
mean nothing, and it is the same fault #25 found in the Actions column: a *billing* split
being read as a statement about the document.

**The mechanism is free.** `status` is already the charge marker — `_park_or_finish` writes
`status = "skipped" if charged is None else "failed"` — so the split is one more `CASE` arm,
no join and no new column. It gets exactly one row wrong: a crash inside the refund boundary
returns the credit and still finishes `failed`, so it shows under Not posted. Left there —
an infra failure deserves a reader's eye wherever it lands. `OCRTask.charged_docs` via
`task_id` is the per-row truth if it ever matters.

**Why `All` had to come back.** §12 #41 removed it because the three status chips held every
row between them, so there was nothing to escape from. Narrowing two of those three makes
that false — without the chip, the rows answering *"did my statement even arrive?"* would be
reachable from nowhere. It carries no count (a lifetime total cannot go down — #45) and no
dot (every row under it is already counted under a status chip, and `mark_chip_seen` stores
no mark for it, so the dot could never be put out).

**What it does not change.** `counts["all"]` is the same number. A stuck `received` row stays
under Not posted, deliberately: its charge is unknown, it did not post, and it is the one row
that says the pipeline stopped mid-document — #38's dot needs a chip to sit on. Dismiss is
unchanged as a gesture; where the row lands is now the charge, which in practice means it
leaves the status chips altogether and keeps its story under `All`.

Full reasoning and the alternatives in [`07-human-in-the-loop.md §14`](07-human-in-the-loop.md).

## 24. Auto-post posts what is ready to post (2026-09-04)

**Decision.** `auto_post` stops meaning *"post everything that passed the gate ladder"* and
starts meaning *"post the documents there was nothing to say about"*. The gate is
`_review_flags()` — the queue's own reason column — and an empty list is the whole test. A
reading with warnings, lines that do not reconcile, a GL rule the AI invented on the way
past, or a statement whose number could not be read all park for a human under **either**
setting.

The flag set gains one member, `doc_no_missing`, and the reason ladder the phrase to go
with it.

**Why.** The flags were computed, stored, and then only looked at if review happened to be
on. So the switch was an all-or-nothing bet: a BU either approved every document or accepted
that an uncertain reading would post to their ledger with the same silence as a clean one.
This is the gap noted on 2026-08-18 (*"warnings ถูกเมินตอน auto-post"*) and parked; #22
closed the other half of it by keeping a charged reading reviewable, and this closes the
half where the reading was never questioned at all.

**One predicate, deliberately.** The gate is the same function that paints the row's Message
column, whose empty case already read **"Ready to post"**. Two definitions of "worth a
human's eye" — one for the reader, one for the pipeline — is exactly the drift that would
let a document post behind the back of the person who would have been shown a reason for it.

**Why `doc_no_missing` is a flag and not a `_Skip`.** Both duplicate guards key on the
document number: `has_submitted_doc` and `_already_pending` answer `False` when there is
none. An unnumbered statement forwarded twice would post twice into real books with nothing
able to catch it — but a reviewer can perfectly well post one on purpose, so it blocks the
machine and not the human. That is what a flag is.

**Two gates stop being conditional.** `REVIEW_BACKLOG_CAP` and `_already_pending` both read
`not auto_post`, written when a BU with review off could not park anything. #51 ended that
and this makes parking routine there, so both were now holes on the main path: an auto-post
BU had no backpressure at all (a dead credential would charge for every document while its
queue filled), and a re-sent statement would park a second identical row.

**What it costs.** A BU running auto-post will see documents in its queue that used to post
silently — which is the point, and is also the only support conversation this creates: *"it
used to post everything"*. `mapping_incomplete` disappears as a `reason_code` on new rows;
a GL gap is now the `mapping_missing` flag, one path for both modes rather than two that can
drift on what the row says. The `mapping_incomplete` fix-link stays in `reviewReasons.ts`
for the rows that already carry it.

**What it does not change.** The refund rule (#17), what parks after a charge (#22), the
chips (#23), the backlog cap's value, approve, reject, and the switch itself — `auto_post`
is still per BU and still defaults `false`. (It was written by its own endpoint then; since
2026-09-08 only by `PUT /api/v1/carmen/settings`.)

Full reasoning in [`07-human-in-the-loop.md §15`](07-human-in-the-loop.md).

## 25. An AI-suggested GL rule becomes the BU's rule when a human approves it (2026-09-04)

**Decision.** Ingest stops writing what the suggester produced. It keeps the pairs on the
ledger row — `review_payload.suggested`, `{key: {dept, acc}}` — the review screen seeds its
pickers from them, and the `patchAccountingConfig` call that screen already makes before
posting is what saves them. `fill_missing_mappings` is no longer called from
`email_ingest_service`.

**Why.** The guess became the BU's own rule the instant it was made, so the *second*
document carrying that payment type found the rule already there: `unmapped_payment_types`
returned nothing, `mapping_guessed` was false, `_review_flags` was empty, and with
`auto_post` on it posted unattended on a mapping no human had read. KTC and SiamPay did
exactly that on 2026-09-04 — parked in run 1, posted as JV 1023 and 1026 in run 2 from the
identical documents. It contradicted the rule written in `unmapped_payment_types`' own
docstring (*"an LLM-guessed mapping must never post by itself"*, CARMEN_INTEGRATION §4):
the flag was riding on the document, and the *documents* are what differ.

**The claim it makes true.** "Reviewed once per payment type" — not once per whichever
document happened to arrive first. A person confirming is now the only thing that turns a
suggestion into a rule, and after they do, every later document of that type is clean and
auto-posts.

**What it costs.** One suggestion call per document that arrives before the reviewer gets
there, instead of one per payment type. That is a text-model call weighed against posting to
someone's books on a rule nobody read; `REVIEW_BACKLOG_CAP` still ends the queue.

**No second writer.** The alternative was a `mappings` field on `ApproveIn` and a
`fill_missing_mappings` call after `post_gljv` — correct on ordering (a rule confirmed by a
JV that actually went through) but a second writer of the same table on the same click, and
the two would drift on the additive-vs-overwrite question that already separates
`fill_missing_mappings` from `patch_config`. The screen was already writing these rules; it
now writes one more.

**What it does not change.** The suggester itself, when it runs, `mapping_guessed`,
`mapping_missing`, or the auto-post gate (#24). A clean document still never calls the
suggester and still posts by itself.

## 26. A 401 reading the GL master is a dead credential, not a missing mapping (2026-09-04)

**Decision.** `_suggest_missing_mappings` re-raises `CarmenAPIError` on 401/403 instead of
returning `{}`. Every other status stays swallowed.

**Why.** carmencloud's stored posting token was expired — `GET /accountCode` answered 401 —
and the catch turned that into an empty suggestion. Every key came back unmapped, the
document parked as `mapping_missing`, and the single symptom was one row telling the reader
to go and fix a mapping. `mark_token_unverified` never ran, so the bell said nothing and
`#/admin/email` showed a healthy credential.

Nothing new handles it: the `except CarmenAPIError` in `_run_document` already flags the
token and parks with `carmen_unauthorized` (#18), and would have caught the same 401 one
Carmen call later at post time. The re-raise just stops the earlier call from hiding it.

**Why not all statuses.** A 503 says nothing about the credential. Unverifying a token
because Carmen was down for a minute makes a BU re-paste a token that was fine.

## 27. A cause is a row of its own, and the noise is not a row at all (2026-09-04)

**Decision.** `review` narrows back to `pending_review` alone. The two reason codes that
fire per *attachment* on legitimate mail — `no_rule_match` and `unreadable_document` — leave
the status chips entirely and stay in `today` and `all`. Every other pre-charge refusal is an
**ordinary row under `Not posted`**: one per attachment, its own filename, its reason, and
`Open settings`, which is exactly what the same row already looks like under `All`. `review` narrows back to `pending_review` alone. `no_rule_match` and
`unreadable_document` — the two that fire per attachment on legitimate mail — leave the
status chips entirely and remain in `today` and `all`.

**Why.** #23 and its predecessors kept moving this pile between chips, sorting on who can
act and then on who paid. Neither axis separates the two things in it: *a setting that
stopped eleven attachments* and *a document that needs a decision*. So wherever they landed
they landed on the work chip — on the dev BU, 46 `no_rule_match` rows in front of the nine
statements waiting behind them.

**The fix turned out to be subtraction.** Two rounds went into folding the refusals into one
row per cause — first behind a disclosure, then with the filenames printed on the row — and
both came out again (*"ไม่อยากให้เป็น list ที่ซ่อนอยู่ใน dropdown"*, then *"เอาให้เหมือน skipped
ของ tab all ไปเลย"*). Correct both times: once the noise arm removes 97 of a BU's 140 rows,
what is left is a handful the table already knows how to draw, and a second row shape earns
nothing. The volume was the whole problem.

**The noise is a third thing.** 97 of one dev BU's 140 rows are `no_rule_match` +
`unreadable_document`: the signature logo, the summary PDF inside every bank zip. They grow
with *successful* traffic, which is exactly why `NOTIFIABLE_SKIPS` has always refused to
ring for them — *"a bell that cries every morning is a bell nobody reads on the morning it
matters."* The queue now says what the bell says. They are not hidden: `today` and `all`
still list them in place, and that is load-bearing, because a BU whose filename pattern is
too narrow finds its dropped statements there.

**The mechanism.** `_chip_expr()` swaps §14's charge arm for one keyed on the reason, gated
on `status = 'skipped'` — the same code on a `failed` row is a crash inside the refund
boundary, which is what the dot exists for. Everything the noise arm does not claim falls to
`unposted` and is listed there, so `total` covers it and the Pager stays honest. No
migration, no new column, one bucket fewer than the release began with.

**What it costs.** #23's release note said Posted and Not posted count only what you were
charged for, and Not posted now also carries the refusals. That sentence was solving the
*volume* — 61 logos reported as failures — and suppressing `no_rule_match` solves it at the
source; what is left under Not posted did not post, and the BU wants it. Dismissal is gone
entirely (#54's ✕, §16's dialog, and the per-cause endpoint built in this release): it
existed to stop `review` filling with rows it could never clear, and `review` no longer holds
them. `dismissed_at` stays for `_attention`, which is what keeps the migration's back-dated
pile quiet.

Full reasoning, and the seven decisions behind it:
[`07-human-in-the-loop.md` §18](07-human-in-the-loop.md).

## 20. Superseded designs, and where they live

- **`feat/email-flow`** — the v1 design: a human-approval review step before posting, its
  own admin UI, `email_flow_*` migrations. Deliberately never merged; kept only as
  historical reference for UX and endpoint shape. **Not cherry-pickable** — v2 removed the
  approval step and moved settings ownership to Carmen's own screen (moved back into this
  app by #34, on v2's API rather than v1's tables), and is a different
  architecture end to end, not a superset of v1. #18 above brings the *idea* back on v2's
  architecture; it does not bring back this branch's code, and that distinction is why it
  cost days instead of weeks.
- **`poc/email-commission-automation`** — the original proof-of-concept the whole feature
  grew from.

Neither branch has a remote; both exist locally only, for reference.

## 28. The KBANK settlement report posts one JV, not two (2026-09-18)

**Decided:** 2026-09-18, superseding FRD §6.1 as originally written (v1.1). See the v1.2
amendment for the customer-facing wording.

**Decision.** A KBANK settlement report (`KB1P554V2_SUM_<merchant id>_<date>.pdf`) now posts
a single, self-sufficient JV: `Cr.` one line per card scheme (the report's per-payment-type
rows), `Dr.` commission / input tax / bank account, read from the report's own
`TOTAL BY MERCHANT ID` row against the BU's *existing* credit-card GL mapping. The BU's
KBANK filename rule should point at this file instead of the fee invoice
(`E-TAX_INVOICE_CARD_*`); a guard also skips a fee-invoice attachment whose bank has this
mode enabled, so a rule left in place does not book the commission twice. No control
account, no second document, no PDF password.

**Why.** FRD v1.1 read the settlement report as a *reclassification* — `Dr.` a lump control
account, `Cr.` per scheme — meant to be cleared by a second JV built from the encrypted
`E-TAX_INVOICE_CARD_*` (`Cr.` that same control account, `Dr.` bank/commission/input tax).
That shape assumed the settlement report could not carry commission, VAT or net figures of
its own. Reading the report's actual text layer (PyMuPDF, no vision call needed — it is a
machine-generated PDF, not a scan) showed the assumption was wrong: the report's own anchor
row prints `COMM AMT`, `VAT AMT` and `NET AMT` in full, and three checks already run against
it in `credit_card_service._normalize_ar_settlement` — Σ per-row THB AMT against the printed
total, THB AMT against COMM+VAT+NET on that row, and the filename's merchant id against the
page's. The e-tax invoice added nothing the settlement report did not already have, at the
cost of a second credit, a second review, and a PDF password the BU had to configure and
store.

**What it costs.** Before: 2 credits and up to 2 reviews per settlement day (settlement
report + fee invoice), a control account that only reconciled to zero once both documents
posted, and `ar_reconcile_settings.debit_dept_code`/`debit_account_code` as the JV's only
debit-side configuration. After: 1 credit, up to 1 review, no control account, and the debit
side reads the BU's fee-invoice mapping (`bu_accounting_mapping_entries`, keys `commission`/
`tax`/`net`) instead of a mapping of this feature's own. `debit_dept_code`/
`debit_account_code` are left in the schema, unread, so the two-JV shape could return
without a migration if a customer needs it split back apart. `ar_reconcile_jv.is_balanced`
stops being a tautology once the debit side no longer derives from the credit rows it is
compared against — it is a real check now, wired into `_review_flags` (`unbalanced`) and
into `approve_document`'s own gate, where it replaces the old blank-control-account check
(`control_leg_missing`, deleted).

**Second factor, same redesign, separate tickets.** The settlement report's own page prints
no tax ID, so `foreign_tax_id` had nothing to check for this document type. The bank's own
`TAX_SUMMARY_BY_TAX_ID_CSV_*` sidecar (bundled in the same zip, never charged or ledgered
itself) supplies it by merchant ID; a report with no matching CSV row parks with
`tin_unverified` rather than auto-posting. Tracked separately
(`.scratch/kbank-settlement-jv/issues/01`, `04`) since it does not depend on this one.

**Known risk, deliberately not fixed here (2026-09-18).** Bank identity on this path is
never read from the document — it comes entirely from which filename rule matched
(`email_ingest_service.py` explicitly skips `_resolve_bank` for `DocType.AR_RECONCILE`).
The rule a BU sets today matches the substring `KB1P554V2`, which is printed on the report
as `REPORT NO. KB1P554V2` — **a report/program *version* number, not a permanent bank
identifier.** If KBank ships a new settlement-report generator (`KB1P554V3` or later), that
pattern stops matching, the attachment falls through as `no_rule_match` — which is
deliberately in the noise bucket (`NOTIFIABLE_SKIPS`) so it rings no alert — and, because
this design has no second document to fall back on, **zero JVs post for that BU rather than
a degraded one.** v1.1's two-document shape degraded gracefully here: the fee invoice's own
rule (a different, more stable naming convention tied to the tax-invoice numbering rather
than a report version) would keep posting the commission JV even if the settlement report's
pattern broke. v1.2 does not have that fallback — this is a real cost of the collapse to one
document, not a hypothetical.

It compounds with ticket 02's guard (`covered_by_settlement_jv`): that guard reads a static
"AR reconciliation enabled" flag, not "was a settlement report actually seen today" — so if
`KB1P554V2` breaks while AR mode stays enabled, a fee invoice kept as manual backup would
also be silently skipped, for the same non-alerting reason. Ticket 02 should account for
this before it ships.

Mitigation floated but deliberately deferred: broadening the rule to a version-agnostic
substring (`_SUM_`, present in `KB1P554V2_SUM_<merchant id>_<date>.pdf` regardless of the
report-number prefix) rather than the exact version string. **Not merchant-ID-scoped** —
embedding the merchant ID (`_SUM_451005282039001_`) was also considered, but a BU with more
than one property under one tenant would need one rule per merchant ID, trading one
single-point-of-failure for one-per-property; a new property added without its own rule
would fail the same silent way. `_SUM_` alone stays bank-and-property-generic. Either way
the failure mode of a too-loose pattern is safe (a misrouted file fails extraction/warnings
and parks for review, per the existing validation), so broadening costs nothing but has not
been done — recorded here so it is a deliberate choice, not an oversight, until a ticket
picks it up.

## 29. `cc_ar_reconcile` collapses into the credit-card flow (2026-09-22)

**Decided:** 2026-09-22, following #28. See `CONTEXT.md` for the vocabulary this produced
(**Settlement report**, **Fee invoice**, **Credit breakdown**) and the v1.2 amendment for
the FRD-facing note.

**Decision.** The second module, second mapping table and second settings screen that a
settlement report used to need are gone. `cc_jv.build_jv_rows` gained two optional
arguments (`total_row`, `grouping`) whose defaults reproduce the fee-invoice builder
byte-for-byte; `ar_reconcile_jv.py` is deleted and its helpers (`group_key`, `is_balanced`,
`render_jv_description`) moved into `cc_jv`. `ar_reconcile_mappings` folds into
`bu_accounting_mapping_entries` via a new nullable `source` column
(`settlement_detail` / `settlement_summary` / `NULL` = usable on either layout); a new
nullable `banks.settlement_grouping` replaces the hardcoded `SUPPORTED_BANKS` /
`RECONCILABLE_BANKS` lists — a bank has a settlement layout iff that column is set.
`assert_module_enabled` now gates a settlement report on `credit_card_ocr`, the same gate
every other document in this flow uses; `modules.is_active = false` for `cc_ar_reconcile`,
whose id survives only as `ocr_tasks.module_id` and `log_llm_usage(module_id=...)` for cost
continuity. `ar_reconcile_settings` survives unmodified as the per-(tenant, bank) posting
profile — Detail/Summary is now a setting the credit-card mapping page shows for a
settlement-capable bank, not a reason to leave that page. `pages/ARReconcileSettings.tsx`
and `components/ar-reconcile/ARMappingTable.tsx` are deleted; `#/CreditCardOCR/ar-settings`
redirects to `#/CreditCardOCR/mapping?bank=...`. One save now issues
`PUT /config/accounting` then `PUT /ar-reconcile/settings`, reporting a partial failure
without rolling back the first call.

**Why.** #28 made a settlement JV's debit side identical to a fee invoice's — both read the
BU's commission/tax/net mapping, from the same table, keyed the same way. That left the two
builders differing in exactly two things: where the debit figures are read from (a
document-layout fact — a settlement report prints one anchor row, a fee invoice does not)
and how the credit side groups (a user option — Detail vs Summary). Neither is a reason for
a second module. The premise that had been true through v1.1 — a settlement report needs a
second JV to clear against the fee invoice's — stopped being true the day #28 shipped;
`cc_ar_reconcile` as a module, `ar_reconcile_mappings` as a table, and
`ARReconcileSettings.tsx` as a screen were left standing on a premise that no longer held,
each one now a second place to look for what the credit-card flow already answered. Folding
them back is explicitly *not* the "add a module" framing the pre-#28 design used — it
removes a module and gives a BU an option (a settlement-capable bank shows a Detail/Summary
toggle) instead.

**What it costs.** Before: a settlement report needed its own module row
(`tenant_modules`), its own mapping table keyed by `(config_id, payment_type)` with no
`source` column, and its own settings screen a BU had to discover independently of the
credit-card mapping page it otherwise never visited. After: one module gate, one mapping
table (`source` disambiguates a Detail-only, Summary-only, or either-layout code), one
settings page. `ar_reconcile_mappings` is not dropped — renamed to
`ar_reconcile_mappings_archived` — because the backfill is `ON CONFLICT DO NOTHING`
against `(config_id, field_type)` and a payment-type code mapped under both post types
before this migration can conflict; the archive is the conflict report future hand-resolution
reads against, not a rollback path. `ARSettingsIn`/`ARSettingsOut` and
`ar_reconcile_service`/`ar_reconcile.py`'s identifiers keep the old `ar_reconcile` name
deliberately — renaming call sites across a money path for a naming preference was judged
not worth the diff risk; `CONTEXT.md` governs what a human calls this out loud, not what the
code calls it. `/ar-reconcile/preview` stops calling `get_accounting_config` — the frontend
already holds the complete live mapping state (`ARPreviewIn.mappings: dict[str,
FieldMapping]`) needed to render a preview, so the endpoint no longer re-reads the DB it
would otherwise read a second time in the same save flow. Proof of no regression:
`tests/unit/test_cc_jv.py`'s original fee-invoice tests and
`frontend/src/lib/ccJv.contract.test.ts` pass unchanged against
`contracts/cc-jv.contract.json` — the fee-invoice path's behavior did not move, only its
neighbor's did.

**Not touched.** Decision #28's known risk (`KB1P554V2` as a report-version substring
standing in for a bank identifier) is unchanged by this collapse — still open, still
deliberate, tracked where #28 left it.

**Ticket 02 resolution (2026-09-18).** Built the freshness-check option rather than the
static-flag-plus-alert one: `_settlement_recently_posted()` requires proof — an
`email_documents` row for this bank, `status == "posted"`, whose task's `module_id` is
`cc_ar_reconcile`, updated within the last 3 days (`_SETTLEMENT_FRESHNESS`) — before the
fee-invoice guard fires. No proof, no skip: the fee invoice falls through to its ordinary
path and posts on its own, which is the old two-JV behaviour, not silence. This sidesteps
building a new alerting surface (no admin-dashboard chip, no notification type) for a risk
that a self-correcting check removes outright — if `KB1P554V2` ever breaks, the fee invoice
resumes carrying the commission by itself within `_SETTLEMENT_FRESHNESS`'s window rather
than needing anyone to notice an alert first.

## 30. One JV-description mechanism, not two (2026-09-22)

**Decided:** 2026-09-22, reopening decision #7 from #29's own list ("Two JV-description
mechanisms stay — out of scope") on purpose, the same day, after the merged mapping
page made the redundancy visible: `TopLevelConfigSection`'s per-bank `Description`
field (fee invoice) and the Settlement card's `JV description template` field
(settlement) are both "the JV's wording," one plain, one templated.

**Decision.** `bu_accounting_configs.bank_descriptions[bank_code]` — the field the
fee-invoice path always read — becomes the single source for both. `cc_jv.py` gained
`render_description()` (a saved value containing `{Settlement_Date}` /
`{Tax_Invoice_No}` / `{Bank_Name}` is treated as a full template via the pre-existing
`render_jv_description()`; one without a tag keeps the fee-invoice path's original
`base - doc_date` concatenation verbatim) and `resolve_jv_description()` (the same
decision starting from a config object via `description_for()`). `build_gljv_payload`'s
description fallback and `ar_reconcile_service.jv_for_document`'s settlement-JV
description both now call these instead of each maintaining its own copy of "compute
the wording" — `email_ingest_service._ar_description()`, which used to be that copy for
the auto-post path, is deleted outright. `ar_reconcile_settings.jv_description_template`
stops being read or written anywhere; the column stays in the schema, unused, same
precedent as `debit_dept_code`/`debit_account_code` from decision #28.
`ARSettingsIn`/`Out` drop the field entirely, matching how `mappings` was already
dropped from that schema in #29. The frontend gained the same split: `ccJv.ts`'s
browser twin (`buildGljvPayload`, the wizard's own JV builder) gets tag rendering for
the first time — it never needed it before, since the wizard has no settlement document
type (decision #4) — and `TopLevelConfigSection`'s Description field grows the
tag-insert buttons and a live preview line, but only for a bank with a settlement layout
(`hasSettlementLayout`); every other bank's box is unchanged.

**Why.** Once the merged mapping page (#29) put both fields on screen at once for a
settlement-capable bank, "two boxes, one concept" was no longer a design that needed
explaining — it was the exact redundancy the earlier collapse work had just spent a
session removing everywhere else. The two mechanisms differed only in whether the saved
string had template tags in it, which is a property of the *value*, not a reason for a
second *field*.

**What it costs.** `build_gljv_payload` (email ingest) and `buildGljvPayload` (the
wizard) both run for every tenant's JVs, fee invoice or settlement — a careless merge
would have silently changed wording on documents already posting correctly. The
backward-compatibility rule is the whole answer to that: a saved description with no
tag in it is byte-identical in behaviour to before this decision, for every BU that
never touches `{Settlement_Date}`/`{Tax_Invoice_No}`/`{Bank_Name}`. Migration
`20260922010000_fold_jv_description.sql` backfills a bank's customized settlement
template into `bank_descriptions[bank_code]` only where that slot was empty (same
non-clobbering shape #29's own migration used); a bank with both already set and
disagreeing is left for a human, per `db/queries.sql` item 27's conflict report — empty
against dev at the time this shipped, since KBANK is still the only live settlement
bank and neither of its two dev tenants had a customized settlement template that
disagreed with their own fee-invoice wording.

## 31. The rule is the settlement switch; Carmen sets it (2026-09-29)

> *Where it is set moved by #34:* the rule is still the one switch, but its screen is now our
> `#/CreditCardOCR/email-settings`, not Carmen's.

**Decided:** 2026-09-29. Until today, a bank's settlement report reconciled only if **two**
switches in two places were both on: its email rule said `doc_type: ar_reconcile` (Carmen's
settings screen, or our `#/CreditCardOCR/email-settings`), and `ar_reconcile_settings.enabled` was on (our
Mapping page's Settlement card).

**Decision.** One switch, on the rule, written only through `PUT /api/v1/carmen/settings`:

- An **active** rule with `doc_type: ar_reconcile` *is* "reconcile this bank". Rules are
  already one per bank (`save_settings` refuses a duplicate), so the rule is the per-bank
  record there was always going to be.
- Validation moves to where the switch is set: `ar_reconcile` needs a `bank_code` whose bank
  has `settlement_grouping`; an unknown `doc_type` is refused.
- The Mapping page's Settlement card loses its toggle and says, read-only, when the bank is
  not switched on. `ar_reconcile_settings.enabled` stays in the schema, unread and unwritten
  (same precedent as `jv_description_template` in #30).
- **Detail/Summary stays ours** — the same card, the same `PUT /api/v1/ar-reconcile/settings`,
  now carrying only `post_type`. It was briefly moved onto the rule too, then put back the
  same day: it is an accounting choice, and it belongs beside the GL accounts each grouping
  needs, which are on that page. Carmen never sends or sees it.

**Why.** Same lesson as `auto_post` on 2026-09-08: two writers for one fact means one of them
silently undoes the other, and a rule tagged for a bank that was "switched off" elsewhere was
a state nobody could see from either screen. The toggle only existed because the rule lived
in Carmen and the toggle in our app; the rule already said everything the toggle did.

**What it costs.**

- The "tagged but switched off" skip (`ar_reconcile_disabled` for that reason) is gone;
  turning reconciliation off is deactivating the rule, which is `no_rule_match` — also free,
  also before the charge. `ar_reconcile_disabled` survives only for a settlement rule stored
  with no bank.
- **The fee-invoice double-book guard (`covered_by_settlement_jv`, #28) is deleted**, with
  `ledger._settlement_recently_posted`. It caught a KBANK fee invoice matched by a KBANK
  fee-invoice rule while KBANK reconciled. With one rule per bank, "KBANK reconciles" now
  *is* that rule being `ar_reconcile`, so the state cannot exist. Not covered, before or
  after: a KBANK fee invoice caught by the "Other" rule (`bank_code: null`), whose bank is
  only known after extraction. The primary fix stays what #28 said it was — the BU's
  filename patterns not matching the fee-invoice file.

**No data migration.** The only writes to `ar_reconcile_settings` came from an unpushed
branch, and its `post_type` column keeps meaning what it meant.

## 32. A description posts as saved — no automatic date (2026-09-30)

**Decided:** 2026-09-30, reversing the backward-compat half of #30. `render_description()`
used to append ` - doc_date` to any saved description with no template tag. That was the
fee-invoice path's original behaviour, and #30 kept it so no BU's wording would change. It
was also a rule no screen showed: the date moved around depending on whether a tag was
present, and the Mapping page could only say so after the fact.

**Decision.** The saved Description is the whole sentence. Its `{Settlement_Date}` /
`{Tax_Invoice_No}` / `{Bank_Name}` tags are filled and nothing is added.

- One function per side: `render_description()` in `credit_card/jv.py` and its twin
  `renderDescription()` in `ccJv.ts`, pinned by `contracts/cc-jv.contract.json`.
- The JV (wizard and email), the settlement JV, the input-tax record (`InvhDesc`, wizard and
  email) and every preview of them go through these. The two input-tax builders used to
  append the date themselves and post any tag raw.
- The Mapping page's tag chips are offered for every bank, not only settlement-capable
  ones, because a tag is now the only way a date reaches the description. The date chip
  reads "Document date", since on a fee invoice it is not a settlement date. The stored
  token stays `{Settlement_Date}`.
- Tokens never appear in a text box: the Mapping page and the review queue edit the free
  text, and the fields ride after it (`splitDescription`/`joinDescription` in `ccJv.ts`).
  A typed token broke with one backspace and posted verbatim.

**No data migration, on purpose (the user's call).** Every description saved before this
date posts without the date from the next document on, until its BU inserts the tag.

## 33. A Description belongs to a bank — the BU-wide fallback is retired (2026-09-30)

**Decided:** 2026-09-30, the same day as #32, reversing the fallback half of #30.
`bu_accounting_configs.description` was what every bank without its own
`bank_descriptions` entry posted under (`description_for`, `descriptionForBank`). It was
**read everywhere and editable nowhere**:

- the Mapping page wrote it only while no bank was selected, which never happens once a BU
  has saved one;
- the review queue's `patch_config` wrote it only for a document with no bank;
- the Mapping save sent it back unchanged every time.

So a stray value sat behind every unconfigured bank, and no screen could change it. On dev
`carmen`, "TEST ACC" was shown as *Empty — KTC documents use "TEST ACC"* on every bank but
KBANK.

**Decision.** A bank's Description is `bank_descriptions[bank_code]`, or nothing.

- `description_for` returns `None` for a bank without one. Its twin `descriptionForBank`
  loses the parameter.
- `AccountingConfigRequest`/`Response` drop `description`. Pydantic ignores it when a stale
  tab still sends it.
- `save_accounting_config` stops writing the column. `patch_config` drops a description when
  no bank is named.
- The Mapping page's field is disabled until a bank is selected. An empty bank reads
  "Empty — {bank} documents post no description".
- The review queue shows no BU-wide placeholder.

**Migrated (the user's call, unlike #32).** `20260930000000_description_per_bank_only.sql`
copies the old value into each bank the BU uses (its GL mapping entries' banks, plus the
config's own `bank_code`), only where that bank's entry is empty. It never overwrites and is
idempotent. `queries.sql` item 29 is the dry run.

- The column stays in the schema, unread and unwritten: the precedent of #30 and #31.
- A bank the BU starts using after this date begins with no description.
- Push the migration after this branch merges ([[supabase_push_branch_migration]]). It is
  safe to push before the code deploys, because the old code's fallback and the copies say
  the same thing.

## 34. The settings screen moves into the OCR app (2026-10-01)

**Decided:** 2026-10-01. This reverses the ownership half of the v2 restart (#20: "moved
settings ownership to Carmen's own screen") and the link direction of
[`07-human-in-the-loop.md` #101](07-human-in-the-loop.md). Carmen's settings form was still a
draft. Our `#/CreditCardOCR/email-settings` already covered every field, including `auto_post` and
`doc_type`, which Carmen had not shipped (its checklist items 8 and 9). Every contract change
so far had been a hand-over to another team plus a wait, and meanwhile a BU stayed in review
mode.

**Decision.** `#/CreditCardOCR/email-settings` is the customer's settings screen.

- **Carmen builds a menu item, not a form.** It mints the BU's posting token if
  `GET /settings/token` says none is live, then opens our page through the same SSO link
  as the queue (`CARMEN_INTEGRATION.md §2.8`). Agreeing that with Carmen is still open. Our
  side does not wait for it.
- **Who may open it is Carmen's call, made once.** Carmen decides who sees its menu item. We
  keep no roles and ask Carmen no permission question. A per-BU permission endpoint was
  drafted the same morning and dropped (the user's call) as exactly the duplicated work this
  move exists to remove. The trust model is unchanged: any token the host's Carmen accepts
  may edit (§2.1, QA S-07). A user who reaches the app through the queue link can still open
  the page, the same reach that approving a JV already gives them.
- **Every fix button opens it, in this tab.** `sender_not_allowed`, `wrong_pdf_password`,
  `ingest_paused`, `tax_id_mismatch`, *Reconnect* (`carmen_unauthorized`) and the AR dialog's
  "no settlement rule" door all go to `#/CreditCardOCR/email-settings`. That leaves no link to Carmen's
  `/setting`, so `fixLinkProps` (which picked the tab) and `carmenSettingsUrl` are deleted.
  *Reconnect* lands on the Posting credential card, which shows the token's status. So we no
  longer need Carmen to name a reconnect route.
- **No other entry point.** No Home tile and no queue-header link. Carmen's menu is the
  front door (the user's call).
- **It lives under the module it configures**, beside `/mapping` and `/review`, because
  every rule on it is a bank rule that feeds the Credit Card queue (the user's call, the same
  day). It was first built at `#/email-settings`. That path now redirects with its query, so a
  menu link built against it still signs in.
- **The page is customer-facing now.** It gets a *Back to queue* link that asks before
  dropping unsaved edits. The posting-token card shows status, and keeps paste/delete folded
  under *Set a token manually* (support's fallback until Carmen mints on open), with Delete
  confirmed first. "Owner emails" is renamed "Your email addresses" to match the queue's
  phrase for `sender_not_allowed`. It stays English-only.
- **Nothing on the API moves.** `PUT /api/v1/carmen/settings` stays the one writer of every
  field. `auto_post` and `doc_type` still merge on omit, which costs nothing with one client
  and still protects against an old build or a script.

**Why.** One screen means no hand-overs: a new field is ours to build and ship. The feature's
whole working surface sits in one app: the queue, the GL mapping, Detail/Summary, and now the
settings. The links finally follow the writer, which is what #101 was about in the first
place.

**What it costs.**

- Until Carmen ships its menu item, a BU reaches the page only through a fix button or a URL
  that support sends. That is accepted: no in-app entry, by decision.
- A fix pressed inside the review dialog leaves the dialog in the same tab, as *Fix mapping*
  always did.
- The browser's Back button is not guarded against an unsaved form (`ponytail:` comment in
  `EmailSettings.tsx`).

**No data migration, no API change.**

## 35. The posting token rides the menu link (2026-10-01)

**Decided:** 2026-10-01, the same day as #34, at the user's call. It replaces #34's "mints
the BU's posting token if `GET /settings/token` says none is live, then opens our page".

**Decision.** Carmen's menu mints a fresh BU posting token on **every** open and passes it
in the settings link as `posting_token`, beside the user's `token`. Carmen calls none of our
endpoints. Our page stores it through `PUT /settings/token` before it reads anything.

- **Nothing piles up.** Carmen confirmed that minting replaces the BU's previous token, which
  stops working. So minting on every open is a rotation, not a growing set of live
  credentials that never expire.
- **Two tokens, kept apart.** `token` is the person at the screen: SSO, and the auth for
  every settings call. `posting_token` is the BU's, and it is only stored. `useCarmenSSO`
  stashes it in sessionStorage (`CARMEN_POSTING_TOKEN_KEY`, cleared with the session) and does
  not send it. A brand-new BU has no tenant row until `/exchange` has run, and a shared hook
  has no business importing a feature's API. `useEmailSettings.reload()` sends it first.
- **Storing it must not fail quietly.** The open that delivered the token also killed the one
  we hold, so a failed store means nothing posts. The page then says so in the top banner and
  on the credential card ("New token from Carmen not stored"), and keeps the token so
  *Reload* retries. A token pasted by hand clears it, so a later Reload cannot write the
  stale one back.
- **A refused old token no longer marks the new one dead.** `mark_token_unverified` now takes
  the token Carmen refused and clears `verified_at` only when its fingerprint matches what is
  stored. Rotation on every open made the race routine: a post that set out before the open
  is refused after the new token has landed.

**Why a credential in a URL is acceptable.** It sits after `#`, so no server sees it,
neither ours nor Carmen's, and it is never in a `Referer`. The SSO hook strips the query
from the address bar on arrival, and Sentry's redaction now covers `posting_token=`. What is
left is the local browser history, and a token there dies the next time anyone opens the
menu.

**What it costs.** If the person who opened the menu closes the tab before the page has
stored the token (about a second), posting stops until the next open. The other way round,
with Carmen `PUT`ting it before opening the link, had no browser in the middle, but took two
API calls on Carmen's side. The user chose the link.

**Revocation: the token outlives the OFF switch, accepted** (the user's call, the same day).
#34 left Carmen one question: the OFF switch moved to our screen, so who revokes the BU token
when a customer switches the feature off? The answer is nobody, on purpose. Nothing uses the
token while the BU is off, because the ingest loop skips it. It is stored encrypted and never
returned, and the next menu open replaces it anyway. Deleting our copy on OFF was the other way
we could do it on our own, but it strands a customer who switches back on in the same visit:
they would have to reopen from Carmen's menu. Carmen's checklist loses item C. Nothing is
waiting on Carmen except the menu item.

## 36. A settlement report is reviewed in the fee invoice's JV table (2026-10-05)

The review modal showed a settlement report in its own read-only pane (`ARReviewPane`) since
2026-09-16, because the feature then had its own settings screen and mapping table. #29 folded
both into the credit-card mapping, so a settlement key is the same kind of rule as a fee
invoice's payment type. The modal now uses `JvEditor` for both document types: header,
Dept/Account pickers, comments, amounts and the input-tax panel.

- **The browser builds the settlement JV.** `buildJvRows` gained the settlement branch of
  `build_jv_rows` (grouping by Credit breakdown, debit legs from the total row). Two settlement
  cases in `contracts/cc-jv.contract.json` pin the two builders together, as they already were
  for the fee invoice.
- **Approve still rebuilds, and now refuses a JV that differs from the screen.** The server
  builds from the `extracted` it is sent (edited lines and total row) and the config the review
  screen saves just before. It then compares that with the rows the screen sent:
  - same legs, accounts and figures → it posts, with each leg's comment from the screen;
  - anything else → it refuses ("changed since the review screen built it"). That only happens
    when something moved under the reviewer, such as a colleague's mapping save or a Credit
    breakdown switched in another browser. The screen re-reads both when the mapping page saves
    in this browser.
- **Edits land where the server reads them.** A credit leg's figure goes into its line(s). A
  debit leg's goes into the total row, which is also what the input-tax record files from.
- **The input-tax record is the reviewer's choice now**, as on a fee invoice. Until now a
  settlement report always filed it (#28), because no panel offered the choice.
- **Still not guessed.** JvEditor's AI fill is off for a settlement report. Ingest suggests
  nothing for one (`_run_document`), and extending guess-then-approve to it remains its own
  decision.

Dropped with the pane: the disclosure of which printed labels a Summary leg folded, and the rows
for lines printed at zero.

## 37. KBANK's rule is a reconciliation toggle, and its files are its own (2026-10-05)

#31 made the rule's `doc_type` the settlement switch, but the BU still typed the filename
patterns that decided which KBANK file was read (`KB1P554V2` for one tenant, `KB1P554V2_SUM`
for another). The settings dialog offered the document type as a `<select>` on every bank's
rule, though only KBANK has a settlement layout.

**Decision.** On the KBANK rule, `doc_type` names the files and patterns are not used:

| Toggle "Detailed Credit Card AR Reconciliation" | Reads | Tax summary CSV in the same zip |
|---|---|---|
| off (`fee_invoice`) | `E-TAX_INVOICE_CARD_*` | when present: its TIN into `foreign_tax_id`, fee and VAT cross-checked; absent is fine |
| on (`ar_reconcile`) | `SUM_<merchant_id>` only | as before; absent → `tin_unverified` |

- **One merchant per bank,** a new rule field `merchant_id`. It is required when the toggle is
  on and stored as digits. A rule saved before it existed reads any settlement report until it
  is saved again.
- **KBANK's two files are the KBANK rule's alone** (`imap.match_rules`). While a KBANK rule
  exists, on or off, no other rule may claim either file. This closes the gap #31 named: an
  "Other" `.pdf` rule could read the commission tax invoice beside a settlement report that
  already books the commission and its VAT. A settlement report is never read as a fee
  invoice, with or without a rule.
- **The dialog shows the toggle on the KBANK rule only,** with a Merchant ID field when it is
  on. The patterns field is hidden there, and a "Reads …" line says which file is read.

**Why in code, not in data.** These two files are fixed by KBANK, not chosen by the BU. A typed
pattern was one more way to read the wrong one: the version prefix (`KB1P554V2`) can change,
and a broad pattern catches both files.

**What it costs.** A KBANK file renamed before forwarding is no longer read by the KBANK rule.
Neither is any third KBANK document a BU might once have matched by pattern.
