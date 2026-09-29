/**
 * Admin API client, the part the app shell needs — separate from the Carmen OCR client.
 * Uses a distinct sessionStorage key so admin and OCR sessions never collide.
 *
 * Everything else the dashboard calls lives in `features/admin/api/`, loaded with the
 * dashboard's own chunk; this file is only what `AdminAuthContext` needs to gate `#/admin*`,
 * plus `adminFetch`, which every one of those modules sends through.
 */

import { createApiClient } from '@/shared/api/client'
import { API } from '@/shared/api/endpoints'

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
  // Matches the backend's 30s statement_timeout — client and server give up
  // together instead of the UI spinning past a backend that already failed.
  timeoutMs: 30_000,
})

export interface AdminUser {
  admin_id: string
  username: string
  roles: string[]
  permissions: string[]
  tenant_scope: string
  is_global: boolean
  mfa_passed: boolean
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
