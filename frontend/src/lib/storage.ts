/**
 * Centralized management for app-owned localStorage.
 *
 * Two problems this solves for the multi-tenant pilot:
 *  1. Data residue — on a shared device, tenant A's GL config must not be
 *     readable by tenant B. `clearAppStorage()` wipes every app key on logout
 *     and on tenant switch.
 *  2. Cross-tenant collision — keys are namespaced per tenant via `appKey()`,
 *     so two tabs on different tenants never overwrite each other's config.
 *
 * NOTE: per-user keys (consent), global UI prefs (theme, lang) and
 * `releaseNotesSeen` are intentionally NOT managed here — they are not
 * tenant-scoped business data, and `releaseNotesSeen` in particular must survive
 * logout and tenant switch (same human, same changelog). Do not "fix" it by
 * adding it to APP_STORAGE_BASES.
 */

import type { FieldMapping } from '../types/api'

// Base names of every app-owned, tenant-scoped localStorage key.
const APP_STORAGE_BASES = [
  'accountingConfig',
  'accountMappingAmount',
  'ocr_wizard_state',
  'ap_invoice_mapping',
  'accounting_config_updated',
] as const

let activeTenantId: string | null = null

/** Set the tenant whose namespace `appKey()` resolves to. Call on login/restore. */
export function setActiveTenant(tenantId: string | null): void {
  activeTenantId = tenantId || null
}

/** Namespaced localStorage key for the active tenant (falls back to 'anon'). */
export function appKey(base: string): string {
  return `t:${activeTenantId || 'anon'}:${base}`
}

// Per-tenant Carmen host URI. Intentionally OUTSIDE clearAppStorage: it is not
// sensitive business data and must survive logout / session expiry so the
// "Go to Carmen" link keeps working. Keyed by tenant so different tenants on a
// shared device never overwrite each other's host.
const CARMEN_URI_PREFIX = 'ocr_carmen_uri:'

/** Persist the Carmen host URI for a tenant. */
export function setCarmenUri(tenantId: string, uri: string): void {
  try {
    localStorage.setItem(`${CARMEN_URI_PREFIX}${tenantId}`, uri)
  } catch {
    /* storage unavailable */
  }
}

/** Recall the Carmen host URI for a tenant, or null if none stored. */
export function getCarmenUri(tenantId: string): string | null {
  try {
    return localStorage.getItem(`${CARMEN_URI_PREFIX}${tenantId}`)
  } catch {
    return null
  }
}

/** Remove every app-owned key (all tenants). Use on logout / tenant switch. */
export function clearAppStorage(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const isAppKey = APP_STORAGE_BASES.some(
        base => k === base || (k.startsWith('t:') && k.endsWith(`:${base}`))
      )
      if (isAppKey) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

// ── accountingConfig ─────────────────────────────────────────────────────────
//
// The credit-card wizard's GL setup. Six call sites across four hooks each wrote
// their own `JSON.parse(localStorage.getItem(appKey('accountingConfig')) || '{}')`
// with its own inline cast and its own try/catch, so adding a field meant finding
// all six and a malformed blob was handled six slightly different ways.
//
// The shape lives here with the key it is stored under. Callers still read only the
// subset they care about — that part was never duplication.

export interface AccountingConfig {
  bank?: string
  filePrefix?: string
  fileSource?: string
  description?: string
  /** bank_code -> description; see descriptionForBank in lib/bankTransforms. */
  bankDescriptions?: Record<string, string>
  company?: {
    name?: string
    taxId?: string
    branch?: string
    address?: string
  }
  mappings?: Record<string, FieldMapping>
  paymentAmount?: Record<string, FieldMapping>
}

/** The saved config, or `{}` when absent, unparseable, or storage is unavailable. */
export function readAccountingConfig(): AccountingConfig {
  try {
    return (JSON.parse(localStorage.getItem(appKey('accountingConfig')) || '{}') ??
      {}) as AccountingConfig
  } catch {
    return {}
  }
}

/**
 * Merge `patch` into the saved config. Shallow on purpose: `company` is the only
 * nested field and every caller that touches it already spreads the old value in.
 */
export function writeAccountingConfig(patch: Partial<AccountingConfig>): void {
  try {
    localStorage.setItem(
      appKey('accountingConfig'),
      JSON.stringify({ ...readAccountingConfig(), ...patch })
    )
  } catch {
    /* storage unavailable — the config is a cache, the API is the source */
  }
}
