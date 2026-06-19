import { useState, useCallback, useEffect } from 'react'
import type { AuthUser } from '../contexts/AuthContext'

const CONSENT_VERSION = 'v1'

function consentKey(user: AuthUser): string {
  // Org-level consent: the modal is an authorized-rep acknowledgement on behalf
  // of the whole tenant, so key on tenant_id only. The old per-user key degraded
  // to a per-login rotating session hash (when Carmen omitted the `user` param
  // and the token lacked a |uuid suffix), re-prompting consent on every login.
  return `ocr_consent_${CONSENT_VERSION}_${user.tenant_id}`
}

function readConsent(user: AuthUser | null): boolean {
  if (!user) return true // unauthenticated — ProtectedRoute handles auth gate
  try {
    return localStorage.getItem(consentKey(user)) === '1'
  } catch {
    return false
  }
}

export function useUserConsent(user: AuthUser | null): {
  hasConsented: boolean
  giveConsent: () => void
} {
  const [hasConsented, setHasConsented] = useState(() => readConsent(user))

  // Re-sync when user transitions null→non-null (SSO exchange after first render)
  useEffect(() => {
    setHasConsented(readConsent(user))
  }, [user])

  const giveConsent = useCallback(() => {
    if (!user) return
    try {
      localStorage.setItem(consentKey(user), '1')
    } catch {
      // localStorage unavailable — still dismiss in-session
    }
    setHasConsented(true)
  }, [user])

  return { hasConsented, giveConsent }
}
