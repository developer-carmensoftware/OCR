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
import ProtectedRoute from './components/common/ProtectedRoute'
import ErrorBoundary from './components/common/ErrorBoundary'
import './index.css'

const Home = lazy(() => import('./pages/Home'))
const CreditCardOCR = lazy(() => import('./pages/CreditCardOCR'))
const Mapping = lazy(() => import('./pages/Mapping'))
const APInvoice = lazy(() => import('./pages/APInvoice'))

function getRoute(): string {
  const hash = window.location.hash.split('?')[0]
  return hash.replace(/^#\/?/, '').toLowerCase()
}

function Router() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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
      <Toaster richColors position="top-right" duration={3500} />
      <Router />
    </AuthProvider>
  </ErrorBoundary>
)
