import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { storeToken, clearToken, getStoredToken } from '../lib/api/client'
import { revokeSession } from '../lib/api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Restore session synchronously on first render — avoids the auth-screen flash
  const [user, setUser] = useState(() => {
    const token = getStoredToken()
    const stored = sessionStorage.getItem('ocr_user')
    if (token && stored) {
      try {
        return JSON.parse(stored)
      } catch {
        clearToken()
        sessionStorage.removeItem('ocr_user')
      }
    }
    return null
  })
  const [loading] = useState(false)

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
