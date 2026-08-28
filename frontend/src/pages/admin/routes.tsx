import { lazy, type ComponentType, type ReactNode } from 'react'
import {
  AlertCircle,
  BarChart3,
  Bell,
  Bot,
  Building2,
  ClipboardCheck,
  Coins,
  FileWarning,
  Gauge,
  LayoutDashboard,
  Mail,
  Settings,
  Trophy,
  UserCog,
  Users,
  Wrench,
  Zap,
} from 'lucide-react'
import type { TKey } from '../../i18n/dict'

/**
 * The admin dashboard's pages — sidebar entry and route, declared once.
 *
 * There used to be two hand-synced lists: this nav tree, and a 19-branch `else if`
 * chain in `main.tsx` mapping the same hashes to the same components. Adding a page
 * meant four edits and forgetting one gave you a nav link to nowhere (or a page
 * nothing linked to). They are one list now, so adding a page is: an entry here, and
 * its `admin.nav.item.*` key in **both** `en` and `th` of `i18n/dict.ts`.
 *
 * Labels are keys, not strings, so this can be plain module data — `AdminLayout`
 * translates them at render and `ADMIN_ROUTES` ignores them entirely.
 *
 * Every page is `lazy()`: this module is only reached through `AdminRouter`, which
 * `main.tsx` lazy-loads in turn, so none of it lands in the main bundle.
 */

const ICON_SIZE = 17

export interface NavItem {
  labelKey: TKey
  hash: string
  icon: ReactNode
  component: ComponentType
}

export interface NavSection {
  labelKey: TKey
  items: NavItem[]
}

export const Overview = lazy(() => import('./Overview'))

/**
 * Grouped by the question you are asking, not the table the page reads.
 *
 * The old "Analytics" and "Management" sections were named after shelves, so
 * finding the page that answers a question meant already knowing which page that
 * was. Errors (performance_logs) and Extractions (ocr_tasks) read different tables
 * and sit together, because "why isn't it working" is one question.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: 'admin.nav.section.overview',
    items: [
      {
        labelKey: 'admin.nav.item.overview',
        hash: '/admin',
        icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={2} />,
        component: Overview,
      },
      {
        labelKey: 'admin.nav.item.anomalies',
        hash: '/admin/anomalies',
        icon: <Bell size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./AnomaliesPage')),
      },
    ],
  },
  {
    labelKey: 'admin.nav.section.adoption',
    items: [
      {
        labelKey: 'admin.nav.item.tenants',
        hash: '/admin/tenants',
        icon: <Building2 size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./TenantsPage')),
      },
      {
        labelKey: 'admin.nav.item.usage',
        hash: '/admin/usage',
        icon: <BarChart3 size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./UsagePage')),
      },
      {
        labelKey: 'admin.nav.item.userUsage',
        hash: '/admin/user-usage',
        icon: <Users size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./UserUsagePage')),
      },
      {
        labelKey: 'admin.nav.item.tenantRanking',
        hash: '/admin/tenant-ranking',
        icon: <Trophy size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./TenantRankingPage')),
      },
      {
        labelKey: 'admin.nav.item.quotaModules',
        hash: '/admin/quota-modules',
        icon: <Gauge size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./QuotaModulesPage')),
      },
    ],
  },
  {
    labelKey: 'admin.nav.section.quality',
    items: [
      {
        labelKey: 'admin.nav.item.extractions',
        hash: '/admin/extractions',
        icon: <FileWarning size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./ExtractionsPage')),
      },
      {
        labelKey: 'admin.nav.item.errors',
        hash: '/admin/errors',
        icon: <AlertCircle size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./ErrorsPage')),
      },
      {
        labelKey: 'admin.nav.item.performance',
        hash: '/admin/performance',
        icon: <Zap size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./PerformancePage')),
      },
    ],
  },
  {
    labelKey: 'admin.nav.section.billing',
    items: [
      {
        labelKey: 'admin.nav.item.credits',
        hash: '/admin/credits',
        icon: <Coins size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./CreditsPage')),
      },
      {
        // Same page as the standalone #/order-review shell, mounted inside the admin
        // sidebar so it is reachable from the nav at all. #/order-review still works.
        labelKey: 'admin.nav.item.orderQueue',
        hash: '/admin/credit-orders',
        icon: <ClipboardCheck size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./CreditOrdersPage')),
      },
      {
        labelKey: 'admin.nav.item.llmLogs',
        hash: '/admin/llm-logs',
        icon: <Bot size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./LLMLogsPage')),
      },
    ],
  },
  {
    labelKey: 'admin.nav.section.operations',
    items: [
      {
        labelKey: 'admin.nav.item.sessions',
        hash: '/admin/sessions',
        icon: <Users size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./SessionsPage')),
      },
      {
        labelKey: 'admin.nav.item.jobs',
        hash: '/admin/jobs',
        icon: <Settings size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./JobsPage')),
      },
      {
        labelKey: 'admin.nav.item.email',
        hash: '/admin/email',
        icon: <Mail size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./EmailAutomationPage')),
      },
      {
        labelKey: 'admin.nav.item.maintenance',
        hash: '/admin/maintenance',
        icon: <Wrench size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./MaintenancePage')),
      },
    ],
  },
  {
    labelKey: 'admin.nav.section.accessControl',
    items: [
      {
        labelKey: 'admin.nav.item.adminUsers',
        hash: '/admin/admin-users',
        icon: <UserCog size={ICON_SIZE} strokeWidth={2} />,
        component: lazy(() => import('./AdminUsersPage')),
      },
    ],
  },
]

/**
 * Route (hash without the leading slash) → page. Derived from the nav, so a page
 * cannot have one without the other.
 */
export const ADMIN_ROUTES: Record<string, ComponentType> = Object.fromEntries(
  NAV_SECTIONS.flatMap(s => s.items.map(i => [i.hash.replace(/^\//, ''), i.component]))
)
