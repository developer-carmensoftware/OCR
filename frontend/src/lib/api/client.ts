const TOKEN_KEY = 'ocr_access_token'

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

const _isDev = import.meta.env.DEV

// eslint-disable-next-line no-undef
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (_isDev) {
    const method = options.method ?? 'GET'
    console.groupCollapsed(`[API] ${method} ${url}`)
    if (options.body) {
      try {
        console.log('req body:', JSON.parse(options.body as string))
      } catch {
        console.log('req body:', options.body)
      }
    }
  }

  const t0 = performance.now()
  const response = await fetch(url, { ...options, headers })
  const ms = (performance.now() - t0).toFixed(0)

  if (_isDev) {
    const style = response.ok ? 'color:green' : 'color:red'
    console.log(`%c${response.status} (${ms}ms)`, style)
    console.groupEnd()
  }

  if (response.status === 401) {
    if (token) clearToken()
    window.dispatchEvent(new CustomEvent('ocr:unauthorized'))
  }

  return response
}
