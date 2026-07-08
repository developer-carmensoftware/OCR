import type { ReactNode } from 'react'
import {
  AlertCircle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Coins,
  Gauge,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import DarkModeToggle from '../../components/common/DarkModeToggle'
import LanguageToggle from '../../components/common/LanguageToggle'

interface NavItem {
  label: string
  hash: string
  icon: ReactNode
}

interface NavSection {
  label: string
  items: NavItem[]
}

const ICON_SIZE = 17

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Overview',
        hash: '/admin',
        icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={2} />,
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        label: 'Usage',
        hash: '/admin/usage',
        icon: <BarChart3 size={ICON_SIZE} strokeWidth={2} />,
      },
      {
        label: 'LLM Logs',
        hash: '/admin/llm-logs',
        icon: <Bot size={ICON_SIZE} strokeWidth={2} />,
      },
      {
        label: 'Tenant Ranking',
        hash: '/admin/tenant-ranking',
        icon: <Trophy size={ICON_SIZE} strokeWidth={2} />,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Sessions',
        hash: '/admin/sessions',
        icon: <Users size={ICON_SIZE} strokeWidth={2} />,
      },
      { label: 'Jobs', hash: '/admin/jobs', icon: <Settings size={ICON_SIZE} strokeWidth={2} /> },
      {
        label: 'Performance',
        hash: '/admin/performance',
        icon: <Zap size={ICON_SIZE} strokeWidth={2} />,
      },
      {
        label: 'Errors',
        hash: '/admin/errors',
        icon: <AlertCircle size={ICON_SIZE} strokeWidth={2} />,
      },
      {
        label: 'Anomalies',
        hash: '/admin/anomalies',
        icon: <Bell size={ICON_SIZE} strokeWidth={2} />,
      },
    ],
  },
  {
    label: 'Billing',
    items: [
      {
        label: 'Credits',
        hash: '/admin/credits',
        icon: <Coins size={ICON_SIZE} strokeWidth={2} />,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        label: 'Tenants',
        hash: '/admin/tenants',
        icon: <Building2 size={ICON_SIZE} strokeWidth={2} />,
      },
      {
        label: 'Quota & Modules',
        hash: '/admin/quota-modules',
        icon: <Gauge size={ICON_SIZE} strokeWidth={2} />,
      },
    ],
  },
]

function getActiveHash(): string {
  return window.location.hash.split('?')[0].replace(/^#\/?/, '')
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, logout } = useAdminAuth()
  const active = getActiveHash()

  const handleLogout = async () => {
    await logout()
    window.location.hash = '/admin/login'
  }

  return (
    <div className="admin-shell">
      <a href="#admin-main-content" className="admin-skip-link">
        Skip to main content
      </a>

      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-logo">
          <span className="admin-logo-icon" aria-hidden="true">
            <Shield size={20} strokeWidth={2.25} />
          </span>
          <span className="admin-logo-text">Admin</span>
        </div>

        <nav className="admin-nav">
          {NAV_SECTIONS.map(section => (
            <div className="admin-nav-section" key={section.label}>
              <div className="admin-nav-section-label">{section.label}</div>
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
                    <span>{item.label}</span>
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
            <span className="admin-user-email" title={admin?.email}>
              {admin?.email}
            </span>
            <span className="admin-user-role">{admin?.roles?.[0] ?? 'admin'}</span>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleLogout}
            aria-label="Logout"
            title="Logout"
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
