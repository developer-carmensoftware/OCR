import { getCarmenUri } from './storage'

export function getCarmenUrl(path = ''): string {
  let base = ''

  try {
    // Set on login and kept through session expiry (only removed on an explicit
    // logout), so this alone covers both an active session and an expired one — see
    // AuthContext.tsx's login()/logout(). There used to be a second read here for an
    // "active session" key, but AuthContext stopped writing that key years ago; this
    // one always agreed with it while it was live, so nothing was lost deleting it.
    const tenantId = sessionStorage.getItem('ocr_last_tenant')
    if (tenantId) {
      base = getCarmenUri(tenantId) || ''
    }
  } catch {
    // sessionStorage unavailable
  }

  if (!base) {
    base = `${window.location.protocol}//${window.location.hostname}`
  }

  const carmenSubpath = import.meta.env.PROD ? '/carmen' : ''
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}${carmenSubpath}/#${normalizedPath}`
}

/** Carmen's settings screen — where every setting this app reads is actually edited
 *  (CARMEN_INTEGRATION.md §0: "Settings live in Carmen"). One place, so a deeper route
 *  later is one edit rather than a search. */
export const carmenSettingsUrl = () => getCarmenUrl('/setting')
