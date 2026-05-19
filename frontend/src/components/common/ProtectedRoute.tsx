import type { ReactNode, CSSProperties } from 'react'
import { Loader2, AlertTriangle, Shield, Circle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCarmenSSO } from '../../hooks/useCarmenSSO'
import { getCarmenUrl } from '../../lib/url'
import logo from '../../assets/logo.png'

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
  color: string
  bg: string
  border: string
}
interface StateConfig {
  Icon: React.ElementType
  iconClass?: string
  iconColor: string
  iconBg: string
  iconBorder: string
  title: string
  subtitle: string
  badge: BadgeConfig | null
}

function AuthScreen({ state, message }: AuthScreenProps) {
  const configs: Record<AuthState, StateConfig> = {
    loading: {
      Icon: Loader2,
      iconClass: 'animate-spin',
      iconColor: 'var(--primary)',
      iconBg: 'var(--primary-light)',
      iconBorder: 'var(--primary-mid)',
      title: 'Authenticating',
      subtitle: 'Verifying your session with Carmen...',
      badge: null,
    },
    error: {
      Icon: AlertTriangle,
      iconColor: 'var(--rose)',
      iconBg: 'var(--rose-light)',
      iconBorder: 'var(--rose-mid)',
      title: 'Authentication Failed',
      subtitle: message || 'An error occurred. Please try again.',
      badge: {
        label: 'Auth Error',
        color: 'var(--rose)',
        bg: 'var(--rose-light)',
        border: 'var(--rose-mid)',
      },
    },
    unauthenticated: {
      Icon: Shield,
      iconColor: 'var(--primary)',
      iconBg: 'var(--primary-light)',
      iconBorder: 'var(--primary-mid)',
      title: 'Access via Carmen',
      subtitle: 'This system must be accessed through the Carmen web interface.',
      badge: {
        label: 'Authentication Required',
        color: 'var(--primary)',
        bg: 'var(--primary-light)',
        border: 'var(--primary-mid)',
      },
    },
  }
  const config = configs[state]

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <img
            src={logo}
            alt="Carmen Cloud AI"
            style={{ width: 18, height: 18, objectFit: 'contain' }}
          />
          <span style={styles.brandText}>
            Carmen <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>AI</strong>
          </span>
        </div>
        <div
          style={{ width: '100%', height: 1, background: 'var(--border)', margin: '0.25rem 0' }}
        />
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-md)',
            background: config.iconBg,
            border: `1.5px solid ${config.iconBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '0.5rem',
            color: config.iconColor,
          }}
        >
          <config.Icon size={24} strokeWidth={1.75} className={config.iconClass} />
        </div>
        <h2 style={styles.title}>{config.title}</h2>
        <p style={styles.subtitle}>{config.subtitle}</p>
        {config.badge && (
          <div
            style={{
              ...styles.badge,
              color: config.badge.color,
              background: config.badge.bg,
              border: `1px solid ${config.badge.border}`,
            }}
          >
            <Circle size={6} fill="currentColor" strokeWidth={0} />
            {config.badge.label}
          </div>
        )}
        {state === 'loading' && (
          <div style={styles.progressTrack}>
            <div style={styles.progressBar} />
          </div>
        )}
        {(state === 'unauthenticated' || state === 'error') && (
          <a href={getCarmenUrl('/')} style={styles.btn}>
            Go to Carmen
          </a>
        )}
      </div>
      <p style={styles.footer}>Carmen Cloud AI Automation Platform</p>
      <style>{`
        @keyframes progressSlide { 0% { transform: translateX(-100%); } 50% { transform: translateX(0%); } 100% { transform: translateX(100%); } }
        @keyframes authFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  page: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'oklch(0.90 0.014 258.7)',
    backgroundImage:
      'radial-gradient(ellipse 70% 30% at 50% 0%, oklch(0.4714 0.1794 258.7 / 0.10) 0%, transparent 100%)',
    padding: '2rem 1rem',
    fontFamily: "'Inter', 'Sarabun', sans-serif",
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: '360px',
    background: 'var(--card-bg, #fff)',
    border: '1px solid rgba(255,255,255,0.7)',
    borderRadius: '20px',
    padding: '2rem 1.75rem',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(15,25,60,0.10), 0 4px 16px rgba(15,25,60,0.10), 0 12px 32px rgba(15,25,60,0.07)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    animation: 'authFadeIn 0.35s ease both',
  },
  brand: { display: 'flex', alignItems: 'center', gap: '0.45rem', alignSelf: 'flex-start' },
  brandText: {
    fontSize: '0.82rem',
    fontWeight: 500,
    color: 'var(--text-3)',
    letterSpacing: '0.01em',
  },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text)',
    textAlign: 'center',
    letterSpacing: '-0.01em',
    margin: 0,
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-3)',
    textAlign: 'center',
    lineHeight: 1.65,
    margin: 0,
    maxWidth: '260px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.65rem',
    fontWeight: 600,
    padding: '0.22rem 0.65rem',
    borderRadius: '100px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  progressTrack: {
    width: '100%',
    height: '2px',
    background: 'var(--border)',
    borderRadius: '100px',
    overflow: 'hidden',
    marginTop: '0.25rem',
  },
  progressBar: {
    height: '100%',
    width: '45%',
    borderRadius: '100px',
    background: 'var(--primary)',
    animation: 'progressSlide 1.4s ease-in-out infinite',
  },
  btn: {
    marginTop: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '0.7rem',
    background: 'var(--primary)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '0.875rem',
    boxShadow: '0 2px 8px rgba(15,25,60,0.15)',
    transition: 'background 0.18s, transform 0.15s',
  },
  footer: {
    marginTop: '1.5rem',
    fontSize: '0.68rem',
    color: 'var(--text-4)',
    textAlign: 'center',
    letterSpacing: '0.02em',
  },
}

import type React from 'react'
