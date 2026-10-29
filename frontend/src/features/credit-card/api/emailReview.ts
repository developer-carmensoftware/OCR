/**
 * The review queue — a BU's own view of what email automation is holding for them.
 *
 * Session JWT, not the raw Carmen token: these are our endpoints answering our frontend.
 * `/api/v1/carmen/*` (the settings API Carmen's own server calls) is the other thing, and
 * `emailAutomation.ts` is where that lives.
 */

import { apiFetch } from '@/shared/api/client'
import { API } from '@/shared/api/endpoints'
import type { ARPreview } from './arReconcile'
import type { Page } from '@/shared/api/page'

/** Why a parked document might be worth opening. Computed once at park time and stored,
 *  because neither survives a list query: see `_review_flags` in email_ingest_service.py. */
export type ReviewFlag =
  | 'unbalanced'
  | 'mapping_guessed'
  | 'mapping_missing'
  | 'doc_no_missing'
  | 'warnings'
  // AR reconciliation only: the settlement report's own page prints no tax ID, so
  // `foreign_tax_id` has nothing to check unless the CSV sidecar (ticket 04) supplied
  // one by merchant ID. Not a conflict — that is `tax_id_mismatch`, a terminal reason
  // code raised earlier and never reaching a flag — just an unattended post this
  // document has not earned yet. See `_review_flags` in email_ingest_service.py.
  | 'tin_unverified'

/** Which filter chip a row lives under — see `_chip_expr` in routers/credit_card_activity.py,
 *  which is the only definition there is.
 *
 *  `success` and `unposted` are both about a document this BU **paid to have read**: it
 *  posted, or it did not. An attachment nobody was charged for — a filename rule refusing a
 *  signature logo, a sender the BU never allowed — is in neither, because it is not a
 *  document that failed to post, it is a file that was never one.
 *
 *  `today` and `all` are the two that are not about state. `today` selects on *time* and
 *  overlaps all the others, which is why the server leaves it out of `counts.all`. `all`
 *  selects on nothing at all: it is the module's log, and the only view that shows the
 *  never-charged rows. */
export type ActivityFilter = 'all' | 'today' | 'review' | 'success' | 'unposted'

/** The strip: the work, then the log (§24). Two chips because the page is for what somebody
 *  here has to do — everything else is one chip further, behind `ALL_SCOPES`. */
export const QUEUE_CHIPS = ['review', 'all'] as const satisfies readonly ActivityFilter[]

/** What the All chip's dropdown narrows the log to, one at a time — every value the API
 *  already answered when these were chips of their own. `all` first: clicking the chip, or
 *  landing on it, shows everything. */
export const ALL_SCOPES = [
  'all',
  'today',
  'success',
  'unposted',
] as const satisfies readonly ActivityFilter[]

export interface ReviewDocument {
  id: string
  /** Where the document came in from. `manual` rows are scans someone ran through the
   *  wizard: `status: 'posted'` once they became a JV, `'scanned'` if they were charged
   *  and never posted. */
  source: 'email' | 'manual' | 'pms'
  created_at: string | null
  attachment: string
  /** The raw ledger status, not the tab. `problem` covers two of these and the row has
   *  to say which: a document Carmen refused and one a colleague rejected are the same
   *  errand but not the same story. */
  status: string
  bank_code: string | null
  doc_no: string | null

  // Only while pending_review — `_finish` clears the payload these come from, so on a
  // resolved row they are absent rather than stale. Rendering `0.00` for a posted
  // document would not be a missing value, it would be a wrong one.
  doc_date: string | null
  /** Gross (Σ pay_amt) — what lands on the credit side of the JV, so what a reviewer
   *  is agreeing to. Not the net. */
  total: number
  line_count: number
  flags: ReviewFlag[]
  /** Payment types nothing could map. The review screen renders an empty picker per
   *  entry; the reviewer fills them and the JV becomes postable. */
  unmapped: string[]
  /** GL rules the AI invented during ingest, by config field type. Marked for checking —
   *  `flags` only says one of them was guessed, which is not enough to point at. */
  guessed: string[]

