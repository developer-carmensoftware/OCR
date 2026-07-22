import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchPerformanceLogs } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'
import { fmtDateTime } from '../../lib/dates'

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
      key: 'tenant_id',
      label: t('admin.performance.col.tenant'),
      sortable: true,
      render: r => r.tenant_name ?? r.tenant_id,
    },
  ]
}

export default function PerformancePage() {
  const { t } = useT()
  const [tenantId, setTenantId] = useState('')
  const [minMsInput, setMinMsInput] = useState('')
  const [minMs, setMinMs] = useState('')
  const [rows, setRows] = useState<PerfRow[]>([])
  const [loading, setLoading] = useState(false)

  // Debounce the free-text filter — without this, typing "1500" fired 4 separate
  // full requests, one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setMinMs(minMsInput), 300)
    return () => clearTimeout(id)
  }, [minMsInput])

  useEffect(() => {
    setLoading(true)
    fetchPerformanceLogs({
      tenant_id: tenantId || undefined,
      min_duration_ms: minMs ? Number(minMs) : undefined,
      limit: 300,
    })
      .then(r => setRows(r.data ?? []))
      .catch(e =>
        toast.error(
          t('admin.performance.toast.loadFailed', { error: e?.message ?? 'failed to load' })
        )
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, minMs])

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
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={getCols(t)}
          rows={rows}
          loading={loading}
          emptyText={t('admin.performance.empty')}
        />
      </div>
    </div>
  )
}
