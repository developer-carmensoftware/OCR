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
 * NOTE: per-user keys (consent) and global UI prefs (theme) are intentionally
 * NOT managed here — they are not tenant-scoped business data.
 */

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
