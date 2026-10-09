/**
 * A parked PMS day (CA-119) — the review modal's API. A day is one JV: Carmen's hook named
 * it, the server read it back from Carmen's Data Bank and parked it here.
 *
 * Amounts are exact decimal strings, signed the way the JV posts them: + credit, − debit.
 */

import { apiFetch } from '@/shared/api/client'
import { API } from '@/shared/api/endpoints'

export interface PmsRow {
  type: string
  code: string
  desc: string
  amount: string
}

/** A code this BU has never approved an account for, with the AI's pick when it made one. */
export interface PmsNewCode {
  key: string
  code: string
  description: string
  type: string
  amount: string
  dept: string | null
  acc: string | null
  confidence: string | null
  why: string | null
}

export interface PmsDay {
  id: string
  interface: string
  doc_type: string
  doc_date: string
  reason_code: string | null
  error_message: string | null
  terms: { type: string; amount: string }[]
  /** How far the day is from balancing; "0.00" when debit equals credit. */
  off: string
  /** How many PMS codes the day uses, the two VAT/service rules not counted. */
  codes: number
  /** The BU's saved account for each key the day uses. */
  accounts: Record<string, { dept: string; acc: string }>
  new_codes: PmsNewCode[]
  rows: PmsRow[]
}

async function failure(res: Response, fallback: string): Promise<Error> {
  const detail = await res
    .json()
    .then(d => (d as { detail?: string }).detail)
    .catch(() => null)
  const err = new Error(detail || `${fallback} (${res.status})`)
  ;(err as Error & { status?: number }).status = res.status
  return err
}

export async function getPmsDay(id: string): Promise<PmsDay> {
  const res = await apiFetch(API.pms.day(id))
  if (!res.ok) throw await failure(res, 'Day fetch failed')
  return res.json() as Promise<PmsDay>
}

/** Save the new codes' accounts and post the day. 400 carries why it cannot post, 409 that
 *  someone else got there first — both are things the reviewer needs to read. */
export async function approvePmsDay(
  id: string,
  mappings: Record<string, { dept: string; acc: string }>
): Promise<{ jv_no: string }> {
  const res = await apiFetch(API.pms.approve(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mappings }),
  })
  if (!res.ok) throw await failure(res, 'Approve failed')
  return res.json() as Promise<{ jv_no: string }>
}

export async function rejectPmsDay(id: string, reason?: string): Promise<void> {
  const res = await apiFetch(API.pms.reject(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || null }),
  })
  if (!res.ok) throw await failure(res, 'Reject failed')
}
