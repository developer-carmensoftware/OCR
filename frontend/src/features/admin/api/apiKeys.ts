/** Keys we issue to external systems — today only Carmen's PMS webhook (CA-93). */

import { buildQs, unwrapDetail, type QueryParams } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'
import type { Page } from '@/shared/api/page'
import type { ApiKeyRow, IssuedApiKey } from '@/shared/lib/apiKeys'

export type { ApiKeyRow, IssuedApiKey }

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
