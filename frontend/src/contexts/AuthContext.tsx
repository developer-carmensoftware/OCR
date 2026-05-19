import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { storeToken, clearToken, getStoredToken } from '../lib/api/client'
import { revokeSession } from '../lib/api/auth'

export interface AuthUser {
  carmen_user_id: string
  username: string
  bu: string
  uri: string
  tenant_id: string
  business_unit_id: string
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
        return JSON.parse(stored) as AuthUser
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
      setUser(null)
      sessionStorage.removeItem('ocr_user')
    }
    window.addEventListener('ocr:unauthorized', handle)
    return () => window.removeEventListener('ocr:unauthorized', handle)
  }, [])

  const login = useCallback((accessToken: string, userInfo: AuthUser) => {
    storeToken(accessToken)
    sessionStorage.setItem('ocr_user', JSON.stringify(userInfo))
    setUser(userInfo)
  }, [])

  const logout = useCallback(async () => {
    const token = getStoredToken()
    if (token) await revokeSession(token)
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
