import React, { useState, useEffect, lazy, Suspense } from 'react'
import * as Sentry from '@sentry/react'
import { LazyMotion, domAnimation } from 'framer-motion'

// Theme is applied by an inline script in index.html, which runs before the static loader
// paints — early enough that dark-mode users never see the light loader. Nothing to do
// here; useDarkMode reads and toggles document.documentElement.dataset.theme from now on.

if (import.meta.env.VITE_SENTRY_DSN) {
  // The one-time Carmen SSO token arrives in the URL hash (#/…?token=…) and is only
  // stripped later, inside a React effect (useCarmenSSO) — so the pageload transaction,
  // navigation breadcrumbs, or any early error can carry it off-site. It cannot be
  // stripped before init (the effect still needs to read it), so redact it on the way out.
  // `posting_token` too: the settings link carries a BU posting token (decision #35).
  const redact = (u: string) => u.replace(/([?&](?:posting_)?token=)[^&]*/gi, '$1[redacted]')
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
import { AuthProvider } from '@/shared/contexts/AuthContext'
import { AdminAuthProvider } from '@/shared/contexts/AdminAuthContext'
import { LanguageProvider } from './i18n/LanguageContext'
import ProtectedRoute from '@/shared/components/common/ProtectedRoute'
import { ConsentGate } from '@/shared/components/common/ConsentGate'
import { ssoLink } from '@/shared/hooks/useCarmenSSO'
import { MaintenanceGate } from '@/shared/components/common/MaintenanceGate'
import AdminProtectedRoute from '@/shared/components/common/AdminProtectedRoute'
import ErrorBoundary from '@/shared/components/common/ErrorBoundary'
import PageSkeleton from '@/shared/components/common/PageSkeleton'
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

const Home = lazy(() => import('@/features/home/pages/Home'))
const ManualScan = lazy(() => import('@/features/credit-card/pages/ManualScan'))
const ReviewQueue = lazy(() => import('@/features/credit-card/pages/ReviewQueue'))
const Mapping = lazy(() => import('@/features/credit-card/pages/Mapping'))
const APInvoice = lazy(() => import('@/features/ap-invoice/pages/APInvoice'))
const Pricing = lazy(() => import('@/features/billing/pages/Pricing'))
const OrderHistory = lazy(() => import('@/features/billing/pages/OrderHistory'))
const WhatsNew = lazy(() => import('@/features/home/pages/WhatsNew'))
const EmailSettings = lazy(() => import('@/features/email-settings/pages/EmailSettings'))
const PmsPage = lazy(() => import('@/features/pms/pages/PmsPage'))

// Admin pages
const AdminRouter = lazy(() => import('@/features/admin/pages/AdminRouter'))

// Order Review — standalone page (own shell, reuses admin auth)
const OrderReviewShell = lazy(() => import('@/features/admin/pages/order-review/OrderReviewShell'))

function getRoute(): string {
  const hash = window.location.hash.split('?')[0]
  return hash.replace(/^#\/?/, '').toLowerCase()
}

function Router() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHashChange = (e: HashChangeEvent) => {
      // A Carmen SSO link landing in a tab that already runs the app (CA-121): start over,
      // exactly as a new tab would. Signing in again in place would leave the previous BU
      // in every mounted page and module-level cache (the GL masters). The live hash, not
      // e.newURL: by the time a redirect's own hashchange arrives, useCarmenSSO stripped it.
      if (ssoLink(window.location.hash)) {
        window.location.reload()
        return
      }
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
    // Carmen's SSO deep-link lands on the bare route, so whatever renders there is the
    // module's first screen — the queue. The wizard is somewhere you go on purpose.
    if (sub === 'mapping') Page = <Mapping />
    else if (sub === 'ar-settings') {
      // Merged into the mapping page 2026-09-22 (decision #3) — redirect rather than
      // 404 a bookmark or a stale link, preserving `?bank=` so it still lands on the
      // bank the caller meant. `replace` so Back does not bounce through the old URL.
      const query = window.location.hash.split('?')[1]
      window.location.replace(`#/CreditCardOCR/mapping${query ? `?${query}` : ''}`)
      Page = <Mapping />
    } else if (sub === 'manual') Page = <ManualScan />
    // AI JV Automation settings (decision #34). Opened from Carmen's menu and from the
    // queue's fix buttons; deliberately not a Home tile — Carmen's menu is the front door.
    else if (sub === 'email-settings') Page = <EmailSettings />
    // `/review?id=…` is the queue with a document open over it. Same component, so
    // opening and closing a document never refetches the list behind it.
    else Page = <ReviewQueue />
  } else if (route.startsWith('apinvoice')) {
    Page = <APInvoice />
  } else if (route === 'whats-new') {
    Page = <WhatsNew />
  } else if (route === 'email-settings') {
    // Moved under the module it configures 2026-10-01. Redirect, keeping the query, so a
    // Carmen menu link built against the old path still signs in (`?token=` rides along).
    const query = window.location.hash.split('?')[1]
    window.location.replace(`#/CreditCardOCR/email-settings${query ? `?${query}` : ''}`)
    Page = <EmailSettings />
  } else if (route === 'pms') {
    // A BU's own PMS keys (CA-117). Opened only from Carmen's menu with the SSO link
    // (decision #40); deliberately no Home tile or in-app link.
    Page = <PmsPage />
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
            <MaintenanceGate>
              <ConsentGate>
                <Router />
              </ConsentGate>
            </MaintenanceGate>
          </LanguageProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </LazyMotion>
  </ErrorBoundary>
)

// Hand off from the static HTML loader to the React app
dismissInitialLoader()
