import type { ReactNode } from 'react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) {
    // ponytail: inline styles — this is the only full-screen loader in the app,
    // and a one-use CSS class costs more to find than to read here.
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-4)',
        }}
      >
        Loading…
      </div>
    )
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
