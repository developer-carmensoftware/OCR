import type { ReactNode } from 'react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>
  }

  if (!isAuthenticated) {
    window.location.hash = '/admin/login'
    return null
  }

  return <>{children}</>
}
