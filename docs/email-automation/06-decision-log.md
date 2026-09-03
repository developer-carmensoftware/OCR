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
`false`, flipped in the queue's own settings once the queue has been getting it right.

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

## 20. Superseded designs, and where they live

- **`feat/email-flow`** — the v1 design: a human-approval review step before posting, its
  own admin UI, `email_flow_*` migrations. Deliberately never merged; kept only as
  historical reference for UX and endpoint shape. **Not cherry-pickable** — v2 removed the
  approval step and moved settings ownership to Carmen's own screen, and is a different
  architecture end to end, not a superset of v1. #18 above brings the *idea* back on v2's
  architecture; it does not bring back this branch's code, and that distinction is why it
  cost days instead of weeks.
- **`poc/email-commission-automation`** — the original proof-of-concept the whole feature
  grew from.

Neither branch has a remote; both exist locally only, for reference.
