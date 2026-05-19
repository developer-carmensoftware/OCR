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

// eslint-disable-next-line no-undef
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
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
