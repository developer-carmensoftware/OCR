/**
 * A parked PMS day (CA-119) — the review modal's API. A day is one JV: Carmen's hook named
 * it, the server read it back from Carmen's Data Bank and parked it here.
 *
 * Carmen's engine posts it, by the BU's PMS setting in Carmen (decision-log #43): debit,
 * credit and totals are never computed here, and the screen shows no amounts. The response
 * still carries each row's amount, the AI's confidence and reason, and the setting and counter
 * account Carmen posts with; nothing reads them.
 */

import { apiFetch } from '@/shared/api/client'
import { API } from '@/shared/api/endpoints'

/** One row as Carmen keys it, with the account Carmen's mapping table gives it (if any). */
export interface PmsRow {
  /** The mapping key: the key columns' values as a JSON array. Opaque to the screen. */
  key: string
  values: Record<string, string>
  dept?: string | null
  acc?: string | null
  name?: string | null
}

/** A row Carmen's mapping table has no account for, with the AI's pick when it made one. */
export interface PmsNewCode {
  key: string
  /** "100 · Room Charge - VAT" */
  label: string
  values: Record<string, string>
  dept: string | null
  acc: string | null
}

export interface PmsDay {
  id: string
  interface: string
  doc_type: string
  doc_date: string
  reason_code: string | null
  error_message: string | null
  /** The mapping key's columns, in order (`Code`, `Description` for Comanche). */
  key_columns: string[]
  rows: PmsRow[]
  /** How many of the day's keys Carmen's table already maps. */
  mapped_count: number
  new_codes: PmsNewCode[]
}

export interface PmsApproveResult {
  /** Carmen's engine does not return the JV's number yet (CA-116). */
  jv_no: string | null
  /** Carmen had already posted this day — by its own Post button, or an earlier approve. */
  already_posted: boolean
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

/** Write the new rows' accounts into Carmen's mapping and have Carmen post the day. 400
 *  carries why it cannot post, 409 that someone else got there first — both are things the
 *  reviewer needs to read. */
export async function approvePmsDay(
  id: string,
  mappings: Record<string, { dept: string; acc: string }>
): Promise<PmsApproveResult> {
  const res = await apiFetch(API.pms.approve(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mappings }),
  })
  if (!res.ok) throw await failure(res, 'Approve failed')
  return res.json() as Promise<PmsApproveResult>
}

export async function rejectPmsDay(id: string, reason?: string): Promise<void> {
  const res = await apiFetch(API.pms.reject(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || null }),
  })
  if (!res.ok) throw await failure(res, 'Reject failed')
}
