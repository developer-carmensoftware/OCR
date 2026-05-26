import React, { useState, useEffect, lazy, Suspense } from 'react'
import * as Sentry from '@sentry/react'

document.documentElement.dataset.theme = 'light'

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: (import.meta.env.VITE_SENTRY_ENV as string) ?? 'production',
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
  })
}

import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AdminProtectedRoute from './components/admin/AdminProtectedRoute'
import ErrorBoundary from './components/common/ErrorBoundary'
import './index.css'

const Home = lazy(() => import('./pages/Home'))
const CreditCardOCR = lazy(() => import('./pages/CreditCardOCR'))
const Mapping = lazy(() => import('./pages/Mapping'))
const APInvoice = lazy(() => import('./pages/APInvoice'))

// Admin pages
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Overview = lazy(() => import('./pages/admin/Overview'))
const UsagePage = lazy(() => import('./pages/admin/UsagePage'))
const TenantRankingPage = lazy(() => import('./pages/admin/TenantRankingPage'))
const LLMLogsPage = lazy(() => import('./pages/admin/LLMLogsPage'))
const PerformancePage = lazy(() => import('./pages/admin/PerformancePage'))
const ErrorsPage = lazy(() => import('./pages/admin/ErrorsPage'))
const AnomaliesPage = lazy(() => import('./pages/admin/AnomaliesPage'))
const JobsPage = lazy(() => import('./pages/admin/JobsPage'))
const SessionsPage = lazy(() => import('./pages/admin/SessionsPage'))

function getRoute(): string {
  const hash = window.location.hash.split('?')[0]
  return hash.replace(/^#\/?/, '').toLowerCase()
}

function AdminRouter() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (route === 'admin/login') {
    return <AdminLogin />
  }

  let AdminPage: React.ReactElement
  if (route === 'admin' || route === 'admin/') {
    AdminPage = <Overview />
  } else if (route === 'admin/usage') {
    AdminPage = <UsagePage />
  } else if (route === 'admin/tenant-ranking') {
    AdminPage = <TenantRankingPage />
  } else if (route === 'admin/llm-logs') {
    AdminPage = <LLMLogsPage />
  } else if (route === 'admin/performance') {
    AdminPage = <PerformancePage />
  } else if (route === 'admin/errors') {
    AdminPage = <ErrorsPage />
  } else if (route === 'admin/anomalies') {
    AdminPage = <AnomaliesPage />
  } else if (route === 'admin/jobs') {
    AdminPage = <JobsPage />
  } else if (route === 'admin/sessions') {
    AdminPage = <SessionsPage />
  } else {
    AdminPage = <Overview />
  }

  return (
    <AdminProtectedRoute>
      <AdminLayout>{AdminPage}</AdminLayout>
    </AdminProtectedRoute>
  )
}

function Router() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Admin section — has its own auth, separate from Carmen
  if (route.startsWith('admin')) {
    return (
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>
        }
      >
        <AdminRouter />
      </Suspense>
    )
  }

  let Page: React.ReactElement
  if (route.startsWith('creditcardocr')) {
    const sub = route.replace('creditcardocr', '').replace(/^\//, '')
    Page = sub === 'mapping' ? <Mapping /> : <CreditCardOCR />
  } else if (route.startsWith('apinvoice')) {
    Page = <APInvoice />
  } else {
    Page = <Home />
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-gray-400">Loading…</div>
      }
    >
      <div className="bg-blob-mid" aria-hidden="true" />
      <ProtectedRoute>{Page}</ProtectedRoute>
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <AuthProvider>
      <AdminAuthProvider>
        <Toaster richColors position="top-right" duration={3500} />
        <Router />
      </AdminAuthProvider>
    </AuthProvider>
  </ErrorBoundary>
)
