import { API } from '@/shared/api/endpoints'
import { resolveUrl } from '@/shared/api/client'

/** A PMS webhook key as the admin and BU key endpoints return it (never the plaintext). */
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

interface Setup {
  buCode: string | null
  host: string | null
  endpoint: string
  key: string
}

/** Everything the Carmen team needs to wire one BU, as one paste. English: it is read by
 *  Carmen's developers, whatever language the admin page is in. Contract: PMS_INTEGRATION.md. */
export function carmenSetupText({ buCode, host, endpoint, key }: Setup): string {
  const bu = buCode ? `${buCode}${host ? ` (${host})` : ''}` : 'business unit'
  return [
    `PMS → Carmen AI webhook — ${bu}`,
    `Endpoint: POST ${endpoint}`,
    `Header:   Authorization: Bearer ${key}`,
    'Body:     {"InterfaceType": "PMS", "InterfaceName": "Comanche", "DocType": "Daily", "DocDate": "2026-10-07"}',
    'A new day answers 202; the same day again answers 200.',
  ].join('\n')
}

/** Used within the last day: Carmen is probably still sending with it. */
export const usedRecently = (iso: string | null, now = Date.now()) =>
  !!iso && now - new Date(iso).getTime() < 24 * 60 * 60 * 1000
