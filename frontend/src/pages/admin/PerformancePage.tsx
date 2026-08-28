import { useEffect, useState } from 'react'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import PeriodPicker, { daysAgo, endOfDay, today } from '../../components/admin/PeriodPicker'
import { fetchPerformanceLogs } from '../../lib/api/adminClient'
import { useTableQuery } from '../../hooks/admin/useTableQuery'
import { useTableData } from '../../hooks/admin/useTableData'
import { useT } from '../../i18n/LanguageContext'
import { fmtDateTime } from '../../lib/date'

interface PerfRow {
  id: string
  tenant_id: string
  tenant_name?: string | null
  endpoint: string
  method: string
  duration_ms: number
  status_code: number
  carmen_user_id: string
  created_at: string
}

function getCols(t: ReturnType<typeof useT>['t']): Column<PerfRow>[] {
  return [
    {
      key: 'created_at',
      label: t('admin.performance.col.time'),
      sortable: true,
      defaultDesc: true,
      render: r => fmtDateTime(r.created_at),
    },
    { key: 'method', label: t('admin.performance.col.method'), sortable: true },
    { key: 'endpoint', label: t('admin.performance.col.endpoint'), sortable: true },
    {
      key: 'status_code',
      label: t('admin.performance.col.status'),
      sortable: true,
      render: r => (
        <span
          className={`status-badge ${r.status_code >= 500 ? 'error' : r.status_code >= 400 ? 'warn' : 'ok'}`}
        >
          {r.status_code}
        </span>
      ),
    },
    {
      key: 'duration_ms',
      label: t('admin.performance.col.duration'),
      sortable: true,
      align: 'right',
      render: r => (
        <span
          className={r.duration_ms > 3000 ? 'text-red' : r.duration_ms > 1000 ? 'text-yellow' : ''}
        >
          {r.duration_ms}ms
        </span>
      ),
    },
    {
      // Displays the name; not sortable. See LLMLogsPage for why — the name is not a
      // column on this partitioned log table, and the tenant dropdown covers the need.
      key: 'tenant_name',
      label: t('admin.performance.col.tenant'),
      render: r => r.tenant_name ?? r.tenant_id,
    },
  ]
}

export default function PerformancePage() {
  const { params, set, server } = useTableQuery({
    defaultSort: 'created_at',
    filters: { tenant_id: '', min_duration_ms: '', from: daysAgo(7), to: today() },
  })
  const { t } = useT()
  const [minMsInput, setMinMsInput] = useState(params.min_duration_ms)

  // Debounce the free-text filter — without this, typing "1500" fired 4 separate
  // full requests, one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => set({ min_duration_ms: minMsInput }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minMsInput])

  const { rows, total, loading } = useTableData<PerfRow>(
    () =>
      fetchPerformanceLogs({
        tenant_id: params.tenant_id || undefined,
        min_duration_ms: params.min_duration_ms ? Number(params.min_duration_ms) : undefined,
        from: params.from,
        to: endOfDay(params.to),
        q: params.q || undefined,
        sort: params.sort,
        dir: params.dir,
        limit: params.limit,
        offset: params.offset,
      }),
    [params],
    'admin.performance.toast.loadFailed'
  )

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.performance.title')}</h2>
        <div className="admin-page-controls">
          <input
            type="number"
            className="admin-form-input"
            aria-label={t('admin.performance.minDurationAria')}
            placeholder={t('admin.performance.minDurationPlaceholder')}
            value={minMsInput}
            onChange={e => setMinMsInput(e.target.value)}
            style={{ width: 160 }}
          />
          <PeriodPicker
            value={{ from: params.from, to: params.to }}
            onChange={p => set({ from: p.from, to: p.to })}
          />
          <TenantSelector value={params.tenant_id} onChange={v => set({ tenant_id: v })} />
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={getCols(t)}
          rows={rows}
          loading={loading}
          emptyText={t('admin.performance.empty')}
          server={server(total)}
          search={{
            value: params.q,
            onChange: q => set({ q }),
            placeholder: t('admin.performance.searchPlaceholder'),
          }}
        />
      </div>
    </div>
  )
}
