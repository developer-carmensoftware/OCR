import type { ReactNode } from 'react'
import { LogOut, Shield } from 'lucide-react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import DarkModeToggle from '../../components/common/DarkModeToggle'
import LanguageToggle from '../../components/common/LanguageToggle'
import { useT } from '../../i18n/LanguageContext'
// One list, two readers: the sidebar below and the route map in AdminRouter.
import { NAV_SECTIONS } from './routes'

function getActiveHash(): string {
  return window.location.hash.split('?')[0].replace(/^#\/?/, '')
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAdminAuth()
  const { t } = useT()
  const active = getActiveHash()

  const handleLogout = async () => {
    await logout()
    window.location.hash = '/admin/login'
  }

  return (
    <div className="admin-shell">
      <a href="#admin-main-content" className="admin-skip-link">
        {t('admin.chrome.skipLink')}
      </a>

      <aside className="admin-sidebar" aria-label={t('admin.chrome.navAria')}>
        <div className="admin-logo">
          <span className="admin-logo-icon" aria-hidden="true">
            <Shield size={20} strokeWidth={2.25} />
          </span>
          <span className="admin-logo-text">Admin</span>
        </div>

        <nav className="admin-nav">
          {NAV_SECTIONS.map(section => (
            <div className="admin-nav-section" key={section.labelKey}>
              <div className="admin-nav-section-label">{t(section.labelKey)}</div>
              {section.items.map(item => {
                const itemPath = item.hash.replace(/^\//, '')
                const isActive =
                  itemPath === 'admin' ? active === 'admin' : active.startsWith(itemPath)
                return (
                  <a
                    key={item.hash}
                    href={`#${item.hash}`}
                    className={`admin-nav-item${isActive ? ' active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="admin-nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{t(item.labelKey)}</span>
                  </a>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-toggles">
            <LanguageToggle />
            <DarkModeToggle />
          </div>
          <div className="admin-user-info">
            <span className="admin-user-email" title={admin?.username}>
              {admin?.username}
            </span>
            <span className="admin-user-role">
              {admin?.roles?.[0] ?? t('admin.chrome.roleFallback')}
            </span>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleLogout}
            aria-label={t('admin.chrome.logout')}
            title={t('admin.chrome.logout')}
          >
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </aside>

      <main id="admin-main-content" className="admin-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
