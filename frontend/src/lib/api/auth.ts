import type { ExchangeResponse } from '../../types/api'
import { resolveUrl } from './client'
import { API } from './endpoints'

export interface ActiveSubscription {
  plan_code: string
  doc_allowance: number
  docs_used: number
  docs_remaining: number
  period_start: string | null
  period_end: string | null
  billing_period?: string // 'monthly' | 'annual'
  status: string
}

export interface UsageData {
  bu: string
  usage: {
    /** Non-expiring credits. Includes the 30 a new tenant is granted at signup —
     *  the free trial lives here, not in a separate pool. */
    credit_balance: number
    subscription?: ActiveSubscription | null
  }
}

export async function exchangeSSOToken(
  token: string,
  bu: string,
  user = '',
  uri = ''
): Promise<ExchangeResponse> {
  const res = await fetch(resolveUrl(API.auth.exchange), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, bu, user, uri }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail || `SSO exchange failed (${res.status})`)
  }

  return res.json() as Promise<ExchangeResponse>
}

export async function revokeSession(accessToken: string): Promise<void> {
  await fetch(resolveUrl(API.auth.session), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch((err: unknown) => {
    console.error('Session revoke failed:', err)
  })
}

export async function getUsage(accessToken: string): Promise<UsageData> {
  const res = await fetch(resolveUrl(API.auth.usage), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail || `Failed to fetch usage (${res.status})`)
  }

  return res.json() as Promise<UsageData>
}
