/** The slip-review order queue, AR customer profiles and Carmen AR posting. */

import { buildQs, unwrapDetail } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'
import type { Page } from '@/shared/api/page'

export type AdminOrderStatus = 'in_progress' | 'paid' | 'complete' | 'void' | 'on_hold'

export interface AdminCreditOrder {
  id: string
  pack_code: string
  credits: number
  amount_thb: number
  status: AdminOrderStatus
  tenant_id: string | null
  tenant_name: string | null
  created_at: string | null
  slip_uploaded_at: string | null
  approved_at: string | null
  approved_by: string | null
  expires_at: string | null
  rejected_reason: string | null
  admin_note: string | null
  carmen_ar_posted_at: string | null
  carmen_ar_ref: string | null
  proforma_number: string | null
  buyer_name: string | null
  carmen_ar_code: string | null
}

export interface ArCustomerProfile {
  id: string
  buyer_name: string
  buyer_tax_id: string
  buyer_branch: string
  carmen_ar_code: string | null
}

export interface KpiSummary {
  unmapped_count: number
  to_review_count: number
  to_post_count: number
  // Funnel amounts (THB): total = awaiting + to_review + on_hold + to_post + posted (excl. void).
  total_amount: number
  awaiting_amount: number
  to_review_amount: number
  on_hold_amount: number
  to_post_amount: number
  posted_amount: number
  rejected_amount: number
  status_counts: Record<string, number>
}

export interface PostArResultItem {
  order_id: string
  success: boolean
  carmen_ar_ref: string | null
  error: string | null
}

export interface PostArResponse {
  results: PostArResultItem[]
}

export interface HoldBatchResultItem {
  order_id: string
  success: boolean
  error: string | null
}

export interface HoldBatchResponse {
  results: HoldBatchResultItem[]
}

export async function fetchAdminPaymentInfo(): Promise<import('@/shared/api/credits').PaymentInfo> {
  const res = await adminFetch(API.admin.paymentInfo)
  if (!res.ok) throw new Error('Failed to load payment info')
  return res.json()
}

/**
 * Order queue across companies (scoped admins see only their own).
 * `status='all'` returns every status; `tenantId` narrows to one company's history.
 *
 * Asks for the endpoint's own cap (200) in one go and pages client-side, because the
 * table's company search filters what is already loaded — a server window would make
 * search only ever look at the page on screen. `total` is what tells the UI to say so
 * when even 200 was not everything.
 */
export async function listCreditOrders(
  status: AdminOrderStatus | 'all' = 'in_progress',
  tenantId?: string,
  hasSlip?: boolean,
  limit = 200
): Promise<Page<AdminCreditOrder>> {
  const res = await adminFetch(
    `${API.admin.creditOrders}${buildQs({ status, tenant_id: tenantId, has_slip: hasSlip, limit })}`
  )
  if (!res.ok) throw new Error('Failed to load credit orders')
  return res.json()
}

/** Short-lived (300s) signed URL for the uploaded payment slip. */
export async function getOrderSlipUrl(id: string): Promise<{ signed_url: string }> {
  const res = await adminFetch(API.admin.creditOrderSlipUrl(id))
  if (!res.ok) {
    // The status travels with the error: 404 is a file storage no longer has, which the
    // drawer explains, as opposed to a storage failure it can only call "unavailable".
    const err = new Error(await unwrapDetail(res, 'Failed to load slip'))
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }
  return res.json()
}

export async function approveOrder(id: string): Promise<AdminCreditOrder> {
  const res = await adminFetch(API.admin.creditOrderApprove(id), { method: 'POST' })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Approve failed'))
  return res.json()
}

export async function rejectOrder(id: string, reason: string): Promise<AdminCreditOrder> {
  const res = await adminFetch(API.admin.creditOrderReject(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Reject failed'))
  return res.json()
}

/** Update the admin-only note on an in-progress order. */
export async function updateOrderNote(id: string, note?: string): Promise<AdminCreditOrder> {
  const res = await adminFetch(API.admin.creditOrderNote(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Update failed'))
  return res.json()
}

export async function fetchAdminOrderDocuments(
  id: string
): Promise<import('@/shared/api/credits').BillingDocument[]> {
  const res = await adminFetch(API.admin.creditOrderDocuments(id))
  if (!res.ok) throw new Error('Failed to load order documents')
  return res.json()
}

export async function listArProfiles(
  search?: string,
  unmappedOnly?: boolean
): Promise<ArCustomerProfile[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (unmappedOnly) params.set('unmapped_only', 'true')
  const qs = params.toString() ? `?${params}` : ''
  const res = await adminFetch(`${API.admin.arProfiles}${qs}`)
  if (!res.ok) throw new Error('Failed to load AR profiles')
  return res.json()
}

export async function updateArProfile(id: string, arCode: string): Promise<ArCustomerProfile> {
  const res = await adminFetch(API.admin.arProfile(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carmen_ar_code: arCode }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Update AR code failed'))
  return res.json()
}

export async function syncArProfiles(): Promise<{ inserted: number; scanned: number }> {
  const res = await adminFetch(API.admin.arProfilesSync, { method: 'POST' })
  if (!res.ok) throw new Error('Sync failed')
  return res.json()
}

export async function postArBatch(orderIds: string[]): Promise<PostArResponse> {
  const res = await adminFetch(API.admin.creditOrdersPostAr, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_ids: orderIds }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'AR posting failed'))
  return res.json()
}

/** Batch-park in-progress orders to on_hold (manual version of the expiry sweep). */
export async function holdBatch(orderIds: string[]): Promise<HoldBatchResponse> {
  const res = await adminFetch(API.admin.creditOrdersHoldBatch, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_ids: orderIds }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Hold failed'))
  return res.json()
}

export async function fetchKpi(): Promise<KpiSummary> {
  const res = await adminFetch(API.admin.creditOrdersKpi)
  if (!res.ok) throw new Error('Failed to load KPI')
  return res.json()
}
