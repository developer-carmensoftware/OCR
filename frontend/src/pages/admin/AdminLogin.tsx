import { useState } from 'react'
import { Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { adminLogin } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

export default function AdminLogin() {
  const { t } = useT()
  const { login } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await adminLogin(email, password)
      await login(res.access_token)
      const back = sessionStorage.getItem('admin_return_to')
      sessionStorage.removeItem('admin_return_to')
      window.location.hash = back || '/admin'
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('admin.login.failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <span className="admin-login-icon" aria-hidden="true">
            <Shield size={28} strokeWidth={2.25} />
          </span>
          <h1 className="admin-login-title">{t('admin.login.title')}</h1>
          <p className="admin-login-subtitle">{t('admin.login.subtitle')}</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="email">
              {t('admin.login.email')}
            </label>
            <input
              id="email"
              type="email"
              className="admin-form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="password">
              {t('admin.login.password')}
            </label>
            <input
              id="password"
              type="password"
              className="admin-form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="admin-login-btn"
            disabled={loading || !email || !password}
          >
            {loading ? t('admin.login.signingIn') : t('admin.login.signIn')}
          </button>
        </form>
      </div>
    </div>
  )
}
