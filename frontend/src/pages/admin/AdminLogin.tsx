import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { adminLogin, AdminLoginError } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'
import logo from '../../assets/logo.png'

/** What went wrong, in terms the person at the keyboard can act on. */
type LoginErrorKind = 'invalid' | 'locked' | 'noAccess' | 'network' | 'generic'

interface LoginError {
  kind: LoginErrorKind
  /** Wall-clock ms when a 423 lockout lifts. */
  unlockAt?: number
}

/**
 * HTTP status carries the whole distinction, so we never string-match the
 * backend's English. 403 covers both "Account disabled" and "No active roles
 * assigned": different causes, identical remedy for the user, one message.
 */
export function classify(err: unknown): LoginError {
  if (!(err instanceof AdminLoginError)) return { kind: 'generic' }
  if (err.status === 423) {
    return {
      kind: 'locked',
      unlockAt: err.retryAfterSec ? Date.now() + err.retryAfterSec * 1000 : undefined,
    }
  }
  if (err.status === 403) return { kind: 'noAccess' }
  if (err.status === 401 || err.status === 400) return { kind: 'invalid' }
  if (err.status >= 500 || err.status === 0) return { kind: 'network' }
  return { kind: 'generic' }
}

export const mmss = (total: number) =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`

export default function AdminLogin() {
  const { t } = useT()
  const { login } = useAdminAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<LoginError | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const passwordRef = useRef<HTMLInputElement>(null)

  const unlockAt = error?.kind === 'locked' ? error.unlockAt : undefined
  const lockRemaining = unlockAt ? Math.max(0, Math.ceil((unlockAt - now) / 1000)) : 0
  const locked = error?.kind === 'locked' && lockRemaining > 0

  // Tick only while a lockout is actually counting down.
  useEffect(() => {
    if (!unlockAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [unlockAt])

  // The moment it lifts, clear the wall — leaving a stale "0:00" banner up would
  // read as still locked.
  useEffect(() => {
    if (error?.kind === 'locked' && unlockAt && lockRemaining === 0) setError(null)
  }, [error?.kind, unlockAt, lockRemaining])

  /** Editing is an attempt to fix the problem, so the message goes. A lockout is
   *  not fixable by typing, so it stays. */
  const clearError = () => setError(e => (e?.kind === 'locked' ? e : null))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password || locked) return
    setLoading(true)
    setError(null)
    try {
      const res = await adminLogin(username, password)
      const me = await login(res.access_token)
      const back = sessionStorage.getItem('admin_return_to')
      sessionStorage.removeItem('admin_return_to')
      // ponytail: one perm decides the whole dashboard. `order_reviewer` has only
      // orders:* — land them on their console instead of an /admin full of 403s.
      window.location.hash = me.permissions.includes('tenants:read')
        ? back || '/admin'
        : '/order-review'
    } catch (err: unknown) {
      const next = classify(err)
      setError(next)
      setNow(Date.now())
      // Put the caret back where the fix is, with the old value selected so the
      // next keystroke replaces it. Pointless when they simply have to wait.
      if (next.kind !== 'locked' && next.kind !== 'noAccess') {
        passwordRef.current?.focus()
        passwordRef.current?.select()
      }
    } finally {
      setLoading(false)
    }
  }

  const revealLabel = revealed ? t('admin.login.hidePassword') : t('admin.login.showPassword')

  const errorMessage = !error
    ? null
    : error.kind === 'locked'
      ? lockRemaining
        ? t('admin.login.error.locked', { time: mmss(lockRemaining) })
        : t('admin.login.error.lockedNoTime')
      : t(`admin.login.error.${error.kind}`)

  return (
    <div className="admin-login-page">
      <div className="admin-login-inner">
        <div className="admin-login-brand">
          {/* Decorative: the wordmark beside it already announces "Carmen AI". */}
          <img src={logo} alt="" className="admin-login-brand-logo" />
          <span className="admin-login-brand-text">
            Carmen <strong className="admin-login-brand-highlight">AI</strong>
          </span>
        </div>

        <h1 className="admin-login-title">{t('admin.login.title')}</h1>
        <p className="admin-login-subtitle">{t('admin.login.subtitle')}</p>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          {/* Disabling the set, not each control, also covers the reveal button
              and blocks a second submit while the first is in flight. */}
          <fieldset className="admin-login-fields" disabled={loading}>
            {/* Lives above the fields and stays put: a toast would announce the
                one thing they need while their eyes are on the form, then leave. */}
            {errorMessage && (
              <p className="admin-login-error" role="alert">
                <AlertCircle size={15} strokeWidth={2.25} aria-hidden="true" />
                <span>{errorMessage}</span>
              </p>
            )}

            <div className="admin-form-group">
              <label className="admin-form-label" htmlFor="username">
                {t('admin.login.username')}
              </label>
              <input
                id="username"
                type="text"
                className="admin-form-input"
                value={username}
                onChange={e => {
                  setUsername(e.target.value)
                  clearError()
                }}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="admin-form-group">
              {/* The caps hint lives on the label row, not under the field: appearing
                  below it would shift the submit button under the user's cursor. */}
              <div className="admin-login-label-row">
                <label className="admin-form-label" htmlFor="password">
                  {t('admin.login.password')}
                </label>
                {capsLock && (
                  <span className="admin-login-caps" role="status">
                    {t('admin.login.capsLock')}
                  </span>
                )}
              </div>
              <div className="admin-login-field">
                <input
                  id="password"
                  ref={passwordRef}
                  type={revealed ? 'text' : 'password'}
                  className="admin-form-input admin-form-input--with-reveal"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    clearError()
                  }}
                  onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="admin-login-reveal"
                  onClick={() => setRevealed(r => !r)}
                  tabIndex={-1}
                  aria-label={revealLabel}
                  title={revealLabel}
                >
                  {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="admin-login-btn"
              disabled={loading || locked || !username || !password}
            >
              {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {loading ? t('admin.login.signingIn') : t('admin.login.signIn')}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  )
}
