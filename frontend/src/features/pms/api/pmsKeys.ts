/**
 * A BU's own PMS keys (#/pms), on its session JWT. The session's tenant is the only BU the
 * backend lets these calls see or touch.
 */

import { apiFetch } from '@/shared/api/client'
import { API } from '@/shared/api/endpoints'
import type { Page } from '@/shared/api/page'
import type { ApiKeyRow, IssuedApiKey } from '@/shared/lib/apiKeys'

async function failure(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as { detail?: unknown }
  return new Error(typeof body.detail === 'string' ? body.detail : fallback)
}

export async function fetchPmsKeys(): Promise<Page<ApiKeyRow>> {
  const res = await apiFetch(API.pms.keys)
  if (!res.ok) throw await failure(res, "Couldn't load your keys")
  return res.json()
}

export async function createPmsKey(name: string): Promise<IssuedApiKey> {
  const res = await apiFetch(API.pms.keys, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw await failure(res, "Couldn't create the key")
  return res.json()
}

export async function revokePmsKey(id: string, reason?: string) {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : ''
  const res = await apiFetch(`${API.pms.key(id)}${qs}`, { method: 'DELETE' })
  if (!res.ok) throw await failure(res, "Couldn't revoke the key")
  return res.json()
}
