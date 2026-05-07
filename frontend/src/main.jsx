import { useState, useEffect } from 'react'

// Force light theme for all pages
document.documentElement.dataset.theme = 'light'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'sonner'
import Home from './pages/Home'
import CreditCardOCR from './pages/CreditCardOCR'
import Mapping from './pages/Mapping'
import APInvoice from './pages/APInvoice'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import ErrorBoundary from './components/common/ErrorBoundary'
import './index.css'

function getRoute() {
  // Normalize: "#/CreditCardOCR" → "creditcardocr"  (strip query string from hash first)
  const hash = window.location.hash.split('?')[0]
  return hash.replace(/^#\/?/, '').toLowerCase()
}

function Router() {
  const [route, setRoute] = useState(getRoute())

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  let Page
  if (route.startsWith('creditcardocr')) {
    const sub = route.replace('creditcardocr', '').replace(/^\//, '')
    Page = sub === 'mapping' ? <Mapping /> : <CreditCardOCR />
  } else if (route.startsWith('apinvoice')) {
    Page = <APInvoice />
  } else {
    Page = <Home />
  }

  return <ProtectedRoute>{Page}</ProtectedRoute>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <AuthProvider>
      <Toaster richColors position="top-right" duration={3500} />
      <Router />
    </AuthProvider>
  </ErrorBoundary>,
)
