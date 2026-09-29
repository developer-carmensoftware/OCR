/** Maintenance mode: schedule, end, and per-tenant switch. */

import { unwrapDetail } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'

export interface MaintenanceStatus {
  /** Manual/instant switch state. */
  enabled: boolean
  /** Effective state = manual OR inside the scheduled window (server-computed). */
  active: boolean
  message: string
  /** ISO8601 UTC, or null when no window is scheduled. */
  window_start: string | null
  window_end: string | null
  tenants: string[]
}

export async function fetchMaintenance(): Promise<MaintenanceStatus> {
  const res = await adminFetch(API.admin.maintenance)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch maintenance status'))
  return res.json()
}

/** start/end are ISO8601 UTC (Date.toISOString()). */
export async function setMaintenanceSchedule(
  windowStart: string,
  windowEnd: string,
  message?: string
): Promise<void> {
  const res = await adminFetch(API.admin.maintenanceSchedule, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ window_start: windowStart, window_end: windowEnd, message }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to save schedule'))
}

/** Reopen now — clears the manual switch and any scheduled window. */
export async function endMaintenanceNow(): Promise<void> {
  const res = await adminFetch(API.admin.maintenanceEnd, { method: 'POST' })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to end maintenance'))
}

export async function setTenantMaintenance(tenantId: string, enabled: boolean): Promise<void> {
  const res = await adminFetch(API.admin.tenantMaintenance(tenantId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to update tenant maintenance'))
}
