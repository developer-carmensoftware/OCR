/** Admin sign-in. The session it starts is held by `shared/api/adminAuth.ts`. */

import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'

export interface LoginResponse {
  access_token: string
  token_type: string
  admin_id: string
  username: string
  roles: string[]
  tenant_scope: string
  mfa_required: boolean
}

/**
 * Login failure that keeps its HTTP status, so the UI can tell "wrong password"
 * (retry) from "locked out" (wait) from "no access" (call someone) instead of
 * printing one English string for all three.
 */
export class AdminLoginError extends Error {
  readonly status: number
  /** Seconds until the 423 lockout lifts, when the server told us. */
  readonly retryAfterSec?: number

  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message)
    this.name = 'AdminLoginError'
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

export async function adminLogin(username: string, password: string): Promise<LoginResponse> {
  const res = await adminFetch(API.admin.login, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }))
    const detail: string = err.detail || 'Login failed'
    // The lockout duration only exists inside the message ("Try again in 842s.").
    // Parsed here rather than at the call site; if the wording ever changes we
    // simply lose the countdown, not the error.
    const secs = res.status === 423 ? Number(/(\d+)\s*s/.exec(detail)?.[1]) : NaN
    throw new AdminLoginError(detail, res.status, Number.isFinite(secs) ? secs : undefined)
  }
  return res.json()
}
