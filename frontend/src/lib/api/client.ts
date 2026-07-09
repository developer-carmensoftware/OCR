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

export interface ApiClientOptions {
  tokenProvider: () => string | null
  unauthorizedEvent: string
  onUnauthorized?: () => void
  debounce401Ms?: number
}

export function createApiClient(opts: ApiClientOptions) {
  let _fired = false
  return async function fetchFn(url: string, options: RequestInit = {}): Promise<Response> {
    const token = opts.tokenProvider()
    const headers = new Headers(options.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const response = await fetch(resolveUrl(url), { ...options, headers })

    if (response.status === 401) {
      opts.onUnauthorized?.()
      if (!_fired) {
        _fired = true
        window.dispatchEvent(new CustomEvent(opts.unauthorizedEvent))
        setTimeout(() => {
          _fired = false
        }, opts.debounce401Ms ?? 2000)
      }
    }
    return response
  }
}

export const apiFetch = createApiClient({
  tokenProvider: getStoredToken,
  unauthorizedEvent: 'ocr:unauthorized',
  onUnauthorized: clearToken,
})

/**
 * Wrap a fetch call with a hard timeout. Returns an AbortController so callers
 * can cancel early; always call clearTimeout on the returned timer handle.
 * Usage:
 *   const { signal, clear } = fetchTimeout(150_000)
 *   try { await apiFetch(url, { ..., signal }) } finally { clear() }
 */
export function fetchTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(id) }
}
