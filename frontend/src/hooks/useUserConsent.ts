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
  showConsent: boolean
  giveConsent: () => void
} {
  // null = not known yet (server check in flight). Ask first, show second: rendering
  // the modal before the check resolved made it flash on every load for tenants that
  // had already consented.
  const [consented, setConsented] = useState<boolean | null>(() => (readCached(user) ? true : null))

  useEffect(() => {
    // Fast path: locally cached, or unauthenticated → no network.
    if (readCached(user) || !user) {
      setConsented(true)
      return
    }
    // No local cache (new device / cleared storage): the org may already have a
    // server-side consent record — ask before prompting, and stay silent meanwhile.
    setConsented(null)
    let cancelled = false
    getConsentStatus(CONSENT_VERSION)
      .then(ok => {
        if (cancelled) return
        if (ok) cacheConsent(user)
        setConsented(ok)
      })
      .catch(() => {
        // Can't prove consent — prompt rather than silently skip the gate.
        if (!cancelled) setConsented(false)
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
      .finally(() => setConsented(true))
  }, [user])

  return { showConsent: consented === false, giveConsent }
}
