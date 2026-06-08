import { useState, useCallback, useEffect } from 'react'
import type { AuthUser } from '../contexts/AuthContext'

const CONSENT_VERSION = 'v1'

function consentKey(user: AuthUser): string {
  // Key on the stable human identity. `carmen_user_id` is parsed out of the Carmen
  // SSO token (<hash>|<uuid>) and is only stable when that token carries the uuid
  // suffix — when it doesn't, the parser falls back to the whole rotating session
  // hash, producing a new id every login and re-prompting consent each time.
  // `username` (Carmen's `user` param) is the reliable per-user identifier.
  const userId = user.username || user.carmen_user_id
  return `ocr_consent_${CONSENT_VERSION}_${user.tenant_id}_${userId}`
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
