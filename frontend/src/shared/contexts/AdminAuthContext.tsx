import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  type AdminUser,
  adminLogout,
  adminMe,
  clearAdminToken,
  getAdminToken,
  storeAdminToken,
} from '@/shared/api/adminAuth'

interface AdminAuthContextValue {
  admin: AdminUser | null
  loading: boolean
  isAuthenticated: boolean
  login: (token: string) => Promise<AdminUser>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAdminToken()
    if (!token) {
      setLoading(false)
      return
    }
    adminMe()
      .then(setAdmin)
      // Deliberately not clearing the token here. A 401 already does, through the
      // `admin:unauthorized` event below (adminFetch dispatches it); anything else — a
      // 429 from reloading fast, a 5xx, the network — says nothing about the token, and
      // clearing it logged the admin out on the next reload for no reason.
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handle = () => {
      setAdmin(null)
      clearAdminToken()
    }
    window.addEventListener('admin:unauthorized', handle)
    return () => window.removeEventListener('admin:unauthorized', handle)
  }, [])

  const login = useCallback(async (token: string) => {
    storeAdminToken(token)
    const me = await adminMe()
    setAdmin(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    await adminLogout().catch(() => {})
    setAdmin(null)
  }, [])

  return (
    <AdminAuthContext.Provider value={{ admin, loading, isAuthenticated: !!admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be inside <AdminAuthProvider>')
  return ctx
}
