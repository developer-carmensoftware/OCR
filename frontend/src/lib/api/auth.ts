import type { ExchangeResponse } from '../../types/api'

export interface UsageData {
  bu: string
  usage: {
    monthly_calls: number
    max_monthly_calls: number
    remaining_calls: number
  }
}

export async function exchangeSSOToken(
  token: string,
  bu: string,
  user = '',
  uri = ''
): Promise<ExchangeResponse> {
  const res = await fetch('/api/v1/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, bu, user, uri }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail || `SSO exchange failed (${res.status})`)
  }

  return res.json() as Promise<ExchangeResponse>
}

export async function revokeSession(accessToken: string): Promise<void> {
  await fetch('/api/v1/auth/session', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {})
}

export async function getUsage(accessToken: string): Promise<UsageData> {
  const res = await fetch('/api/v1/auth/usage', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(err.detail || `Failed to fetch usage (${res.status})`)
  }

  return res.json() as Promise<UsageData>
}
