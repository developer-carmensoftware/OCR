/** Tenants: the list, and one tenant's detail. */

import { buildQs, type QueryParams } from '@/features/admin/api/common'
import type { TenantSubscriptionSummary } from '@/features/admin/api/quotas'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'

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
  modules_disabled: string[]
  /** The active paid plan, charged first. null when none is in-window. */
  subscription: TenantSubscriptionSummary | null
  /** Non-expiring credits, charged once the allowance is spent. */
  credit_balance: number
  recent_sessions: TenantSessionRow[]
}

export async function fetchTenants(
  params: QueryParams = {}
): Promise<{ total: number; data: TenantRow[] }> {
  const res = await adminFetch(`${API.admin.tenants}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch tenants')
  return res.json()
}

export async function fetchTenantDetail(tenantId: string): Promise<TenantDetail> {
  const res = await adminFetch(API.admin.tenant(tenantId))
  if (!res.ok) throw new Error('Failed to fetch tenant detail')
  return res.json()
}
