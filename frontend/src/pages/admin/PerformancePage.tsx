import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchPerformanceLogs } from '../../lib/api/adminClient'

interface PerfRow {
  id: string
  tenant_id: string
  endpoint: string
  method: string
  duration_ms: number
  status_code: number
  carmen_user_id: string
  created_at: string
}

const COLS: Column<PerfRow>[] = [
  {
    key: 'created_at',
    label: 'Time',
    sortable: true,
    render: r => r.created_at?.slice(0, 19).replace('T', ' ') ?? '—',
  },
  { key: 'method', label: 'Method', sortable: true },
  { key: 'endpoint', label: 'Endpoint', sortable: true },
  {
    key: 'status_code',
    label: 'Status',
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
    label: 'Duration (ms)',
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
  { key: 'tenant_id', label: 'Tenant', sortable: true },
]

export default function PerformancePage() {
  const [tenantId, setTenantId] = useState('')
  const [minMs, setMinMs] = useState('')
  const [rows, setRows] = useState<PerfRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchPerformanceLogs({
      tenant_id: tenantId || undefined,
      min_duration_ms: minMs ? Number(minMs) : undefined,
      limit: 300,
    })
      .then(r => setRows(r.data ?? []))
      .catch(e => toast.error(`Performance: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }, [tenantId, minMs])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Performance Logs</h2>
        <div className="admin-page-controls">
          <input
            type="number"
            className="admin-form-input"
            placeholder="Min ms (e.g. 1000)"
            aria-label="Minimum duration in milliseconds"
            value={minMs}
            onChange={e => setMinMs(e.target.value)}
            style={{ width: 160 }}
          />
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>
      <div className="admin-card">
        <DataTable columns={COLS} rows={rows} loading={loading} emptyText="No performance logs" />
      </div>
    </div>
  )
}
