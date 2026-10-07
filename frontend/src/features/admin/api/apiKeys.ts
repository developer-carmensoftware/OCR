/** Keys we issue to external systems — today only Carmen's PMS webhook (CA-93). */

import { buildQs, unwrapDetail, type QueryParams } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'
import type { Page } from '@/shared/api/page'

export interface ApiKeyRow {
  id: string
  tenant_id: string | null
  tenant_name: string | null
  /** Null for a key whose tenant is gone or never existed (the 2026-08 POC keys). */
  bu_code: string | null
  tenant_host: string | null
  name: string
  key_prefix: string
  scopes: string[]
  created_at: string | null
  last_used_at: string | null
  last_used_ip: string | null
  revoked_at: string | null
  revoke_reason: string | null
}

/** The create response — the only time `key` (the plaintext) exists outside Carmen. */
export interface IssuedApiKey extends ApiKeyRow {
  key: string
}

export async function fetchApiKeys(params: QueryParams = {}): Promise<Page<ApiKeyRow>> {
  const res = await adminFetch(`${API.admin.apiKeys}${buildQs(params)}`)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch API keys'))
  return res.json()
}

export async function createApiKey(payload: {
  tenant_id: string
  name: string
}): Promise<IssuedApiKey> {
  const res = await adminFetch(API.admin.apiKeys, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to create API key'))
  return res.json()
}

export async function revokeApiKey(id: string, reason?: string) {
  const res = await adminFetch(`${API.admin.apiKey(id)}${buildQs({ reason })}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to revoke API key'))
  return res.json()
}
