/** Decode a JWT's `exp` claim (ms epoch) without verifying the signature.
 * Signature verification is the backend's job; the frontend only needs `exp`
 * to warn the user before their session lapses. Returns null if unparseable. */
export function getJwtExpMs(token: string | null): number | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const exp = (JSON.parse(json) as { exp?: number }).exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}
