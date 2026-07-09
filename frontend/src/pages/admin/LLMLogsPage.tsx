import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchLLMLogs } from '../../lib/api/adminClient'

interface LogRow {
  id: string
  tenant_id: string
  module_id: string
  model: string
  task_id: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  duration_ms: number | null
  cost_usd: number | null
  created_at: string
}

const COLS: Column<LogRow>[] = [
  {
    key: 'created_at',
    label: 'Time',
    sortable: true,
    render: r => r.created_at?.slice(0, 19).replace('T', ' ') ?? '—',
  },
  { key: 'tenant_id', label: 'Tenant', sortable: true },
  { key: 'module_id', label: 'Module', sortable: true },
  { key: 'model', label: 'Model', sortable: true },
  { key: 'total_tokens', label: 'Tokens', sortable: true, align: 'right' },
  {
    key: 'duration_ms',
    label: 'Duration (ms)',
    sortable: true,
    align: 'right',
    render: r => (r.duration_ms != null ? `${r.duration_ms}ms` : '—'),
  },
  {
    key: 'cost_usd',
    label: 'Cost (USD)',
    sortable: true,
    align: 'right',
    render: r => (r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(6)}` : '—'),
  },
  {
    key: 'task_id',
    label: 'Task ID',
    render: r => <span className="admin-mono">{r.task_id ?? '—'}</span>,
  },
]

type OrderBy = 'created_at' | 'cost_usd' | 'duration_ms' | 'total_tokens'

export default function LLMLogsPage() {
  const [tenantId, setTenantId] = useState('')
  const [orderBy, setOrderBy] = useState<OrderBy>('created_at')
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchLLMLogs({ tenant_id: tenantId || undefined, order_by: orderBy, limit: 200 })
      .then(r => setRows(r.data ?? []))
      .catch(e => toast.error(`LLM logs: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }, [tenantId, orderBy])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">LLM Logs</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label="Sort order"
            value={orderBy}
            onChange={e => setOrderBy(e.target.value as OrderBy)}
          >
            <option value="created_at">Newest first</option>
            <option value="cost_usd">Highest cost</option>
            <option value="duration_ms">Slowest</option>
            <option value="total_tokens">Most tokens</option>
          </select>
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>
      <div className="admin-card">
        <DataTable columns={COLS} rows={rows} loading={loading} emptyText="No LLM logs found" />
      </div>
    </div>
  )
}
