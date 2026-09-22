import { apiFetch } from './client'
import { API } from './endpoints'
import type { FieldMapping } from '../../types/api'

/** A settlement report's per-bank posting profile, and the JV preview it produces.
 *
 * Reshaped 2026-09-22 (decision #3, docs/email-automation/06-decision-log.md #29): the
 * payment-type mapping this feature used to own moved into
 * `bu_accounting_mapping_entries`, saved through `PUT /api/v1/config/accounting`
 * alongside commission/tax/net — not through this module any more. Reshaped again the
 * same day (Ticket D): the JV description template moved there too, so `ARSettings`
 * carries only `enabled` / `post_type` now. What is left here is that posting profile
 * and the JV preview, which still needs the *unsaved* form state to track edits live.
 */

export type PostType = 'Detail' | 'Summary'
export const POST_TYPES: PostType[] = ['Detail', 'Summary']

/** One payment type a settlement report has printed, before it has a GL account of its
 *  own — `getSamplePaymentTypes`' only remaining shape. Once a code has an account it is
 *  an ordinary entry in `AccountingConfigResponse.mappings`, like any other. */
export interface ARMappingItem {
  payment_type_code: string
  payment_type_desc?: string | null
}

export interface ARSettings {
  bank_code: string
  enabled: boolean
  post_type: PostType
}

/** `ARSettings` plus what only the server can answer: whether this bank has a
 *  settlement layout at all (`banks.settlement_grouping is not null`) — what decides
 *  whether the merged mapping page's Settlement card renders for the bank currently
 *  selected. Not saved. */
export interface ARSettingsResponse extends ARSettings {
  has_settlement_layout: boolean
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
}

export async function getARSettings(bankCode: string): Promise<ARSettingsResponse> {
  const res = await apiFetch(API.arReconcile.settings(bankCode))
  if (!res.ok) throw new Error(`AR settings fetch failed (${res.status})`)
  return res.json() as Promise<ARSettingsResponse>
}

export async function saveARSettings(payload: ARSettings): Promise<void> {
  const res = await apiFetch(API.arReconcile.save, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    // The server refuses an enabled bank it cannot read; that message names why, so it
    // is worth showing rather than a status code.
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || `AR settings save failed (${res.status})`)
  }
}

export interface ARPreviewRequest {
  bank_code: string
  post_type: PostType
  /** Keeps its name for minimal diff (Ticket D, 2026-09-22) but is no longer
   *  settlement-only wording — it is whatever the merged page's one Description field
   *  currently resolves to for this bank (`descriptionForBank`), tag or no tag,
   *  rendered server-side the same way a real post would (`render_description`). */
  jv_description_template: string
  /** The merged mapping page's *whole* live mapping dict — commission/tax/net, every
   *  fee-invoice payment type, and this bank's settlement credit-side rows, all in the
   *  same shape `AccountingConfigResponse.mappings` already is. Sending the same shape
   *  the page already holds in memory means no reshaping at the call site. */
  mappings: Record<string, FieldMapping>
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
