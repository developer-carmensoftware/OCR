/**
 * The review queue — a BU's own view of what email automation is holding for them.
 *
 * Session JWT, not the raw Carmen token: these are our endpoints answering our frontend.
 * `/api/v1/carmen/*` (the settings API Carmen's own server calls) is the other thing, and
 * `emailAutomation.ts` is where that lives.
 */

import { apiFetch } from './client'
import { API } from './endpoints'
import type { Page } from './page'

/** Why a parked document might be worth opening. Computed once at park time and stored,
 *  because neither survives a list query: see `_review_flags` in email_ingest_service.py. */
export type ReviewFlag =
  'unbalanced' | 'mapping_guessed' | 'mapping_missing' | 'doc_no_missing' | 'warnings'

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
 *  never-charged rows. Both are counted, neither carries a dot. */
export type ActivityFilter = 'all' | 'today' | 'review' | 'success' | 'unposted'

/** The strip, left to right: the day, then the order a document moves through, then the log.
 *
 *  The first three are also the fall-through order the page opens on — `today`, then
 *  `review`, then `success`, stopping at the first with anything in it (`useReviewQueue`).
 *  Today reads first because it is the question asked on arrival, and a BU with twelve
 *  documents owed is still never shown a quiet morning: an empty chip hands over rather than
 *  holding. `all` is last because nobody arrives asking for everything — it is where you go
 *  when a document you expected is not in any of the others. */
export const ACTIVITY_FILTERS: ActivityFilter[] = ['today', 'review', 'success', 'unposted', 'all']

export interface ReviewDocument {
  id: string
  /** Where the document came in from. `manual` rows are scans someone ran through the
   *  wizard; they only ever appear once posted, so they are always `status: 'posted'`. */
  source: 'email' | 'manual'
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
}

/** One document, opened. `extracted` is an `/extract` response verbatim, which is exactly
 *  what `useOcrExtraction.applyExtractedData` consumes. */
export interface ReviewDocumentDetail extends ReviewDocument {
  extracted: Record<string, unknown>
}

/** Which of the automation page's four states to render, in one call. `blockers` comes
 *  from the settings service unchanged, so this screen and #/email-settings cannot
 *  disagree about whether a BU is set up. */
export interface ReviewStatus {
  enabled: boolean
  auto_post: boolean
  entitled: boolean
  ingest_address: string | null
  blockers: string[]
  // The endpoint also returns per-tab `counts`, deliberately not typed here: the chips are
  // fed by `listActivity`, which is the only source that also knows about manual scans.
}

/** The activity window plus the counts behind the filter chips. Counts span every row, not
 *  the page — same shape reason `NotificationList` carries `unread_count`. */
export interface ActivityPage extends Page<ReviewDocument> {
  counts: Record<string, number>
  /** Same keys as `counts`: of those rows, how many are wrong in some way — a failure of
   *  any kind, a document claimed and never finished, or a JV that posted without its
   *  input-tax record. Not "what you can fix"; see `_attention` in
   *  routers/credit_card_activity.py for why that was the wrong line to draw.
   *
   *  A lifetime figure. It sizes the pile for the screen-reader sentence; it is **not**
   *  what decides whether the dot shows. */
  attention: Record<string, number>
  /** Same keys again: which chips are holding an anomaly nobody in this BU has looked at.
   *  This is what renders the dot. Nothing retries a failure, so a dot drawn from
   *  `attention` alone would be lit for good — `markChipSeen` is what puts it out. */
  unseen: Record<string, boolean>
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

/**
 * Put that chip's dot out — for everyone in the business unit, not just this browser.
 *
 * The server stores the anomaly count it computes for itself; nothing is sent but the chip
 * name. Failure is silently survivable (the dot simply stays on until next time), so the
 * caller does not await this or surface an error for it.
 *
 * Only a status chip has a mark; `today` and `all` are 400ed by the endpoint. Neither is
 * ever passed, because the caller fires this only for a chip whose dot is lit, and the
 * server sends no `unseen` entry for either.
 */
export async function markChipSeen(filter: ActivityFilter): Promise<void> {
  const res = await apiFetch(API.creditCard.activitySeen, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter }),
  })
  if (!res.ok) throw new Error(`Could not mark seen (${res.status})`)
}

/**
 * Put a row away. It leaves the Review chip and stays under Not posted.
 *
 * Nothing is destroyed, which is why the caller offers no confirmation and no undo — the
 * row keeps its whole story, it just stops being work. The server refuses a row that still
 * has a payload: a document waiting for review is Rejected, which records who and why.
 */
export async function dismissRow(id: string): Promise<void> {
  const res = await apiFetch(API.creditCard.activityDismiss(id), { method: 'POST' })
  if (!res.ok) throw new Error(`Could not dismiss (${res.status})`)
}

export async function getPending(id: string): Promise<ReviewDocumentDetail> {
  const res = await apiFetch(API.emailReview.document(id))
  if (!res.ok) throw new Error(`Document fetch failed (${res.status})`)
  return res.json() as Promise<ReviewDocumentDetail>
}

export async function getReviewStatus(): Promise<ReviewStatus> {
  const res = await apiFetch(API.emailReview.status)
  if (!res.ok) throw new Error(`Review status fetch failed (${res.status})`)
  return res.json() as Promise<ReviewStatus>
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
 * it follows the document date, and that is where a misread one is corrected.
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
    // first. Both are things the reviewer needs to read, so surface the detail.
    const detail = await res
      .json()
      .then(d => (d as { detail?: string }).detail)
      .catch(() => null)
    const err = new Error(detail || `Approve failed (${res.status})`)
    ;(err as Error & { status?: number }).status = res.status
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

/** Turn review off, or back on. Its own endpoint: the settings save is a full replace,
 *  so flipping this through it would rewrite rules and passwords as a side effect. */
export async function setAutoPost(on: boolean): Promise<boolean> {
  const res = await apiFetch(API.emailReview.autoPost, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auto_post: on }),
  })
  if (!res.ok) throw new Error(`Could not save (${res.status})`)
  return ((await res.json()) as { auto_post: boolean }).auto_post
}
