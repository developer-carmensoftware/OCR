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
}

export interface ARPreviewRow {
  dept: string
  acc: string
  desc: string
  debit: number
  credit: number
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
}

export async function getARSettings(bankCode: string): Promise<ARSettings> {
  const res = await apiFetch(API.arReconcile.settings(bankCode))
  if (!res.ok) throw new Error(`AR settings fetch failed (${res.status})`)
  return res.json() as Promise<ARSettings>
}

export async function saveARSettings(payload: Omit<ARSettings, 'blockers'>): Promise<void> {
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

/** The payment types KBANK prints, so the table has rows before the first document
 *  arrives — otherwise the only way to populate it is to be charged for one. */
export async function getSamplePaymentTypes(): Promise<ARMappingItem[]> {
  const res = await apiFetch(API.arReconcile.samplePaymentTypes)
  if (!res.ok) throw new Error(`Sample payment types failed (${res.status})`)
  return res.json() as Promise<ARMappingItem[]>
}
