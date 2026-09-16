import { apiFetch } from './client'
import { API } from './endpoints'

/** Detailed Credit Card AR Reconciliation — settings, mappings and the JV preview. */

export type PostType = 'Detail' | 'Summary'
export const POST_TYPES: PostType[] = ['Detail', 'Summary']

export interface ARMappingItem {
  payment_type_code: string
  payment_type_desc?: string | null
  credit_dept_code?: string | null
  credit_account_code?: string | null
  is_active: boolean
}

/** One link in the chain between an arriving email and a posted JV. Every one of them
 *  fails silently on its own, which is why the screen states all of them. */
export interface ARBlocker {
  key: string
  ok: boolean
  detail?: string | null
}

/** One row of the bank selector, as the server lists it. */
export interface ARBankOption {
  code: string
  name: string
  /** This release can read this bank's settlement report. The rest are listed anyway —
   *  FRD Out-of-Scope puts SCB, BBL and BAY in Phase 2, and a roadmap the customer cannot
   *  see is not a roadmap. */
  supported: boolean
}

export interface ARSettings {
  bank_code: string
  enabled: boolean
  post_type: PostType
  jv_description_template: string
  debit_dept_code?: string | null
  debit_account_code?: string | null
  /** Keyed by post type. Both sets travel together so saving from one view cannot
   *  delete the other's rows. */
  mappings: Record<string, ARMappingItem[]>
  blockers: ARBlocker[]
  /** The selector's options. The screen keeps no bank list of its own — names come from
   *  the `banks` table and `supported` from the server's own SUPPORTED_BANKS. */
  banks: ARBankOption[]
}

export interface ARPreviewRow {
  dept: string
  acc: string
  desc: string
  debit: number
  credit: number
  /** The group this leg is, as the server's `group_key` resolved it. Empty on the debit
   *  leg, which is the counterpart to all of them. What the review pane joins the printed
   *  payment types back to — `desc` carries the same text behind a document-number prefix
   *  that is not always there. */
  key: string
}

export interface ARPreview {
  rows: ARPreviewRow[]
  description: string
  doc_no: string
  doc_date: string
  total_debit: number
  total_credit: number
  balanced: boolean
  unmapped: string[]
  /** Which grouping produced these rows. The union, not `string`, like every other
   *  `post_type` in this file: the review pane switches its whole table on
   *  `post_type === 'Summary'`, and against `string` a drift from the server's
   *  `PostType.SUMMARY` would render every Summary document as Detail without a word. */
  post_type: PostType
  /** The debit leg (the row with no `key`) has no dept or no account. A JV in this state
   *  balances and posts, but the control account it exists to clear never reaches zero —
   *  see `control_leg_missing` in ar_reconcile_jv.py. Populated on the per-document path
   *  only (`GET /email/pending/{id}`, via `jv_for_document`). */
  control_missing: boolean
}

export async function getARSettings(bankCode: string): Promise<ARSettings> {
  const res = await apiFetch(API.arReconcile.settings(bankCode))
  if (!res.ok) throw new Error(`AR settings fetch failed (${res.status})`)
  return res.json() as Promise<ARSettings>
}

/** `blockers` and `banks` are things the server tells the screen, not things it saves. */
export async function saveARSettings(
  payload: Omit<ARSettings, 'blockers' | 'banks'>
): Promise<void> {
  const res = await apiFetch(API.arReconcile.save, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    // The server refuses an enabled bank it cannot read; that message names which banks
    // it can, so it is worth showing rather than a status code.
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || `AR settings save failed (${res.status})`)
  }
}

export interface ARMappingPatchRequest {
  bank_code: string
  post_type: PostType
  /** Only the payment types actually touched — an upsert, not a replace. See
   *  `svc.upsert_mapping_rows` for why this is a separate, narrower endpoint from
   *  `saveARSettings`. */
  rows: ARMappingItem[]
}

/** The review modal's save path: persist just the payment types a reviewer fixed or
 *  mapped inline, without touching the rest of the bank's configuration. */
export async function patchARMappings(payload: ARMappingPatchRequest): Promise<void> {
  const res = await apiFetch(API.arReconcile.mappings, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || `AR mapping save failed (${res.status})`)
  }
}

export interface ARPreviewRequest {
  bank_code: string
  post_type: PostType
  jv_description_template: string
  debit_dept_code?: string | null
  debit_account_code?: string | null
  mappings: ARMappingItem[]
}

export async function previewARJv(payload: ARPreviewRequest): Promise<ARPreview> {
  const res = await apiFetch(API.arReconcile.preview, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`AR preview failed (${res.status})`)
  return res.json() as Promise<ARPreview>
}

/** The payment types this tenant's own most recently parked report for `bankCode`
 *  actually printed, so the table has real rows before anything is saved — falls back
 *  server-side to a built-in KBANK sample only if nothing has ever been parked. */
export async function getSamplePaymentTypes(bankCode: string): Promise<ARMappingItem[]> {
  const res = await apiFetch(API.arReconcile.samplePaymentTypes(bankCode))
  if (!res.ok) throw new Error(`Sample payment types failed (${res.status})`)
  return res.json() as Promise<ARMappingItem[]>
}
