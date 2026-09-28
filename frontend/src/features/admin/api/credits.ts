/** Top-up credits: balance, ledger, and admin grants/adjustments. */

import { buildQs, type QueryParams } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'
import type { Page } from '@/shared/api/page'

export interface CreditBalance {
  tenant_id: string
  balance: number
}

export interface CreditLedgerEntry {
  id: string
  delta: number
  balance_after: number
  reason: string
  pack_code: string | null
  ref: string | null
  note: string | null
  created_at: string | null
}

export async function fetchCreditBalance(tenantId: string): Promise<CreditBalance> {
  const res = await adminFetch(API.admin.tenantCredits(tenantId))
  if (!res.ok) throw new Error('Failed to fetch credit balance')
  return res.json()
}

export async function fetchCreditLedger(
  tenantId: string,
  params: QueryParams = {}
): Promise<Page<CreditLedgerEntry>> {
  const res = await adminFetch(`${API.admin.tenantCreditsLedger(tenantId)}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch credit ledger')
  return res.json()
}

export async function topupCredits(tenantId: string, packCode: string): Promise<CreditBalance> {
  const res = await adminFetch(API.admin.tenantCreditsTopup(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pack_code: packCode }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Top-up failed')
  }
  return res.json()
}

export async function adjustCredits(
  tenantId: string,
  delta: number,
  note?: string
): Promise<CreditBalance> {
  const res = await adminFetch(API.admin.tenantCreditsAdjust(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta, note }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Adjust failed')
  }
  return res.json()
}
