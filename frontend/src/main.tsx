import React, { useState, useEffect, lazy, Suspense } from 'react'
import * as Sentry from '@sentry/react'
import { LazyMotion, domAnimation } from 'framer-motion'

// Apply persisted theme before first paint (avoids a light→dark flash).
document.documentElement.dataset.theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'

if (import.meta.env.VITE_SENTRY_DSN) {
  // The one-time Carmen SSO token arrives in the URL hash (#/…?token=…) and is only
  // stripped later, inside a React effect (useCarmenSSO) — so the pageload transaction,
  // navigation breadcrumbs, or any early error can carry it off-site. It cannot be
  // stripped before init (the effect still needs to read it), so redact it on the way out.
  const redact = (u: string) => u.replace(/([?&]token=)[^&]*/gi, '$1[redacted]')
  const scrub = <T extends Sentry.Event>(event: T): T => {
    if (event.request?.url) event.request.url = redact(event.request.url)
    if (typeof event.transaction === 'string') event.transaction = redact(event.transaction)
    for (const crumb of event.breadcrumbs ?? []) {
      for (const key of ['url', 'to', 'from'] as const) {
        const value = crumb.data?.[key]
        if (typeof value === 'string') crumb.data![key] = redact(value)
      }
    }
    return event
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: (import.meta.env.VITE_SENTRY_ENV as string) ?? 'production',
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend: scrub,
    beforeSendTransaction: scrub,
  })
}

import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { AdminAuthProvider } from './contexts/AdminAuthContext'
import { LanguageProvider } from './i18n/LanguageContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import { ConsentGate } from './components/common/ConsentGate'
import AdminProtectedRoute from './components/admin/AdminProtectedRoute'
import ErrorBoundary from './components/common/ErrorBoundary'
import PageSkeleton from './components/common/PageSkeleton'
import './index.css'

/** Remove the static HTML loader after React has painted. */
function dismissInitialLoader() {
  const bar = document.getElementById('app-loader-bar')
  const overlay = document.getElementById('app-loader')

  if (bar) {
    // Flash bar to 100% then fade it out
    bar.style.transition = 'width 0.25s ease, opacity 0.3s ease 0.25s'
    bar.style.width = '100%'
    bar.style.opacity = '0'
    setTimeout(() => bar.remove(), 600)
  }

  if (overlay) {
    overlay.classList.add('done')
    setTimeout(() => overlay.remove(), 350)
  }
}

const Home = lazy(() => import('./pages/Home'))
const CreditCardOCR = lazy(() => import('./pages/CreditCardOCR'))
const Mapping = lazy(() => import('./pages/Mapping'))
const APInvoice = lazy(() => import('./pages/APInvoice'))
const Pricing = lazy(() => import('./pages/Pricing'))
const OrderHistory = lazy(() => import('./pages/OrderHistory'))

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
const CreditsPage = lazy(() => import('./pages/admin/CreditsPage'))
const TenantsPage = lazy(() => import('./pages/admin/TenantsPage'))
const QuotaModulesPage = lazy(() => import('./pages/admin/QuotaModulesPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))

// Order Review — standalone page (own shell, reuses admin auth)
const OrderReviewShell = lazy(() => import('./pages/order-review/OrderReviewShell'))

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
  } else if (route === 'admin/tenants') {
    AdminPage = <TenantsPage />
  } else if (route === 'admin/quota-modules') {
    AdminPage = <QuotaModulesPage />
  } else if (route === 'admin/admin-users') {
    AdminPage = <AdminUsersPage />
  } else if (route === 'admin/sessions') {
    AdminPage = <SessionsPage />
  } else if (route === 'admin/credits') {
    AdminPage = <CreditsPage />
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
    const onHashChange = (e: HashChangeEvent) => {
      const next = getRoute()
      // ponytail: sessionStorage, not a store — one string, one reader.
      // Stash where we came from so pricing's back button can return there.
      const oldHash = e.oldURL ? new URL(e.oldURL).hash : ''
      const wasPricing = oldHash.replace(/^#\/?/, '').toLowerCase().startsWith('pricing')
      if (next.startsWith('pricing') && !wasPricing) {
        sessionStorage.setItem('pricing:returnTo', oldHash || '#/')
      }
      setRoute(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Out-of-credits (HTTP 402) anywhere in the app → send the user to pricing.
  useEffect(() => {
    const toPricing = () => {
      window.location.hash = '#/pricing'
    }
    window.addEventListener('ocr:open-topup', toPricing)
    return () => window.removeEventListener('ocr:open-topup', toPricing)
  }, [])

  // Order Review — standalone page, its own shell, reuses admin auth.
  if (route === 'order-review') {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AdminProtectedRoute>
          <OrderReviewShell />
        </AdminProtectedRoute>
      </Suspense>
    )
  }

  // Admin section — has its own auth, separate from Carmen
  if (route.startsWith('admin')) {
    return (
      <Suspense fallback={<PageSkeleton />}>
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
  } else if (route === 'pricing/orders') {
    Page = <OrderHistory />
  } else if (route.startsWith('pricing')) {
    Page = <Pricing />
  } else {
    Page = <Home />
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <div className="bg-blob-mid" aria-hidden="true" />
      <ProtectedRoute>{Page}</ProtectedRoute>
    </Suspense>
  )
}

// HMR guard: reuse the existing root across hot reloads instead of calling
// createRoot() again on the same DOM node (that leaves two React trees
// fighting over #root and throws "removeChild" errors on the next edit).
const container = document.getElementById('root') as HTMLElement
const root = import.meta.hot?.data.root ?? ReactDOM.createRoot(container)
if (import.meta.hot) {
  import.meta.hot.data.root = root
}
root.render(
  <ErrorBoundary>
    <LazyMotion features={domAnimation}>
      <AuthProvider>
        <AdminAuthProvider>
          <Toaster
            position="bottom-center"
            duration={3500}
            visibleToasts={4}
            expand={false}
            closeButton
            richColors
            theme="light"
          />
          <LanguageProvider>
            <ConsentGate>
              <Router />
            </ConsentGate>
          </LanguageProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </LazyMotion>
  </ErrorBoundary>
)

// Hand off from the static HTML loader to the React app
dismissInitialLoader()
