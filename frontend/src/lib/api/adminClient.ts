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

export const adminFetch = createApiClient({
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
