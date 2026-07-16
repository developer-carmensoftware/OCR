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
  // Matches the backend's 30s statement_timeout — client and server give up
  // together instead of the UI spinning past a backend that already failed.
  timeoutMs: 30_000,
})

// ── Typed helpers ─────────────────────────────────────────────────────────────

export interface AdminUser {
  admin_id: string
  username: string
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
  username: string
  roles: string[]
  tenant_scope: string
  mfa_required: boolean
}

export async function adminLogin(username: string, password: string): Promise<LoginResponse> {
  const res = await adminFetch(API.admin.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
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
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch usage summary'))
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

export interface TenantRow {
  id: string
  host: string
  bu_code: string
  name: string | null
  plan: string | null
  is_active: boolean
  contact_email: string | null
  modules_count: number
  /** max(llm_usage_logs.created_at) — blind to attempts that never reached the model. Prefer last_use. */
  last_used_at: string | null
  created_at: string | null

  // Engagement — present only when fetched with include_engagement: true, so every
  // field is optional and TenantSelector's plain call still type-checks.
  tried?: number
  ok?: number
  failed?: number
  /** Submitted to Carmen. The activation metric: extract-without-submit means they tried it and didn't trust it. */
  posted_to_carmen?: number
  users?: number
  active_days?: number
  active_weeks?: number
  first_use?: string | null
  last_use?: string | null
  days_idle?: number | null
  credit_card?: number
  ap_invoice?: number
}

export interface ExtractionFailureRow {
  id: string
  created_at: string | null
  tenant_id: string
  tenant_name: string | null
  module_id: string
  original_filename: string | null
  error_message: string | null
  carmen_user_id: string | null
  /** null (not 0) when the model was never called — distinct from a call that returned nothing. */
  llm_calls: number | null
  total_tokens: number | null
  duration_ms: number | null
  model: string | null
}

export interface TenantQuota {
  period: string
  metric: string
  used: number
  limit: number
  pct: number
  is_hard: boolean
  period_key: string
}

export interface TenantModuleRow {
  id: string
  display_name: string
  enabled_at: string | null
}

export interface TenantSessionRow {
  id: string
  username: string | null
  carmen_user_id: string | null
  is_active: boolean
  last_used_at: string | null
  created_at: string | null
}

export interface TenantDetail {
  id: string
  host: string
  bu_code: string
  name: string | null
  plan: string | null
  is_active: boolean
  contact_email: string | null
  notes: string | null
  created_at: string | null
  modules: TenantModuleRow[]
  quotas: TenantQuota[]
  recent_sessions: TenantSessionRow[]
}

export async function fetchTenants(
  params: QueryParams = {}
): Promise<{ total: number; data: TenantRow[] }> {
  const res = await adminFetch(`${API.admin.tenants}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch tenants')
  return res.json()
}

export async function fetchExtractionFailures(
  params: QueryParams = {}
): Promise<{ total: number; data: ExtractionFailureRow[] }> {
  const res = await adminFetch(`${API.admin.extractionFailures}${buildQs(params)}`)
  // unwrapDetail, not a fixed string: this endpoint rejects a >92-day range with a
  // specific reason the user needs to read.
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch extraction failures'))
  return res.json()
}

export async function fetchTenantDetail(tenantId: string): Promise<TenantDetail> {
  const res = await adminFetch(API.admin.tenant(tenantId))
  if (!res.ok) throw new Error('Failed to fetch tenant detail')
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

/**
 * Workflow stage = what the admin must DO, derived from (status + slip).
 * Backend keeps in_progress for both pre- and post-slip, so the slip flag splits it.
 */
export type OrderStage =
  'awaiting_payment' | 'to_review' | 'on_hold' | 'to_post' | 'posted' | 'rejected'

export function orderStage(o: AdminCreditOrder): OrderStage {
  switch (o.status) {
    case 'in_progress':
      return o.slip_uploaded_at ? 'to_review' : 'awaiting_payment'
    case 'on_hold':
      return 'on_hold'
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

// ── Quota & Module overview ───────────────────────────────────────────────

export interface QuotaRow {
  id: string
  period: string
  metric: string
  used: number
  limit: number
  pct: number
  is_hard: boolean
  period_key: string
}

export interface ModuleUsageRow {
  module_id: string
  display_name: string
  /** extract + suggest. Kept for back-compat; prefer scans for a quota-comparable number. */
  calls: number
  /** Vision extracts — one per document attempted. This is what lines up against quota. */
  scans: number
  /** GL-mapping suggestions that ride along; never touch quota. */
  suggestions: number
  tokens: number
  cost_usd: number
}

export interface ModuleCatalogEntry {
  id: string
  display_name: string
}

export interface TenantSubscriptionSummary {
  /** Documents per cycle. */
  allowance: number
  /** Cycle-adjusted docs_used — what the next scan would count. */
  used: number
  period_end: string | null
}

export interface TenantQuotaOverviewRow {
  id: string
  host: string
  bu_code: string
  name: string | null
  plan: string | null
  is_active: boolean
  quotas: QuotaRow[]
  modules_enabled: ModuleCatalogEntry[]
  usage_by_module: ModuleUsageRow[]
  /** The active paid plan, charged before free quota. null when none is in-window. */
  subscription: TenantSubscriptionSummary | null
  /** Non-expiring top-up credits, charged after subscription and free are spent. */
  credit_balance: number
}

export interface QuotaOverviewResponse {
  from: string
  to: string
  data: TenantQuotaOverviewRow[]
  modules: ModuleCatalogEntry[]
}

export async function fetchQuotaOverview(params: QueryParams = {}): Promise<QuotaOverviewResponse> {
  const res = await adminFetch(`${API.admin.quotaOverview}${buildQs(params)}`)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch quota overview'))
  return res.json()
}

export async function updateQuotaLimit(
  tenantId: string,
  quotaId: string,
  limitValue: number
): Promise<{ id: string; limit_value: number }> {
  const res = await adminFetch(API.admin.tenantQuota(tenantId, quotaId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit_value: limitValue }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to update quota limit'))
  return res.json()
}

export async function resetQuotaUsage(
  tenantId: string,
  quotaId: string
): Promise<{ id: string; period_key: string; used: number }> {
  const res = await adminFetch(API.admin.tenantQuotaReset(tenantId, quotaId), { method: 'POST' })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to reset quota usage'))
  return res.json()
}

export async function toggleTenantModule(
  tenantId: string,
  moduleId: string,
  enabled: boolean
): Promise<{ tenant_id: string; module_id: string; enabled: boolean }> {
  const res = await adminFetch(API.admin.tenantModule(tenantId, moduleId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to toggle module'))
  return res.json()
}

// ── Admin user management (IAM) ───────────────────────────────────────────

export interface AdminUserRow {
  id: string
  username: string
  full_name: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string | null
  roles: string[]
}

export interface RoleOption {
  id: string
  name: string
  description: string | null
  is_system: boolean
}

export async function fetchAdminUsers(): Promise<{ data: AdminUserRow[] }> {
  const res = await adminFetch(API.admin.adminUsers)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch admin users'))
  return res.json()
}

export async function createAdminUser(payload: {
  username: string
  password: string
  full_name?: string | null
  role_ids: string[]
}): Promise<AdminUserRow> {
  const res = await adminFetch(API.admin.adminUsers, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to create admin user'))
  return res.json()
}

export async function updateAdminUser(
  userId: string,
  payload: { full_name?: string | null; is_active?: boolean }
): Promise<AdminUserRow> {
  const res = await adminFetch(API.admin.adminUser(userId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to update admin user'))
  return res.json()
}

export async function resetAdminUserPassword(userId: string, newPassword: string): Promise<void> {
  const res = await adminFetch(API.admin.adminUserPasswordReset(userId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: newPassword }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to reset password'))
}

export async function replaceAdminUserRoles(
  userId: string,
  roleIds: string[]
): Promise<{ id: string; role_ids: string[] }> {
  const res = await adminFetch(API.admin.adminUserRoles(userId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_ids: roleIds }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to update roles'))
  return res.json()
}

export async function fetchRoles(): Promise<{ data: RoleOption[] }> {
  const res = await adminFetch(API.admin.roles)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch roles'))
  return res.json()
}
