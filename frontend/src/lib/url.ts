import { getCarmenUri } from './storage'

export function getCarmenUrl(path = ''): string {
  let base = ''

  try {
    // Resolve tenant_id: active session first, then last-used (survives session expiry)
    let tenantId: string | null = null
    const stored = sessionStorage.getItem('ocr_user')
    if (stored) {
      tenantId = (JSON.parse(stored) as { tenant_id?: string }).tenant_id ?? null
    }
    if (!tenantId) {
      tenantId = sessionStorage.getItem('ocr_last_tenant')
    }
    if (tenantId) {
      base = getCarmenUri(tenantId) || ''
    }
  } catch {
    // sessionStorage unavailable or JSON parse failed
  }

  if (!base) {
    base = `${window.location.protocol}//${window.location.hostname}`
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}/#${normalizedPath}`
}
