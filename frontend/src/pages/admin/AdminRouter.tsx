import { useEffect, useState, lazy } from 'react'
import AdminProtectedRoute from '../../components/admin/AdminProtectedRoute'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import AdminLayout from './AdminLayout'
import { ADMIN_ROUTES, Overview } from './routes'

const AdminLogin = lazy(() => import('./AdminLogin'))

/**
 * Hash routing for `#/admin/*`.
 *
 * Lives here rather than in `main.tsx` so the whole dashboard — this map, the nav
 * tree, the icons — stays inside the lazily-loaded admin chunk. `main.tsx` only knows
 * that a route starting with "admin" belongs to this component.
 */
function getRoute(): string {
  return window.location.hash.split('?')[0].replace(/^#\/?/, '').toLowerCase()
}

export default function AdminRouter() {
  const [route, setRoute] = useState(getRoute)
  const { admin } = useAdminAuth()

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (route === 'admin/login') {
    return <AdminLogin />
  }

  // ponytail: `tenants:read` gates the entire dashboard — every page here needs it
  // except the order queue, which has its own shell. Cheaper and stricter than
  // filtering the nav per item. The backend 403s regardless; this is the UX half.
  if (admin && !admin.permissions.includes('tenants:read')) {
    window.location.hash = '/order-review'
    return null
  }

  // Unknown hashes (and '/admin/' with its trailing slash) fall back to Overview.
  const AdminPage = ADMIN_ROUTES[route] ?? Overview

  return (
    <AdminProtectedRoute>
      <AdminLayout>
        <AdminPage />
      </AdminLayout>
    </AdminProtectedRoute>
  )
}
