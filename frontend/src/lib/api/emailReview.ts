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
export type ReviewFlag = 'unbalanced' | 'mapping_guessed' | 'warnings'

export interface ReviewDocument {
  id: string
  created_at: string | null
  attachment: string
  bank_code: string | null
  doc_no: string | null
  doc_date: string | null
  /** Gross (Σ pay_amt) — what lands on the credit side of the JV, so what a reviewer
   *  is agreeing to. Not the net. */
  total: number
  line_count: number
  flags: ReviewFlag[]
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
  pending: number
}

export async function listPending(limit = 25, offset = 0): Promise<Page<ReviewDocument>> {
  const res = await apiFetch(`${API.emailReview.documents}?limit=${limit}&offset=${offset}`)
  if (!res.ok) throw new Error(`Review queue fetch failed (${res.status})`)
  return res.json() as Promise<Page<ReviewDocument>>
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

export async function approveDocument(
  id: string,
  body: { extracted: Record<string, unknown>; rows: unknown[]; post_input_tax: boolean }
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