  // Plain ledger columns, kept for ever.
  jv_no: string | null
  /** Why the pipeline stopped. Once only set on a resolved row — but since a refusal that
   *  came *after* a paid-for extraction parks instead of finishing, a `pending_review` row
   *  can carry one too, and then it is the strongest thing the row has to say. */
  reason_code: string | null
  error_message: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  /** Who ran the scan, on a `manual` row only — resolved server-side from the session that
   *  did it, not a stored column, so it goes null once that session has been scrubbed. The
   *  row then says it was scanned by hand without naming anybody, which is the honest
   *  answer; a raw user id would not be. */
  posted_by_name: string | null
  /** A posted row whose JV owed VAT and whose input-tax record was never resolved — step 4
   *  died or was skipped, the reviewer unticked the box, or the filing was refused. Manual
   *  and email alike (CA-111). `recordInputTax` files it; `markInputTaxKeyed` settles it. */
  input_tax_owed?: boolean
  /** The card the input-tax endpoints are keyed on. A manual row's `id` already is one; an
   *  email row's `id` is its ledger row, so this is the only way from it to the card. */
  card_id?: string | null
}

/** One document, opened. `extracted` is an `/extract` response verbatim, which is exactly
 *  what `useOcrExtraction.applyExtractedData` consumes. */
export interface ReviewDocumentDetail extends ReviewDocument {
  extracted: Record<string, unknown>
  /** What the AI proposed for each key in `guessed`. Ingest no longer writes these to the
   *  BU's accounting config — a human approving is what does that — so the live config
   *  this screen derives its JV rows from will not have them, and this is the only copy. */
  suggested: Record<string, { dept?: string; acc?: string }>
  /** `fee_invoice` or `ar_reconcile`. Two different documents producing two different
   *  JVs; only the first is editable in the browser. */
  doc_type?: string
  /** AR reconciliation only: the JV this document would post, built server-side against
   *  the BU's current mapping. Approving posts exactly these rows — this feature has no
   *  client-side JV builder, so what is shown and what posts are one object. */
  ar_jv?: ARPreview | null
}

/** The activity window plus the counts behind the filter chips. Counts span every row, not
 *  the page — same shape reason `NotificationList` carries `unread_count`. */
export interface ActivityPage extends Page<ReviewDocument> {
  counts: Record<string, number>
}

export async function listActivity(
  filter: ActivityFilter,
  limit = 25,
  offset = 0
): Promise<ActivityPage> {
  const res = await apiFetch(
    `${API.creditCard.activity}?filter=${filter}&limit=${limit}&offset=${offset}`
  )
  if (!res.ok) throw new Error(`Activity fetch failed (${res.status})`)
  return res.json() as Promise<ActivityPage>
}

/** The server's words on a refusal — they are what the user needs to read. */
async function refusal(res: Response, fallback: string): Promise<Error> {
  const detail = await res
    .json()
    .then(d => (d as { detail?: string }).detail)
    .catch(() => null)
  return new Error(detail || `${fallback} (${res.status})`)
}

/** The late input-tax dialog's corrections (`LateInputTaxIn`): the approve panel's three,
 *  plus the branch, and the period — "YYYY-MM", one of the preview's `periods`. */
export interface LateInputTaxBody extends ItxOverrides {
  branch_no?: string
  period?: string
}

/**
 * File the input tax a posted card still owes, manual or email. Built server-side from the
 * sums stamped on the card with its JV, corrected by `body`, and posted with this user's own
 * Carmen token.
 *
 * 409 = nothing left to file (someone already did), 400 = the record cannot be built, the
 * period is outside the claim window, or Carmen refused it.
 */
