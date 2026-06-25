/**
 * Admin API client — separate from the Carmen OCR client.
 * Uses a distinct sessionStorage key so admin and OCR sessions never collide.
 */

import { createApiClient } from './client'
import { API } from './endpoints'

const ADMIN_TOKEN_KEY = 'ocr_admin_token'

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY)
}

export function storeAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY)
}

const adminFetch = createApiClient({
  tokenProvider: getAdminToken,
  unauthorizedEvent: 'admin:unauthorized',
  onUnauthorized: clearAdminToken,
  debounce401Ms: 0,
})

// ── Typed helpers ─────────────────────────────────────────────────────────────

export interface AdminUser {
  admin_id: string
  email: string
  roles: string[]
  permissions: string[]
  tenant_scope: string
  is_global: boolean
  mfa_passed: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
  admin_id: string
  email: string
  roles: string[]
  tenant_scope: string
  mfa_required: boolean
}

export async function adminLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await adminFetch(API.admin.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }))
    throw new Error(err.detail || 'Login failed')
  }
  return res.json()
}

export async function adminMe(): Promise<AdminUser> {
  const res = await adminFetch(API.admin.me)
  if (!res.ok) throw new Error('Failed to fetch admin profile')
  return res.json()
}

export async function adminLogout(): Promise<void> {
  await adminFetch(API.admin.logout, { method: 'POST' })
  clearAdminToken()
}

// ── Analytics endpoints ───────────────────────────────────────────────────────

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null
}

function buildQs(params: QueryParams): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function fetchUsageTotals(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.usageTotals}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch usage totals')
  return res.json()
}

export async function fetchUsageSummary(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.usageSummary}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch usage summary')
  return res.json()
}

export async function fetchTenantRanking(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.tenantRanking}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch tenant ranking')
  return res.json()
}

export async function fetchLLMLogs(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.llmUsage}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch LLM logs')
  return res.json()
}

export async function fetchPerformanceLogs(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.performanceLogs}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch performance logs')
  return res.json()
}

export async function fetchAlerts(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.alerts}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch alerts')
  return res.json()
}

export async function resolveAlert(alertId: number) {
  const res = await adminFetch(API.admin.resolveAlert(alertId), { method: 'POST' })
  if (!res.ok) throw new Error('Failed to resolve alert')
  return res.json()
}

export async function fetchJobs(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.jobs}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json()
}

export async function fetchSessions(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.sessions}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export async function revokeSession(sessionId: string) {
  const res = await adminFetch(API.admin.session(sessionId), { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to revoke session')
  return res.json()
}

export async function fetchTenants(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.tenants}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch tenants')
  return res.json()
}

export async function fetchErrorBreakdown(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.errorBreakdown}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch error breakdown')
  return res.json()
}

// ── Top-up credits ────────────────────────────────────────────────────────────

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

export async function fetchCreditLedger(tenantId: string): Promise<CreditLedgerEntry[]> {
  const res = await adminFetch(API.admin.tenantCreditsLedger(tenantId))
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

// ── Slip review queue ───────────────────────────────────────────────────────

export type AdminOrderStatus = 'in_progress' | 'paid' | 'complete' | 'void'

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

/**
 * Workflow stage = what the admin must DO, derived from (status + slip).
 * Backend keeps in_progress for both pre- and post-slip, so the slip flag splits it.
 */
export type OrderStage = 'awaiting_payment' | 'to_review' | 'to_post' | 'posted' | 'rejected'

export function orderStage(o: AdminCreditOrder): OrderStage {
  switch (o.status) {
    case 'in_progress':
      return o.slip_uploaded_at ? 'to_review' : 'awaiting_payment'
    case 'paid':
      return 'to_post'
    case 'complete':
      return 'posted'
    case 'void':
      return 'rejected'
  }
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
  // Funnel amounts (THB): total = awaiting + to_review + to_post + posted (excl. void).
  total_amount: number
  awaiting_amount: number
  to_review_amount: number
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

/** Reuse the public billing-document shape — the admin endpoint returns the same. */
export type { BillingDocument, PaymentInfo } from './credits'

export async function fetchAdminPaymentInfo(): Promise<import('./credits').PaymentInfo> {
  const res = await adminFetch(API.admin.paymentInfo)
  if (!res.ok) throw new Error('Failed to load payment info')
  return res.json()
}

async function unwrapDetail(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { detail?: string }
  return err.detail || fallback
}

/**
 * Order queue across companies (scoped admins see only their own).
 * `status='all'` returns every status; `tenantId` narrows to one company's history.
 */
export async function listCreditOrders(
  status: AdminOrderStatus | 'all' = 'in_progress',
  tenantId?: string,
  hasSlip?: boolean
): Promise<AdminCreditOrder[]> {
  const res = await adminFetch(
    `${API.admin.creditOrders}${buildQs({ status, tenant_id: tenantId, has_slip: hasSlip })}`
  )
  if (!res.ok) throw new Error('Failed to load credit orders')
  return res.json()
}

/** Short-lived (300s) signed URL for the uploaded payment slip. */
export async function getOrderSlipUrl(id: string): Promise<{ signed_url: string }> {
  const res = await adminFetch(API.admin.creditOrderSlipUrl(id))
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to load slip'))
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
): Promise<import('./credits').BillingDocument[]> {
  const res = await adminFetch(API.admin.creditOrderDocuments(id))
  if (!res.ok) throw new Error('Failed to load order documents')
  return res.json()
}

// ── AR Customer Profiles ──────────────────────────────────────────────────

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

// ── Carmen AR Posting ─────────────────────────────────────────────────────

export async function postArBatch(orderIds: string[]): Promise<PostArResponse> {
  const res = await adminFetch(API.admin.creditOrdersPostAr, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_ids: orderIds }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'AR posting failed'))
  return res.json()
}

export async function fetchKpi(): Promise<KpiSummary> {
  const res = await adminFetch(API.admin.creditOrdersKpi)
  if (!res.ok) throw new Error('Failed to load KPI')
  return res.json()
}
