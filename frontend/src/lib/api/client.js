/**
 * Authenticated fetch wrapper.
 *
 * Reads the OCR JWT from sessionStorage and attaches it as
 * `Authorization: Bearer <token>` on every request.
 *
 * On 401 responses, fires a global `ocr:unauthorized` event so
 * AuthContext can clear the session and show an error.
 */

const TOKEN_KEY = 'ocr_access_token'

export function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function storeToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

/**
 * Drop-in replacement for `fetch` that adds the auth header automatically.
 * Accepts the same arguments as the native fetch API.
 */
export async function apiFetch(url, options = {}) {
  const token = getStoredToken()

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, { ...options, headers })

  if (response.status === 401) {
    if (token) clearToken()
    window.dispatchEvent(new CustomEvent('ocr:unauthorized'))
  }

  return response
}
