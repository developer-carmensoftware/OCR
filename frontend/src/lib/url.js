/**
 * Build a Carmen deep-link URL using the `uri` stored at login time.
 *
 * uri comes from the URL param at entry and is saved in sessionStorage
 * as part of the user object: { user_id, username, bu, uri }
 *
 * Example:
 *   uri  = "https://ostin.carmenwork.com"
 *   path = "/glJv/123/show"
 *   →    "https://ostin.carmenwork.com/#/glJv/123/show"
 */
export function getCarmenUrl(path = '') {
  let base = ''

  try {
    const stored = sessionStorage.getItem('ocr_user')
    if (stored) {
      const user = JSON.parse(stored)
      base = user.uri || ''
    }
  } catch {
    // sessionStorage unavailable or JSON parse failed
  }

  // Fallback: derive from current hostname (dev / legacy)
  if (!base) {
    base = `${window.location.protocol}//${window.location.hostname}`
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}/#${normalizedPath}`
}
