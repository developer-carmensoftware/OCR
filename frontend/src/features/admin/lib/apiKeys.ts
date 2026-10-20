import { API } from '@/shared/api/endpoints'
import { resolveUrl } from '@/shared/api/client'

/** A PMS webhook key as the admin endpoint returns it (never the plaintext). Carmen's PMS
 *  setting screen generates them, one live key per BU and PMS (decision-log #44). */
export interface ApiKeyRow {
  id: string
  tenant_id: string | null
  tenant_name: string | null
  /** Null for a key whose tenant is gone or never existed (the 2026-08 POC keys). */
  bu_code: string | null
  tenant_host: string | null
  name: string
  /** The PMS the key is for (the hook's InterfaceName, lower-case). Null on pre-#44 keys. */
  interface_name: string | null
  key_prefix: string
  scopes: string[]
  created_at: string | null
  last_used_at: string | null
  last_used_ip: string | null
  revoked_at: string | null
  revoke_reason: string | null
}

/** Is Carmen's feed live: how many keys can call, and when one last did. */
export interface FeedStatus {
  active: number
  lastCall: string | null
}

/** The URL Carmen posts PMS events to, absolute. In dev the API base is unset and calls go
 *  through Vite's proxy, so the page's own origin is the address that works. */
export function pmsEventsUrl(origin = window.location.origin): string {
  const url = resolveUrl(API.pms.events)
  return /^https?:\/\//i.test(url) ? url : `${origin}${url}`
}

/** Used within the last day: Carmen is probably still sending with it. */
export const usedRecently = (iso: string | null, now = Date.now()) =>
  !!iso && now - new Date(iso).getTime() < 24 * 60 * 60 * 1000
