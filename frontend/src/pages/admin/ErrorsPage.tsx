import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import MetricChart from '../../components/admin/MetricChart'
import TenantSelector from '../../components/admin/TenantSelector'
import PeriodPicker, { lastDays, periodHours } from '../../components/admin/PeriodPicker'
import { fetchErrorBreakdown } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

type GroupBy = 'module' | 'tenant' | 'endpoint'

interface ErrorRow {
  group: string
  group_label?: string | null
  total_tasks?: number
  total_requests?: number
  errors: number
  error_rate_pct: number
  avg_latency_ms?: number
}

export default function ErrorsPage() {
  const { t } = useT()
  const [groupBy, setGroupBy] = useState<GroupBy>('module')
  // The old dropdown stopped at 7 days — narrower even than the 30 the API allowed, and
  // both are now a year. "Has this module ever failed?" was unanswerable here.
  const [period, setPeriod] = useState(() => lastDays(7))
  const [tenantId, setTenantId] = useState('')
  const [rows, setRows] = useState<ErrorRow[]>([])
  const [loading, setLoading] = useState(true)
  const hours = periodHours(period)

  useEffect(() => {
    setLoading(true)
    fetchErrorBreakdown({
      group_by: groupBy,
      period_hours: hours,
      tenant_id: tenantId || undefined,
    })
      .then(r => setRows(r.data ?? []))
      .catch(e =>
        toast.error(t('admin.errors.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, hours, tenantId])

  // Was a hand-rolled <table> with no sorting at all — on the page whose whole job is
  // "which module is failing", the one thing you could not do was order by error rate.
  const columns: Column<ErrorRow>[] = [
    {
      key: 'group',
      label: t('admin.errors.col.group'),
      sortable: true,
      render: r => r.group_label ?? r.group ?? '—',
    },
    {
      key: 'total_tasks',
      label: t('admin.errors.col.total'),
      sortable: true,
      align: 'right',
      render: r => String(r.total_tasks ?? r.total_requests ?? 0),
    },
    {
      key: 'errors',
      label: t('admin.errors.col.errors'),
      sortable: true,
      align: 'right',
      render: r => <span className={r.errors > 0 ? 'text-red' : ''}>{r.errors}</span>,
    },
    {
      key: 'error_rate_pct',
      label: t('admin.errors.col.errorPct'),
      sortable: true,
      align: 'right',
      render: r => (
        <span
          className={r.error_rate_pct > 5 ? 'text-red' : r.error_rate_pct > 1 ? 'text-yellow' : ''}
        >
          {r.error_rate_pct}%
        </span>
      ),
    },
    ...(groupBy === 'module'
      ? []
      : [
          {
            key: 'avg_latency_ms',
            label: t('admin.errors.col.avgLatency'),
            sortable: true,
            align: 'right' as const,
            render: (r: ErrorRow) => (r.avg_latency_ms != null ? `${r.avg_latency_ms}ms` : '—'),
          },
        ]),
  ]

  const chartData = rows.map(r => ({
    group: r.group_label ?? r.group ?? '—',
    errors: r.errors,
    total: r.total_tasks ?? r.total_requests ?? 0,
  }))

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.errors.title')}</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label={t('admin.errors.groupByAria')}
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="module">{t('admin.errors.group.module')}</option>
            <option value="tenant">{t('admin.errors.group.tenant')}</option>
            <option value="endpoint">{t('admin.errors.group.endpoint')}</option>
          </select>
          <PeriodPicker value={period} onChange={setPeriod} />
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="admin-chart-card">
          <MetricChart
            type="bar"
            data={chartData}
            xKey="group"
            series={[
              { key: 'errors', label: t('admin.errors.series.errors'), color: '#f43f5e' },
              { key: 'total', label: t('admin.errors.series.total'), color: '#e5e7eb' },
            ]}
          />
        </div>
      )}

      <div className="admin-card">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={t('admin.errors.empty')}
        />
      </div>
    </div>
  )
}