export async function recordInputTax(cardId: string, body: LateInputTaxBody = {}): Promise<void> {
  const res = await apiFetch(API.creditCard.activityInputTax(cardId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await refusal(res, 'Could not record input tax')
}

/**
 * Settle it without filing: somebody keyed the record into Carmen by hand. No Carmen call —
 * it has no search on its register — so this is the user's word, and stored as theirs.
 */
export async function markInputTaxKeyed(cardId: string): Promise<void> {
  const res = await apiFetch(`${API.creditCard.activityInputTax(cardId)}/keyed`, {
    method: 'POST',
  })
  if (!res.ok) throw await refusal(res, 'Could not mark the input tax as keyed')
}

/** What the late-filing dialog shows (`InputTaxOwedOut`). Everything but `owed` is absent
 *  when nothing is owed. */
export interface InputTaxPreview {
  owed: boolean
  doc_no?: string | null
  doc_date?: string | null
  bank_code?: string | null
  branch_no?: string | null
  commis_amt?: number | null
  tax_amt?: number | null
  /** The bank's registered identity — what files when nobody overrides it. */
  vendor_name?: string | null
  tax_id?: string | null
  /** The months ("YYYY-MM") it may still be filed in, oldest — the default — first. */
  periods?: string[]
  /** The 6-month claim window has closed: it can only be marked keyed by hand. */
  expired?: boolean
}

/**
 * Whether a posted card still owes its input-tax record, and what the dialog shows when it
 * does. A deleted card, or another BU's, answers 404, which owes nothing.
 */
export async function inputTaxPreview(cardId: string): Promise<InputTaxPreview> {
  const res = await apiFetch(API.creditCard.activityInputTax(cardId))
  if (res.status === 404) return { owed: false }
  if (!res.ok) throw new Error(`Could not check the input tax (${res.status})`)
  return res.json() as Promise<InputTaxPreview>
}

/** `inputTaxPreview`'s yes/no alone — the wizard's draft-restore check. */
export async function inputTaxOwed(cardId: string): Promise<boolean> {
  return (await inputTaxPreview(cardId)).owed
}

export async function getPending(id: string): Promise<ReviewDocumentDetail> {
  const res = await apiFetch(API.emailReview.document(id))
  if (!res.ok) throw new Error(`Document fetch failed (${res.status})`)
  return res.json() as Promise<ReviewDocumentDetail>
}

export interface ApproveResult {
  jv_no: string
  /** Set when the JV posted but the input-tax record did not. The document is still
   *  posted and gone from the queue — the VAT is a separate errand, not a failure. */
  tax_note: string | null
}

/**
 * What the reviewer corrected on the input-tax record, as the server names it
 * (`InputTaxOverrides`). `undefined` means "not touched", which is what lets a derived
 * value show through rather than being replaced by an empty string on first render.
 *
 * Only the three things the machine can get wrong and a human can see. The amounts are
 * the JV's and are edited on its table; a record that disagreed with the journal it is
 * filed beside is the one outcome worse than no record. The tax period is likewise absent:
 * at approve it follows the document date, and that is where a misread one is corrected.
 * Filing late is the one place it is chosen (`LateInputTaxBody`).
 */
export interface ItxOverrides {
  vendor_name?: string
  tax_id?: string
  profile_code?: string
}

export async function approveDocument(
  id: string,
  body: {
    extracted: Record<string, unknown>
    rows: unknown[]
    post_input_tax: boolean
    /** Absent = derive the record, the way the unattended path does. */
    input_tax?: ItxOverrides
  }
): Promise<ApproveResult> {
  const res = await apiFetch(API.emailReview.approve(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    // 400 carries Carmen's own rejection message, 409 means someone else got there
    // first — or, with `code: duplicate_document`, that this is a copy of a document
    // already posted. All are things the reviewer needs to read, so surface the detail.
    const body = await res
      .json()
      .then(d => d as { detail?: string; code?: string })
      .catch(() => ({}) as { detail?: string; code?: string })
    const err = new Error(body.detail || `Approve failed (${res.status})`)
    Object.assign(err, { status: res.status, code: body.code })
    throw err
  }
  return res.json() as Promise<ApproveResult>
}

export async function rejectDocument(id: string, reason?: string): Promise<void> {
  const res = await apiFetch(API.emailReview.reject(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || null }),
  })
  if (!res.ok) throw new Error(`Reject failed (${res.status})`)
}
