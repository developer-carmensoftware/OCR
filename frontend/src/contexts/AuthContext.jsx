import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { storeToken, clearToken, getStoredToken } from '../lib/api/client'
import { revokeSession } from '../lib/api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // { user_id, username, bu, uri }
  const [loading, setLoading] = useState(true) // true while restoring session on mount

  // Restore session from sessionStorage on page reload
  useEffect(() => {
    const token = getStoredToken()
    const stored = sessionStorage.getItem('ocr_user')
    if (token && stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        clearToken()
        sessionStorage.removeItem('ocr_user')
      }
    }
    setLoading(false)
  }, [])

  // Listen for 401 events fired by apiFetch
  useEffect(() => {
    const handle = () => {
      setUser(null)
      sessionStorage.removeItem('ocr_user')
    }
    window.addEventListener('ocr:unauthorized', handle)
    return () => window.removeEventListener('ocr:unauthorized', handle)
  }, [])

  const login = useCallback((accessToken, userInfo) => {
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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
