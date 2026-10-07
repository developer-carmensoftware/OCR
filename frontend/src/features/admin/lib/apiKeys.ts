import { API } from '@/shared/api/endpoints'
import { resolveUrl } from '@/shared/api/client'

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
    'Body:     {"event_id": "<unique per BU>", "type": "night_audit", "data": {…}}',
    'Retry with the same event_id; a duplicate answers 200.',
  ].join('\n')
}

/** Used within the last day: Carmen is probably still sending with it. */
export const usedRecently = (iso: string | null, now = Date.now()) =>
  !!iso && now - new Date(iso).getTime() < 24 * 60 * 60 * 1000
