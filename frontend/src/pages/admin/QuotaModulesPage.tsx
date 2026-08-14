import { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Building2,
  AlertTriangle,
  Layers,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import DateRangePicker from '../../components/admin/DateRangePicker'
import MetricChart from '../../components/admin/MetricChart'
import KPICard from '../../components/admin/KPICard'
import PageHeader from '../../components/admin/ui/PageHeader'
import Card from '../../components/admin/ui/Card'
import Tabs from '../../components/admin/ui/Tabs'
import Switch from '../../components/admin/ui/Switch'
import EmptyState from '../../components/admin/ui/EmptyState'
import {
  fetchQuotaOverview,
  toggleTenantModule,
  type TenantQuotaOverviewRow,
  type ModuleCatalogEntry,
} from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const quotaTier = (pct: number) => (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '')

/** Documents left before the next scan is refused — both pools, since consume_document
 *  falls through from the allowance to the balance. */
function remainingDocs(row: TenantQuotaOverviewRow): number {
  const sub = row.subscription
  const left = sub ? Math.max(0, sub.allowance - sub.used) : 0
  return left + row.credit_balance
}

/** Below this, the tenant is about to be blocked and someone should know. */
const NEAR_LIMIT_DOCS = 5

function getTabs(t: ReturnType<typeof useT>['t']) {
  return [
    { id: 'overview', label: t('admin.quotas.tab.overview') },
    { id: 'details', label: t('admin.quotas.tab.details') },
  ]
}

export default function QuotaModulesPage() {
  const { t } = useT()
  const [tab, setTab] = useState<'overview' | 'details'>('overview')
  const [activeOnly, setActiveOnly] = useState(true)
  const [from, setFrom] = useState(monthStartStr)
  const [to, setTo] = useState(todayStr)
  const [rows, setRows] = useState<TenantQuotaOverviewRow[]>([])
  const [modulesCatalog, setModulesCatalog] = useState<ModuleCatalogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetchQuotaOverview({ active_only: activeOnly, from, to })
      .then(r => {
        setRows(r.data ?? [])
        setModulesCatalog(r.modules ?? [])
      })
      .catch(e =>
        toast.error(t('admin.quotas.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [activeOnly, from, to])

  const toggleRow = (id: string) => setExpandedId(prev => (prev === id ? null : id))

  const handleToggleModule = async (tenantId: string, moduleId: string, enabled: boolean) => {
    try {
      await toggleTenantModule(tenantId, moduleId, enabled)
      toast.success(
        enabled ? t('admin.quotas.toast.moduleEnabled') : t('admin.quotas.toast.moduleDisabled')
      )
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // ── Overview-tab stats, derived client-side from the same fetch as the table ──
  const tenantsCount = rows.length
  // Documents left, not percent-of-plan: a tenant at 95% of a 100-doc plan with 500
  // credits behind it is not near anything, and one with 3 credits and no plan is.
  const nearLimitCount = rows.filter(r => remainingDocs(r) <= NEAR_LIMIT_DOCS).length
  // Under opt-out, "modules enabled" summed across tenants is meaningless (everyone has
  // everything). The signal that matters is how many tenants have a module turned off.
  const modulesRestrictedCount = rows.filter(r => r.modules_disabled.length > 0).length
  const moduleUsageChart = modulesCatalog.map(m => ({
    module: m.display_name,
    // scans, not blended calls — matches the Usage column and the page framing.
    scans: rows.reduce(
      (sum, r) => sum + (r.usage_by_module.find(u => u.module_id === m.id)?.scans ?? 0),
      0
    ),
  }))

  const columns: Column<TenantQuotaOverviewRow>[] = [
    {
      key: '_expand',
      label: '',
      render: r => (
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={expandedId === r.id ? t('admin.quotas.collapse') : t('admin.quotas.expand')}
          aria-expanded={expandedId === r.id}
          onClick={() => toggleRow(r.id)}
        >
          {expandedId === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    {
      key: 'host',
      label: t('admin.quotas.col.tenant'),
      sortable: true,
      render: r => (
        <div>
          <div>{r.name || r.host}</div>
          <div className="admin-sub-text">{r.bu_code}</div>
        </div>
      ),
    },
    {
      key: 'quotas',
      label: t('admin.quotas.col.quota'),
      render: r => {
        const sub = r.subscription
        const credits = r.credit_balance

        // No plan: credits are what every scan is charged to. A balance has no
        // denominator, so there is no bar to draw — the number is the whole story.
        if (!sub) {
          if (credits === 0) {
            return <span className="admin-sub-text">{t('admin.quotas.noQuota')}</span>
          }
          return (
            <div className="tenant-quota quota-cell">
              <span className="admin-mono" title={t('admin.quotas.quotaHint')}>
                {t('admin.quotas.credits', { count: credits })}
              </span>
              <span className="admin-sub-text">{t('admin.quotas.bucket.credit')}</span>
            </div>
          )
        }

        // With a plan, the allowance is the pool being charged and the balance behind it
        // is the reserve — shown small so the headline bar never looks "stuck".
        const pct = sub.allowance > 0 ? Math.round((sub.used / sub.allowance) * 100) : 0
        return (
          <div className="tenant-quota quota-cell">
            <div className="tenant-quota-label">
              <span className="admin-mono" title={t('admin.quotas.quotaHint')}>
                {sub.used} / {sub.allowance}
              </span>
              <span className="admin-sub-text">{pct}%</span>
            </div>
            <div className="tenant-quota-bar">
              <div
                className={`tenant-quota-fill ${quotaTier(pct)}`.trim()}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="admin-sub-text">{t('admin.quotas.bucket.subscription')}</span>
            {credits > 0 && (
              <span className="admin-sub-text">
                {t('admin.quotas.reserve', {
                  items: t('admin.quotas.credits', { count: credits }),
                })}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'modules_enabled',
      label: t('admin.quotas.col.modules'),
      // Everything is available by default, so the useful signal is the exceptions —
      // which modules an admin has turned OFF. "All enabled" is the normal state.
      render: r =>
        r.modules_disabled.length === 0 ? (
          <span className="admin-sub-text">{t('admin.quotas.allEnabled')}</span>
        ) : (
          <div className="tenant-chips">
            {r.modules_disabled.map(id => (
              <span key={id} className="tenant-chip danger">
                {t('admin.quotas.moduleOff', {
                  name: modulesCatalog.find(m => m.id === id)?.display_name ?? id,
                })}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'usage_by_module',
      label: t('admin.quotas.col.usagePeriod'),
      align: 'right',
      render: r => {
        if (r.usage_by_module.length === 0) return <span className="admin-sub-text">—</span>
        // Headline is scans (extracts), the number that lines up with quota — not the
        // blended call count, which double-counts because a suggestion rides along with
        // every document. Suggestions shown quietly beside it.
        const scans = r.usage_by_module.reduce((sum, u) => sum + u.scans, 0)
        const suggestions = r.usage_by_module.reduce((sum, u) => sum + u.suggestions, 0)
        return (
          <span className="quota-usage-cell">
            <span className="admin-mono">{t('admin.quotas.scans', { count: scans })}</span>
            {suggestions > 0 && (
              <span className="admin-sub-text">
                {t('admin.quotas.suggestions', { count: suggestions })}
              </span>
            )}
          </span>
        )
      },
    },
  ]

  const renderExpandedRow = (row: TenantQuotaOverviewRow) => (
    <div className="tenant-detail">
      <section className="tenant-detail-section">
        <h4>{t('admin.quotas.detail.usageByModule')}</h4>
        {row.usage_by_module.length === 0 ? (
          <span className="admin-sub-text">{t('admin.quotas.detail.noUsage')}</span>
        ) : (
          <div className="quota-manage-list">
            {row.usage_by_module.map(u => (
              <div key={u.module_id} className="quota-manage-row">
                <span className="admin-sub-text quota-manage-meta">{u.display_name}</span>
                <span className="admin-mono">{t('admin.quotas.scans', { count: u.scans })}</span>
                <span className="admin-mono admin-sub-text">
                  {t('admin.quotas.suggestions', { count: u.suggestions })}
                </span>
                <span className="admin-mono admin-sub-text">
                  {t('admin.quotas.detail.tokens', { count: u.tokens.toLocaleString() })}
                </span>
                <span className="admin-mono admin-sub-text">${u.cost_usd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tenant-detail-section">
        <h4>{t('admin.quotas.detail.modules')}</h4>
        <div className="module-toggle-list">
          {modulesCatalog.map(m => {
            // Opt-out: a module is ON unless explicitly disabled. No row = ON, matching
            // the extract-time gate — otherwise the switch would read OFF for tenants
            // who can actually scan.
            const enabled = !row.modules_disabled.includes(m.id)
            return (
              <Switch
                key={m.id}
                checked={enabled}
                onChange={v => handleToggleModule(row.id, m.id, v)}
                label={m.display_name}
              />
            )
          })}
        </div>
      </section>
    </div>
  )

  const filters = (
    <>
      <label className="admin-checkbox-label">
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={e => setActiveOnly(e.target.checked)}
        />
        {t('admin.quotas.activeOnly')}
      </label>
      <DateRangePicker
        from={from}
        to={to}
        onChange={(f, newTo) => {
          setFrom(f)
          setTo(newTo)
        }}
      />
    </>
  )

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.quotas.title')}
        description={t('admin.quotas.description')}
        actions={filters}
      />

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={<Building2 size={22} strokeWidth={1.75} />}
          title={t('admin.quotas.emptyTitle')}
          description={t('admin.quotas.emptyDescription')}
        />
      ) : (
        <>
          <Tabs
            tabs={getTabs(t)}
            active={tab}
            onChange={id => setTab(id as 'overview' | 'details')}
          />

          {tab === 'overview' ? (
            <>
              <div className="kpi-grid">
                <KPICard
                  label={t('admin.quotas.kpi.tenants')}
                  value={tenantsCount}
                  icon={<Building2 size={18} strokeWidth={2} />}
                  loading={loading}
                />
                <KPICard
                  label={t('admin.quotas.kpi.nearLimit')}
                  value={nearLimitCount}
                  accent={nearLimitCount > 0 ? 'yellow' : 'green'}
                  icon={<AlertTriangle size={18} strokeWidth={2} />}
                  loading={loading}
                />
                <KPICard
                  label={t('admin.quotas.kpi.modulesRestricted')}
                  value={modulesRestrictedCount}
                  accent={modulesRestrictedCount > 0 ? 'yellow' : 'default'}
                  icon={<Layers size={18} strokeWidth={2} />}
                  loading={loading}
                />
              </div>

              <Card
                title={t('admin.quotas.chart.scansByModule')}
                icon={<BarChart3 size={16} strokeWidth={2} />}
              >
                <MetricChart
                  type="bar"
                  data={moduleUsageChart}
                  xKey="module"
                  series={[
                    { key: 'scans', label: t('admin.quotas.series.scans'), color: '#6366f1' },
                  ]}
                  loading={loading}
                />
              </Card>
            </>
          ) : (
            <Card>
              <DataTable
                columns={columns}
                rows={rows}
                loading={loading}
                emptyText={t('admin.quotas.empty')}
                expandedRowId={expandedId}
                renderExpandedRow={renderExpandedRow}
              />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
