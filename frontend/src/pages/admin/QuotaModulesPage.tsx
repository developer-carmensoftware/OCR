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
import CustomModal from '../../components/common/CustomModal'
import PageHeader from '../../components/admin/ui/PageHeader'
import Card from '../../components/admin/ui/Card'
import Tabs from '../../components/admin/ui/Tabs'
import Switch from '../../components/admin/ui/Switch'
import Button from '../../components/admin/ui/Button'
import EmptyState from '../../components/admin/ui/EmptyState'
import {
  fetchQuotaOverview,
  updateQuotaLimit,
  resetQuotaUsage,
  toggleTenantModule,
  type TenantQuotaOverviewRow,
  type ModuleCatalogEntry,
  type QuotaRow,
} from '../../lib/api/adminClient'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function monthStartStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const quotaTier = (pct: number) => (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '')

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
]

export default function QuotaModulesPage() {
  const [tab, setTab] = useState<'overview' | 'details'>('overview')
  const [activeOnly, setActiveOnly] = useState(true)
  const [from, setFrom] = useState(monthStartStr)
  const [to, setTo] = useState(todayStr)
  const [rows, setRows] = useState<TenantQuotaOverviewRow[]>([])
  const [modulesCatalog, setModulesCatalog] = useState<ModuleCatalogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [resetTarget, setResetTarget] = useState<{ tenantId: string; quotaId: string } | null>(null)

  const load = () => {
    setLoading(true)
    fetchQuotaOverview({ active_only: activeOnly, from, to })
      .then(r => {
        setRows(r.data ?? [])
        setModulesCatalog(r.modules ?? [])
      })
      .catch(e => toast.error(`Quota overview: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }

  useEffect(load, [activeOnly, from, to])

  const toggleRow = (id: string) => setExpandedId(prev => (prev === id ? null : id))

  const handleSaveLimit = async (tenantId: string, quota: QuotaRow) => {
    const raw = limitDrafts[quota.id] ?? String(quota.limit)
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Limit must be a number greater than 0')
      return
    }
    setSavingId(quota.id)
    try {
      await updateQuotaLimit(tenantId, quota.id, value)
      toast.success('Quota limit updated')
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  const handleReset = async () => {
    if (!resetTarget) return
    const { tenantId, quotaId } = resetTarget
    setResetTarget(null)
    try {
      await resetQuotaUsage(tenantId, quotaId)
      toast.success('Quota usage reset')
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleToggleModule = async (tenantId: string, moduleId: string, enabled: boolean) => {
    try {
      await toggleTenantModule(tenantId, moduleId, enabled)
      toast.success(enabled ? 'Module enabled' : 'Module disabled')
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // ── Overview-tab stats, derived client-side from the same fetch as the table ──
  const tenantsCount = rows.length
  const nearLimitCount = rows.filter(r => r.quotas.some(q => q.pct >= 80)).length
  const modulesEnabledCount = rows.reduce((sum, r) => sum + r.modules_enabled.length, 0)
  const moduleUsageChart = modulesCatalog.map(m => ({
    module: m.display_name,
    calls: rows.reduce(
      (sum, r) => sum + (r.usage_by_module.find(u => u.module_id === m.id)?.calls ?? 0),
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
          aria-label={expandedId === r.id ? 'Collapse' : 'Expand'}
          aria-expanded={expandedId === r.id}
          onClick={() => toggleRow(r.id)}
        >
          {expandedId === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    {
      key: 'host',
      label: 'Tenant',
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
      label: 'Quota',
      render: r => {
        const q = r.quotas[0]
        if (!q) return <span className="admin-sub-text">No quota</span>
        return (
          <div className="tenant-quota quota-cell">
            <div className="tenant-quota-label">
              <span className="admin-mono">
                {q.used} / {q.limit}
              </span>
              <span className="admin-sub-text">{q.pct}%</span>
            </div>
            <div className="tenant-quota-bar">
              <div
                className={`tenant-quota-fill ${quotaTier(q.pct)}`.trim()}
                style={{ width: `${Math.min(q.pct, 100)}%` }}
              />
            </div>
          </div>
        )
      },
    },
    {
      key: 'modules_enabled',
      label: 'Modules',
      render: r =>
        r.modules_enabled.length === 0 ? (
          <span className="admin-sub-text">None</span>
        ) : (
          <div className="tenant-chips">
            {r.modules_enabled.map(m => (
              <span key={m.id} className="tenant-chip">
                {m.display_name}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'usage_by_module',
      label: 'Usage (period)',
      align: 'right',
      render: r =>
        r.usage_by_module.length === 0 ? (
          <span className="admin-sub-text">—</span>
        ) : (
          <span className="admin-mono">
            {r.usage_by_module.reduce((sum, u) => sum + u.calls, 0)} calls
          </span>
        ),
    },
  ]

  const renderExpandedRow = (row: TenantQuotaOverviewRow) => (
    <div className="tenant-detail">
      <section className="tenant-detail-section">
        <h4>Usage by module (selected period)</h4>
        {row.usage_by_module.length === 0 ? (
          <span className="admin-sub-text">No usage in the selected period</span>
        ) : (
          <div className="quota-manage-list">
            {row.usage_by_module.map(u => (
              <div key={u.module_id} className="quota-manage-row">
                <span className="admin-sub-text quota-manage-meta">{u.display_name}</span>
                <span className="admin-mono">{u.calls} calls</span>
                <span className="admin-mono admin-sub-text">
                  {u.tokens.toLocaleString()} tokens
                </span>
                <span className="admin-mono admin-sub-text">${u.cost_usd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tenant-detail-section">
        <h4>Quotas</h4>
        {row.quotas.length === 0 ? (
          <span className="admin-sub-text">No quotas configured</span>
        ) : (
          <div className="quota-manage-list">
            {row.quotas.map(q => (
              <div key={q.id} className="quota-manage-row">
                <span className="admin-sub-text quota-manage-meta">
                  {q.period} · {q.metric}
                </span>
                <input
                  type="number"
                  className="admin-form-input quota-limit-input"
                  value={limitDrafts[q.id] ?? String(q.limit)}
                  onChange={e => setLimitDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                  min={1}
                  aria-label={`Quota limit for ${q.metric}`}
                />
                <Button
                  variant="outline"
                  disabled={savingId === q.id}
                  onClick={() => handleSaveLimit(row.id, q)}
                >
                  Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setResetTarget({ tenantId: row.id, quotaId: q.id })}
                >
                  Reset usage
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tenant-detail-section">
        <h4>Modules</h4>
        <div className="module-toggle-list">
          {modulesCatalog.map(m => {
            const enabled = row.modules_enabled.some(em => em.id === m.id)
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
        Active only
      </label>
      <DateRangePicker
        from={from}
        to={to}
        onChange={(f, t) => {
          setFrom(f)
          setTo(t)
        }}
      />
    </>
  )

  return (
    <div className="admin-page">
      <PageHeader
        title="Quota & Modules"
        description="See how much each tenant is spending against their quota, broken down by module, and manage limits or module access."
        actions={filters}
      />

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={<Building2 size={22} strokeWidth={1.75} />}
          title="No tenants match this filter"
          description="Try unchecking “Active only” or widening the date range."
        />
      ) : (
        <>
          <Tabs tabs={TABS} active={tab} onChange={id => setTab(id as 'overview' | 'details')} />

          {tab === 'overview' ? (
            <>
              <div className="kpi-grid">
                <KPICard
                  label="Tenants"
                  value={tenantsCount}
                  icon={<Building2 size={18} strokeWidth={2} />}
                  loading={loading}
                />
                <KPICard
                  label="Near limit"
                  value={nearLimitCount}
                  accent={nearLimitCount > 0 ? 'yellow' : 'green'}
                  icon={<AlertTriangle size={18} strokeWidth={2} />}
                  loading={loading}
                />
                <KPICard
                  label="Modules enabled"
                  value={modulesEnabledCount}
                  icon={<Layers size={18} strokeWidth={2} />}
                  loading={loading}
                />
              </div>

              <Card
                title="Calls by module (all tenants)"
                icon={<BarChart3 size={16} strokeWidth={2} />}
              >
                <MetricChart
                  type="bar"
                  data={moduleUsageChart}
                  xKey="module"
                  series={[{ key: 'calls', label: 'Calls', color: '#6366f1' }]}
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
                emptyText="No tenants found"
                expandedRowId={expandedId}
                renderExpandedRow={renderExpandedRow}
              />
            </Card>
          )}
        </>
      )}

      <CustomModal
        show={resetTarget !== null}
        title="Reset quota usage"
        message="This sets the tenant's usage counter for the current period back to zero. This cannot be undone."
        type="warning"
        confirmText="Reset usage"
        cancelText="Cancel"
        onConfirm={handleReset}
        onCancel={() => setResetTarget(null)}
      />
    </div>
  )
}
