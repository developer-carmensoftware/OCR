const TOKEN_KEY = 'ocr_access_token'

/**
 * Backend base URL.
 *
 * - Dev (Vite): leave `VITE_API_BASE_URL` unset → bare `/api/*` paths flow
 *   through Vite's dev proxy (vite.config.ts → http://localhost:8010).
 * - Prod (Vercel): set `VITE_API_BASE_URL=https://carmen-ocr-backend.onrender.com`
 *   in Vercel project env. apiFetch() prepends it to every request.
 *
 * Trailing slash is stripped so callers can pass paths with or without `/`.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export function resolveUrl(url: string): string {
  // Absolute URLs (rare — e.g. external uploads) pass through unchanged.
  if (/^https?:\/\//i.test(url)) return url
  if (!API_BASE) return url
  return url.startsWith('/') ? `${API_BASE}${url}` : `${API_BASE}/${url}`
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

let _unauthFired = false

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(resolveUrl(url), { ...options, headers })

  if (response.status === 401) {
    if (token) clearToken()
    if (!_unauthFired) {
      _unauthFired = true
      window.dispatchEvent(new CustomEvent('ocr:unauthorized'))
      setTimeout(() => {
        _unauthFired = false
      }, 2000)
    }
  }

  return response
}
