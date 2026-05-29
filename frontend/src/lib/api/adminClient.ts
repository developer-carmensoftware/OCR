/**
 * Admin API client — separate from the Carmen OCR client.
 * Uses a distinct sessionStorage key so admin and OCR sessions never collide.
 */

import { createApiClient } from './client'

const ADMIN_TOKEN_KEY = 'ocr_admin_token'

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY)
}

export function storeAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  sessionStorage.removeItem('ocr_admin_user')
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
  const res = await adminFetch('/api/v1/admin/auth/login', {
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
  const res = await adminFetch('/api/v1/admin/auth/me')
  if (!res.ok) throw new Error('Failed to fetch admin profile')
  return res.json()
}

export async function adminLogout(): Promise<void> {
  await adminFetch('/api/v1/admin/auth/logout', { method: 'POST' })
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
  const res = await adminFetch(`/api/v1/admin/usage-summary/totals${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch usage totals')
  return res.json()
}

export async function fetchUsageSummary(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/usage-summary${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch usage summary')
  return res.json()
}

export async function fetchTenantRanking(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/tenant-ranking${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch tenant ranking')
  return res.json()
}

export async function fetchLLMLogs(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/llm-usage${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch LLM logs')
  return res.json()
}

export async function fetchPerformanceLogs(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/performance-logs${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch performance logs')
  return res.json()
}

export async function fetchAlerts(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/alerts${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch alerts')
  return res.json()
}

export async function resolveAlert(alertId: number) {
  const res = await adminFetch(`/api/v1/admin/alerts/${alertId}/resolve`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to resolve alert')
  return res.json()
}

export async function fetchJobs(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/jobs${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json()
}

export async function fetchSessions(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/sessions${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export async function revokeSession(sessionId: string) {
  const res = await adminFetch(`/api/v1/admin/sessions/${sessionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to revoke session')
  return res.json()
}

export async function fetchTenants(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/tenants${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch tenants')
  return res.json()
}

export async function fetchErrorBreakdown(params: QueryParams = {}) {
  const res = await adminFetch(`/api/v1/admin/error-breakdown${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch error breakdown')
  return res.json()
}
