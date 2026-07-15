import { useState, useCallback, useEffect } from 'react'
import type { AuthUser } from '../contexts/AuthContext'
import { postConsent, getConsentStatus } from '../lib/api/consent'

// v2: consent is now recorded server-side (consent_logs, PDPA ม.19). Bumping from
// v1 re-prompts users whose only proof was localStorage, so every tenant gets a
// real server record. localStorage is kept purely as a fast-path cache.
const CONSENT_VERSION = 'v2'

function consentKey(user: AuthUser): string {
  // Org-level consent: the modal is an authorized-rep acknowledgement on behalf
  // of the whole tenant, so key on tenant_id only (matches the server record's
  // tenant scope).
  return `ocr_consent_${CONSENT_VERSION}_${user.tenant_id}`
}

function readCached(user: AuthUser | null): boolean {
  if (!user) return true // unauthenticated — ProtectedRoute handles the auth gate
  try {
    return localStorage.getItem(consentKey(user)) === '1'
  } catch {
    return false
  }
}

function cacheConsent(user: AuthUser): void {
  try {
    localStorage.setItem(consentKey(user), '1')
  } catch {
    // localStorage unavailable (private mode) — server record is still authoritative.
  }
}

export function useUserConsent(user: AuthUser | null): {
  hasConsented: boolean
  giveConsent: () => void
} {
  const [hasConsented, setHasConsented] = useState(() => readCached(user))

  useEffect(() => {
    // Fast path: locally cached, or unauthenticated → no network.
    if (readCached(user) || !user) {
      setHasConsented(true)
      return
    }
    // No local cache (new device / cleared storage): the org may already have a
    // server-side consent record — ask before re-prompting. Show the modal in the
    // meantime (safe direction: never skip the gate for a genuinely non-consented user).
    setHasConsented(false)
    let cancelled = false
    getConsentStatus(CONSENT_VERSION)
      .then(consented => {
        if (cancelled || !consented) return
        cacheConsent(user)
        setHasConsented(true)
      })
      .catch(() => {
        // Network failure — leave the modal up; the user can still consent manually.
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const giveConsent = useCallback(() => {
    if (!user) return
    // Persist to the server, THEN cache + dismiss. If the POST fails we still dismiss
    // for this session (don't block the user) but skip the cache so the next session
    // re-checks and re-prompts — self-healing rather than a silent lost record.
    postConsent(CONSENT_VERSION)
      .then(() => cacheConsent(user))
      .catch(() => {
        // swallow — record retried next session
      })
      .finally(() => setHasConsented(true))
  }, [user])

  return { hasConsented, giveConsent }
}
