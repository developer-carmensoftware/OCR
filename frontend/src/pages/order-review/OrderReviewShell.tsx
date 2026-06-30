import { LogOut } from 'lucide-react'
import logo from '../../assets/logo.png'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useT } from '../../i18n/LanguageContext'
import DarkModeToggle from '../../components/common/DarkModeToggle'
import LanguageToggle from '../../components/common/LanguageToggle'
import CreditOrdersPage from '../admin/CreditOrdersPage'

/**
 * Standalone shell for the Order Review console — its own page, separate from the
 * admin dashboard (no admin sidebar). Reuses the admin auth/session: the backend
 * endpoints require admin `quotas` permission, so a reviewer signs in at the
 * shared admin login and is returned here.
 */
export default function OrderReviewShell() {
  const { admin, logout } = useAdminAuth()
  const { t } = useT()

  const handleLogout = async () => {
    await logout()
    window.location.hash = '/admin/login'
  }

  return (
    <div className="orev-app">
      <header className="orev-app-header">
        <div className="orev-app-brand">
          <span className="orev-app-logo" aria-hidden="true">
            <img src={logo} alt="" className="orev-app-logo-img" />
          </span>
          <span className="orev-app-title">{t('orev.title')}</span>
        </div>
        <div className="orev-app-user">
          <LanguageToggle />
          <DarkModeToggle />
          <span className="orev-app-email" title={admin?.email}>
            {admin?.email}
          </span>
          <button
            type="button"
            className="orev-app-logout"
            onClick={handleLogout}
            aria-label={t('orev.logout')}
            title={t('orev.logout')}
          >
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </header>
      <main className="orev-app-main">
        <CreditOrdersPage />
      </main>
    </div>
  )
}
