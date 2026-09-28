const TOKEN_KEY = 'ocr_access_token'

/** The raw Carmen token from SSO, kept only for `/api/v1/carmen/*` (the settings API
 *  Carmen calls). Everything else uses our own session JWT above. */
export const CARMEN_RAW_TOKEN_KEY = 'carmen_raw_token'

export function getCarmenRawToken(): string | null {
  return sessionStorage.getItem(CARMEN_RAW_TOKEN_KEY)
}

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
  // Goes with it: both came from the same login, and a Carmen token outliving the
  // session it arrived with is a credential nobody is watching.
  sessionStorage.removeItem(CARMEN_RAW_TOKEN_KEY)
}

export interface ApiClientOptions {
  tokenProvider: () => string | null
  unauthorizedEvent: string
  onUnauthorized?: () => void
  debounce401Ms?: number
  /** Default request timeout in ms. Only applied when the caller doesn't already
   *  pass their own `signal` (OCR extraction call sites manage their own, longer,
   *  per-call fetchTimeout() — this must not double-wrap those). */
  timeoutMs?: number
}

export function createApiClient(opts: ApiClientOptions) {
  let _fired = false
  return async function fetchFn(url: string, options: RequestInit = {}): Promise<Response> {
    const token = opts.tokenProvider()
    const headers = new Headers(options.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const ownTimeout = opts.timeoutMs && !options.signal ? fetchTimeout(opts.timeoutMs) : null

    let response: Response
    try {
      response = await fetch(resolveUrl(url), {
        ...options,
        headers,
        signal: options.signal ?? ownTimeout?.signal,
      })
    } catch (err) {
      if (ownTimeout && err instanceof DOMException && err.name === 'AbortError') {
        // `{ cause }` on the Error constructor needs an ES2022 lib target (this
        // project targets ES2020) — set the property directly instead; runtime
        // support for reading `.cause` doesn't depend on how it was constructed.
        const timeoutError = new Error(`Request timed out after ${opts.timeoutMs}ms`)
        ;(timeoutError as Error & { cause?: unknown }).cause = err
        throw timeoutError
      }
      throw err
    } finally {
      ownTimeout?.clear()
    }

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
    // Maintenance wall — backend flags it with X-Maintenance so we don't consume
    // the body (callers still read it). MaintenanceGate listens and takes over.
    if (response.status === 503 && response.headers.get('X-Maintenance')) {
      window.dispatchEvent(new CustomEvent('ocr:maintenance'))
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
