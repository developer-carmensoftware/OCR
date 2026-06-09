import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { storeToken, clearToken, getStoredToken } from '../lib/api/client'
import { revokeSession } from '../lib/api/auth'
import { setActiveTenant, clearAppStorage } from '../lib/storage'
import { getJwtExpMs } from '../lib/jwt'
import { showToast } from '../lib/toast'

// Warn the user this long before their session token expires.
const EXPIRY_WARNING_MS = 5 * 60 * 1000
// Browsers store setTimeout delays in a signed 32-bit int; anything larger
// overflows and fires immediately. Clamp so a long-lived JWT doesn't trigger
// the expiry warning the instant the user logs in.
const MAX_TIMEOUT_MS = 2_147_483_647

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
    const stored = sessionStorage.getItem('ocr_user')
    if (token && stored) {
      try {
        const restored = JSON.parse(stored) as AuthUser
        // Restore the storage namespace synchronously, before any child hook
        // reads tenant-scoped localStorage on mount.
        setActiveTenant(restored.tenant_id)
        return restored
      } catch {
        clearToken()
        sessionStorage.removeItem('ocr_user')
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
      clearAppStorage()
      setActiveTenant(null)
      setUser(null)
      sessionStorage.removeItem('ocr_user')
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
    if (prevTenant && prevTenant !== userInfo.tenant_id) clearAppStorage()
    storeToken(accessToken)
    sessionStorage.setItem('ocr_user', JSON.stringify(userInfo))
    sessionStorage.setItem('ocr_last_tenant', userInfo.tenant_id)
    setActiveTenant(userInfo.tenant_id)
    setUser(userInfo)
  }, [])

  const logout = useCallback(async () => {
    const token = getStoredToken()
    if (token) await revokeSession(token)
    clearAppStorage()
    setActiveTenant(null)
    clearToken()
    sessionStorage.removeItem('ocr_user')
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
