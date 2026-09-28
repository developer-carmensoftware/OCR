/** Per-tenant allowance and module on/off. */

import { buildQs, unwrapDetail, type QueryParams } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'

export interface ModuleUsageRow {
  module_id: string
  display_name: string
  /** extract + suggest. Kept for back-compat; prefer scans for a quota-comparable number. */
  calls: number
  /** Vision extracts — one per document attempted. This is what lines up against quota. */
  scans: number
  /** GL-mapping suggestions that ride along; never touch quota. */
  suggestions: number
  tokens: number
  cost_usd: number
}

export interface ModuleCatalogEntry {
  id: string
  display_name: string
}

export interface TenantSubscriptionSummary {
  /** Documents per cycle. */
  allowance: number
  /** Cycle-adjusted docs_used — what the next scan would count. */
  used: number
  period_end: string | null
}

export interface TenantQuotaOverviewRow {
  id: string
  host: string
  bu_code: string
  name: string | null
  plan: string | null
  is_active: boolean
  modules_enabled: ModuleCatalogEntry[]
  /** Module ids with an explicit enabled=false row. Enforcement is opt-out: everything
   *  not in this list is available, whether or not a row exists. */
  modules_disabled: string[]
  usage_by_module: ModuleUsageRow[]
  /** The active paid plan, charged first. null when none is in-window. */
  subscription: TenantSubscriptionSummary | null
  /** Non-expiring credits, charged once the allowance is spent. */
  credit_balance: number
}

export interface QuotaOverviewResponse {
  from: string
  to: string
  data: TenantQuotaOverviewRow[]
  modules: ModuleCatalogEntry[]
}

export async function fetchQuotaOverview(params: QueryParams = {}): Promise<QuotaOverviewResponse> {
  const res = await adminFetch(`${API.admin.quotaOverview}${buildQs(params)}`)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch quota overview'))
  return res.json()
}

export async function toggleTenantModule(
  tenantId: string,
  moduleId: string,
  enabled: boolean
): Promise<{ tenant_id: string; module_id: string; enabled: boolean }> {
  const res = await adminFetch(API.admin.tenantModule(tenantId, moduleId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to toggle module'))
  return res.json()
}
