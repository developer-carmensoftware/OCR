/** Usage analytics: totals, per-tenant/per-user usage, LLM/performance logs, errors, extraction failures. */

import { buildQs, unwrapDetail, type QueryParams } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'

export async function fetchUsageTotals(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.usageTotals}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch usage totals')
  return res.json()
}

export async function fetchUsageSummary(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.usageSummary}${buildQs(params)}`)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch usage summary'))
  return res.json()
}

export async function fetchTenantRanking(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.tenantRanking}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch tenant ranking')
  return res.json()
}

export async function fetchUserUsage(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.userUsage}${buildQs(params)}`)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch user usage'))
  return res.json()
}

export async function fetchLLMLogs(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.llmUsage}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch LLM logs')
  return res.json()
}

export async function fetchPerformanceLogs(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.performanceLogs}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch performance logs')
  return res.json()
}

export interface ExtractionFailureRow {
  id: string
  created_at: string | null
  tenant_id: string
  tenant_name: string | null
  module_id: string
  original_filename: string | null
  error_message: string | null
  carmen_user_id: string | null
  /** null (not 0) when the model was never called — distinct from a call that returned nothing. */
  llm_calls: number | null
  total_tokens: number | null
  duration_ms: number | null
  model: string | null
}

export async function fetchExtractionFailures(
  params: QueryParams = {}
): Promise<{ total: number; data: ExtractionFailureRow[] }> {
  const res = await adminFetch(`${API.admin.extractionFailures}${buildQs(params)}`)
  // unwrapDetail, not a fixed string: this endpoint rejects a >92-day range with a
  // specific reason the user needs to read.
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch extraction failures'))
  return res.json()
}

export async function fetchErrorBreakdown(params: QueryParams = {}) {
  const res = await adminFetch(`${API.admin.errorBreakdown}${buildQs(params)}`)
  if (!res.ok) throw new Error('Failed to fetch error breakdown')
  return res.json()
}
