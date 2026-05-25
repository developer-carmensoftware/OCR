import type { ReactNode } from 'react'
import { Loader2, AlertTriangle, Shield, Circle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCarmenSSO } from '../../hooks/useCarmenSSO'
import { getCarmenUrl } from '../../lib/url'
import logo from '../../assets/logo.png'
import '../../styles/components/auth-screen.css'

const DEV_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (DEV_BYPASS) return <>{children}</>

  // hooks must be called unconditionally — DEV_BYPASS check above is evaluated at module level
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isAuthenticated, loading } = useAuth() as { isAuthenticated: boolean; loading: boolean }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { exchanging, error } = useCarmenSSO()

  if (loading || exchanging) return <AuthScreen state="loading" />
  if (error) return <AuthScreen state="error" message={error} />
  if (!isAuthenticated) return <AuthScreen state="unauthenticated" />

  return <>{children}</>
}

type AuthState = 'loading' | 'error' | 'unauthenticated'

interface AuthScreenProps {
  state: AuthState
  message?: string | null
}

interface BadgeConfig {
  label: string
}
interface StateConfig {
  Icon: React.ElementType
  iconClass?: string
  title: string
  subtitle: string
  badge: BadgeConfig | null
}

function AuthScreen({ state, message }: AuthScreenProps) {
  const configs: Record<AuthState, StateConfig> = {
    loading: {
      Icon: Loader2,
      iconClass: 'animate-spin',
      title: 'Authenticating',
      subtitle: 'Verifying your session with Carmen...',
      badge: null,
    },
    error: {
      Icon: AlertTriangle,
      title: 'Authentication Failed',
      subtitle: message || 'An error occurred. Please try again.',
      badge: {
        label: 'Auth Error',
      },
    },
    unauthenticated: {
      Icon: Shield,
      title: 'Access via Carmen',
      subtitle: 'This system must be accessed through the Carmen web interface.',
      badge: {
        label: 'Authentication Required',
      },
    },
  }
  const config = configs[state]

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logo} alt="Carmen Cloud AI" className="auth-brand-logo" />
          <span className="auth-brand-text">
            Carmen <strong className="auth-brand-highlight">AI</strong>
          </span>
        </div>
        <div className="auth-divider" />
        <div className={`auth-icon-container auth-icon-container--${state}`}>
          <config.Icon size={24} strokeWidth={1.75} className={config.iconClass} />
        </div>
        <h2 className="auth-title">{config.title}</h2>
        <p className="auth-subtitle">{config.subtitle}</p>
        {config.badge && (
          <div className={`auth-badge auth-badge--${state}`}>
            <Circle size={6} fill="currentColor" strokeWidth={0} />
            {config.badge.label}
          </div>
        )}
        {state === 'loading' && (
          <div className="auth-progress-track">
            <div className="auth-progress-bar" />
          </div>
        )}
        {(state === 'unauthenticated' || state === 'error') && (
          <a href={getCarmenUrl('/')} className="auth-btn">
            Go to Carmen
          </a>
        )}
      </div>
      <p className="auth-footer">Carmen Cloud AI Automation Platform</p>
    </div>
  )
}

import type React from 'react'
