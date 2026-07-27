import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { storeToken, clearToken, getStoredToken } from '../lib/api/client'
import { revokeSession } from '../lib/api/auth'
import { setActiveTenant, clearAppStorage, setCarmenUri } from '../lib/storage'
import { clearAllDrafts } from '../lib/draft'
import { getJwtExpMs } from '../lib/jwt'
import { showToast } from '../lib/toast'

// Warn the user this long before their session token expires.
const EXPIRY_WARNING_MS = 5 * 60 * 1000
// Browsers store setTimeout delays in a signed 32-bit int; anything larger
// overflows and fires immediately. Clamp so a long-lived JWT doesn't trigger
// the expiry warning the instant the user logs in.
const MAX_TIMEOUT_MS = 2_147_483_647

const STORAGE_KEY = 'ocr_user:v1'
// Set when a session dies under the user, cleared on the next successful login.
// ProtectedRoute reads it to tell "your session ended" apart from "you arrived here
// without ever authenticating" — the two states look identical otherwise, and only
// one of them should promise that unsent work was kept.
export const EXPIRED_FLAG_KEY = 'ocr_session_expired'

export interface AuthUser {
  carmen_user_id: string
  username: string
  bu: string
  uri: string
  tenant_id: string
  [key: string]: unknown
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  login: (accessToken: string, userInfo: AuthUser) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = getStoredToken()
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (token && stored) {
      try {
        const restored = JSON.parse(stored) as AuthUser
        // Restore the storage namespace synchronously, before any child hook
        // reads tenant-scoped localStorage on mount.
        setActiveTenant(restored.tenant_id)
        // Re-seed the persistent Carmen URI from the restored session so the
        // "Go to Carmen" link survives a refresh even when login() didn't run
        // this page-load (e.g. deploy upgrade of an existing sessionStorage
        // session that predates the localStorage-backed uri).
        if (restored.uri) setCarmenUri(restored.tenant_id, restored.uri)
        return restored
      } catch {
        clearToken()
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
    return null
  })
  const [loading] = useState(false)

  useEffect(() => {
    const handle = () => {
      // Session died — wipe tenant-scoped business data so nothing lingers for
      // the next person on a shared device, and tell the user clearly instead of
      // silently dropping them on the home screen mid-task.
      //
      // Deliberately NOT clearAllDrafts(): the unsent wizard draft is the one thing
      // that has to outlive this event, which is why lib/draft.ts keys sit outside
      // APP_STORAGE_BASES. Drafts die on logout, tenant switch, submit, or TTL.
      clearAppStorage()
      setActiveTenant(null)
      sessionStorage.removeItem(STORAGE_KEY)
      // Set BEFORE setUser(null): ProtectedRoute reads this during the render that
      // setUser triggers, not from state. Batching makes the other order work today —
      // this order works regardless.
      try {
        sessionStorage.setItem(EXPIRED_FLAG_KEY, '1')
      } catch {
        /* storage unavailable — the reconnect screen just falls back to generic copy */
      }
      setUser(null)
      showToast(
        'Your session has expired — please reopen this page from Carmen to continue.',
        'error'
      )
    }
    window.addEventListener('ocr:unauthorized', handle)
    return () => window.removeEventListener('ocr:unauthorized', handle)
  }, [])

  // Proactively warn before the JWT lapses so long AP/mapping workflows aren't
  // cut off without notice. Re-armed whenever the active user changes.
  useEffect(() => {
    if (!user) return
    const expMs = getJwtExpMs(getStoredToken())
    if (!expMs) return
    const warnIn = expMs - Date.now() - EXPIRY_WARNING_MS
    if (warnIn <= 0) return
    const timer = window.setTimeout(
      () => {
        showToast(
          'Your session will expire in about 5 minutes. Finish and submit your work, then reopen from Carmen.',
          'warning'
        )
      },
      Math.min(warnIn, MAX_TIMEOUT_MS)
    )
    return () => window.clearTimeout(timer)
  }, [user])

  const login = useCallback((accessToken: string, userInfo: AuthUser) => {
    // If a different tenant previously used this browser, clear their residue
    // before switching the active namespace.
    const prevTenant = sessionStorage.getItem('ocr_last_tenant')
    if (prevTenant && prevTenant !== userInfo.tenant_id) {
      clearAppStorage()
      // A different tenant's unsent draft must never be offered back on this device.
      clearAllDrafts()
    }
    sessionStorage.removeItem(EXPIRED_FLAG_KEY)
    storeToken(accessToken)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo))
    sessionStorage.setItem('ocr_last_tenant', userInfo.tenant_id)
    // Persist uri keyed by tenant so "Go to Carmen" survives session expiry and
    // multi-tenant shared-device use without cross-tenant collision.
    if (userInfo.uri) setCarmenUri(userInfo.tenant_id, userInfo.uri)
    setActiveTenant(userInfo.tenant_id)
    setUser(userInfo)
  }, [])

  const logout = useCallback(async () => {
    const token = getStoredToken()
    if (token) await revokeSession(token)
    clearAppStorage()
    // Leaving on purpose is not a session drop — nothing is coming back for the draft.
    clearAllDrafts()
    setActiveTenant(null)
    clearToken()
    sessionStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
