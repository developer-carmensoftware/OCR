import { Loader2, AlertTriangle, Shield, Circle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCarmenSSO } from '../../hooks/useCarmenSSO'
import { getCarmenUrl } from '../../lib/url'
import logo from '../../assets/logo.png'

const DEV_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

export default function ProtectedRoute({ children }) {
  if (DEV_BYPASS) return children

  const { isAuthenticated, loading } = useAuth()
  const { exchanging, error } = useCarmenSSO()

  if (loading || exchanging) return <AuthScreen state="loading" />
  if (error) return <AuthScreen state="error" message={error} />
  if (!isAuthenticated) return <AuthScreen state="unauthenticated" />

  return children
}

function AuthScreen({ state, message }) {
  const config = {
    loading: {
      Icon: Loader2,
      iconClass: 'animate-spin',
      iconBg: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 50%, var(--teal) 100%)',
      title: 'กำลังยืนยันตัวตน',
      subtitle: 'กรุณารอสักครู่...',
      badge: null,
    },
    error: {
      Icon: AlertTriangle,
      iconBg: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
      title: 'ไม่สามารถยืนยันตัวตนได้',
      subtitle: message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      badge: { label: 'Authentication Error', color: 'var(--rose)', bg: 'var(--rose-light)', border: 'var(--rose-mid)' },
    },
    unauthenticated: {
      Icon: Shield,
      iconBg: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 50%, var(--teal) 100%)',
      title: 'กรุณาเข้าใช้งานผ่านระบบ Carmen',
      subtitle: 'ระบบนี้ต้องเข้าใช้งานผ่านหน้าเว็บ Carmen เท่านั้น',
      badge: { label: 'Authentication Required', color: 'var(--primary)', bg: 'var(--primary-light)', border: 'var(--primary-mid)' },
    },
  }[state]

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* top accent bar */}
        <div style={styles.accentBar} />

        {/* logo icon */}
        <div style={{ ...styles.iconWrap, background: config.iconBg }}>
          <config.Icon size={26} color="#fff" className={config.iconClass} strokeWidth={2.25} />
        </div>

        {/* brand mark */}
        <div style={styles.brand}>
          <img src={logo} alt="Carmen AI Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
          <span style={styles.brandText}>Carmen <span style={styles.brandAccent}>AI</span></span>
        </div>

        <h2 style={styles.title}>{config.title}</h2>
        <p style={styles.subtitle}>{config.subtitle}</p>

        {config.badge && (
          <div style={{
            ...styles.badge,
            color: config.badge.color,
            background: config.badge.bg,
            border: `1px solid ${config.badge.border}`,
          }}>
            <Circle size={7} fill="currentColor" strokeWidth={0} />
            {config.badge.label}
          </div>
        )}

        {state === 'loading' && (
          <div style={styles.progressTrack}>
            <div style={styles.progressBar} />
          </div>
        )}

        {state === 'unauthenticated' && (
          <a
            href={getCarmenUrl('/')}
            style={{
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.75rem',
              background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 50%, var(--teal) 100%)',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
              transition: 'all 0.2s',
            }}
          >
            ไปที่หน้าเข้าสู่ระบบ Carmen
          </a>
        )}
      </div>

      <div style={styles.footer}>
        Carmen Cloud AI Automation Platform • Powered by AI OCR &amp; LLM
      </div>

      <style>{`
        @keyframes progressSlide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @keyframes authFadeIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  page: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    overflow: 'hidden',
    padding: '2rem 1rem',
    fontFamily: "'IBM Plex Sans', 'Sarabun', sans-serif",
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: '380px',
    background: 'var(--glass-bg, rgba(255,255,255,0.88))',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.7))',
    borderRadius: '20px',
    padding: '2.5rem 2rem 2rem',
    boxShadow: 'var(--shadow-xl)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.85rem',
    animation: 'authFadeIn 0.4s ease both',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, var(--primary) 0%, #818cf8 50%, var(--teal) 100%)',
  },
  iconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.25rem',
    boxShadow: '0 10px 32px rgba(79,70,229,0.25), 0 4px 10px rgba(79,70,229,0.12)',
  },
  icon: {
    fontSize: '1.6rem',
    color: '#fff',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-3)',
    letterSpacing: '0.01em',
  },
  brandIcon: {
    fontSize: '0.85rem',
    color: 'var(--primary)',
  },
  brandText: {
    color: 'var(--text-2)',
  },
  brandAccent: {
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--teal) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 700,
  },
  title: {
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--text)',
    textAlign: 'center',
    letterSpacing: '-0.01em',
    margin: 0,
    lineHeight: 1.35,
  },
  subtitle: {
    fontSize: '0.82rem',
    color: 'var(--text-3)',
    textAlign: 'center',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: '280px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.68rem',
    fontWeight: 600,
    padding: '0.25rem 0.75rem',
    borderRadius: '100px',
    letterSpacing: '0.03em',
    marginTop: '0.25rem',
  },
  progressTrack: {
    width: '100%',
    height: '3px',
    background: 'var(--gray-100)',
    borderRadius: '100px',
    overflow: 'hidden',
    marginTop: '0.5rem',
  },
  progressBar: {
    height: '100%',
    width: '50%',
    borderRadius: '100px',
    background: 'linear-gradient(90deg, var(--primary), var(--teal))',
    animation: 'progressSlide 1.4s ease-in-out infinite',
  },
  footer: {
    marginTop: '1.75rem',
    fontSize: '0.7rem',
    color: 'var(--text-4)',
    textAlign: 'center',
    letterSpacing: '0.01em',
  },
}
