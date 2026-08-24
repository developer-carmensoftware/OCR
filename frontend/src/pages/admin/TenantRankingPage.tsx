import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import PeriodPicker, { lastDays, periodHours } from '../../components/admin/PeriodPicker'
import { fetchTenantRanking } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

type Metric = 'cost' | 'error_rate' | 'latency' | 'volume'

interface RankRow {
  tenant_id: string
  tenant_name: string
  total_calls?: number
  total_cost_usd?: number
  total_tokens?: number
  total_requests?: number
  errors?: number
  error_rate_pct?: number
  avg_latency_ms?: number
  max_latency_ms?: number
}

function getColsCost(t: ReturnType<typeof useT>['t']): Column<RankRow>[] {
  return [
    { key: 'tenant_name', label: t('admin.tenantRanking.col.tenant'), sortable: true },
    {
      key: 'total_calls',
      label: t('admin.tenantRanking.col.calls'),
      sortable: true,
      align: 'right',
    },
    {
      key: 'total_tokens',
      label: t('admin.tenantRanking.col.tokens'),
      sortable: true,
      align: 'right',
    },
    {
      key: 'total_cost_usd',
      label: t('admin.tenantRanking.col.cost'),
      sortable: true,
      align: 'right',
      render: r => `$${Number(r.total_cost_usd ?? 0).toFixed(4)}`,
    },
  ]
}

function getColsPerf(t: ReturnType<typeof useT>['t']): Column<RankRow>[] {
  return [
    { key: 'tenant_name', label: t('admin.tenantRanking.col.tenant'), sortable: true },
    {
      key: 'total_requests',
      label: t('admin.tenantRanking.col.requests'),
      sortable: true,
      align: 'right',
    },
    { key: 'errors', label: t('admin.tenantRanking.col.errors'), sortable: true, align: 'right' },
    {
      key: 'error_rate_pct',
      label: t('admin.tenantRanking.col.errorPct'),
      sortable: true,
      align: 'right',
      render: r => `${r.error_rate_pct ?? 0}%`,
    },
    {
      key: 'avg_latency_ms',
      label: t('admin.tenantRanking.col.avgLatency'),
      sortable: true,
      align: 'right',
    },
  ]
}

export default function TenantRankingPage() {
  const { t } = useT()
  const [metric, setMetric] = useState<Metric>('cost')
  // 30 days used to be the ceiling here, in the API as well as the dropdown.
  const [period, setPeriod] = useState(() => lastDays(30))
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<RankRow[]>([])
  const [loading, setLoading] = useState(true)
  const hours = periodHours(period)

  useEffect(() => {
    setLoading(true)
    // The endpoint's own maximum. It defaulted to 20, so a ranking of "every tenant"
    // silently stopped at the twentieth with nothing saying so.
    fetchTenantRanking({ metric, period_hours: hours, limit: 100 })
      .then(r => setRows(r.data ?? []))
      .catch(e =>
        toast.error(
          t('admin.tenantRanking.toast.loadFailed', { error: e?.message ?? 'failed to load' })
        )
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, hours])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.tenantRanking.title')}</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label={t('admin.tenantRanking.metricAria')}
            value={metric}
            onChange={e => setMetric(e.target.value as Metric)}
          >
            <option value="cost">{t('admin.tenantRanking.metric.cost')}</option>
            <option value="error_rate">{t('admin.tenantRanking.metric.errorRate')}</option>
            <option value="latency">{t('admin.tenantRanking.metric.latency')}</option>
            <option value="volume">{t('admin.tenantRanking.metric.volume')}</option>
          </select>
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={metric === 'cost' ? getColsCost(t) : getColsPerf(t)}
          rows={rows}
          loading={loading}
          emptyText={t('admin.tenantRanking.empty')}
          search={{
            value: search,
            onChange: setSearch,
            placeholder: t('admin.tenantRanking.searchPlaceholder'),
          }}
        />
      </div>
    </div>
  )
}
