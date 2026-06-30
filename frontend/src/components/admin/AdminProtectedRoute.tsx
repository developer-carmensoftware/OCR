import type { ReactNode } from 'react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>
  }

  if (!isAuthenticated) {
    // Remember where the user was headed so login can return them there
    // (e.g. the standalone /order-review page, not the admin dashboard).
    const here = window.location.hash.replace(/^#/, '')
    if (here && !here.startsWith('/admin/login')) {
      sessionStorage.setItem('admin_return_to', here)
    }
    window.location.hash = '/admin/login'
    return null
  }

  return <>{children}</>
}
