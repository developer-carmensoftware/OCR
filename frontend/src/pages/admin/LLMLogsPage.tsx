import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchLLMLogs } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'
import { fmtDateTime } from '../../lib/date'

interface LogRow {
  id: string
  tenant_id: string
  tenant_name?: string | null
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

function getCols(t: ReturnType<typeof useT>['t']): Column<LogRow>[] {
  return [
    {
      key: 'created_at',
      label: t('admin.llmLogs.col.time'),
      sortable: true,
      render: r => fmtDateTime(r.created_at),
    },
    {
      key: 'tenant_id',
      label: t('admin.llmLogs.col.tenant'),
      sortable: true,
      render: r => r.tenant_name ?? r.tenant_id,
    },
    { key: 'module_id', label: t('admin.llmLogs.col.module'), sortable: true },
    { key: 'model', label: t('admin.llmLogs.col.model'), sortable: true },
    { key: 'total_tokens', label: t('admin.llmLogs.col.tokens'), sortable: true, align: 'right' },
    {
      key: 'duration_ms',
      label: t('admin.llmLogs.col.duration'),
      sortable: true,
      align: 'right',
      render: r => (r.duration_ms != null ? `${r.duration_ms}ms` : '—'),
    },
    {
      key: 'cost_usd',
      label: t('admin.llmLogs.col.cost'),
      sortable: true,
      align: 'right',
      render: r => (r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(6)}` : '—'),
    },
    {
      key: 'task_id',
      label: t('admin.llmLogs.col.taskId'),
      render: r => <span className="admin-mono">{r.task_id ?? '—'}</span>,
    },
  ]
}

type OrderBy = 'created_at' | 'cost_usd' | 'duration_ms' | 'total_tokens'

const LOGS_LIMIT = 200

export default function LLMLogsPage() {
  const { t } = useT()
  const [tenantId, setTenantId] = useState('')
  const [orderBy, setOrderBy] = useState<OrderBy>('created_at')
  const [rows, setRows] = useState<LogRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchLLMLogs({ tenant_id: tenantId || undefined, order_by: orderBy, limit: LOGS_LIMIT })
      .then(r => {
        setRows(r.data ?? [])
        setHasMore(Boolean(r.has_more))
      })
      .catch(e =>
        toast.error(t('admin.llmLogs.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, orderBy])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.llmLogs.title')}</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label={t('admin.llmLogs.sortAria')}
            value={orderBy}
            onChange={e => setOrderBy(e.target.value as OrderBy)}
          >
            <option value="created_at">{t('admin.llmLogs.sort.newest')}</option>
            <option value="cost_usd">{t('admin.llmLogs.sort.highestCost')}</option>
            <option value="duration_ms">{t('admin.llmLogs.sort.slowest')}</option>
            <option value="total_tokens">{t('admin.llmLogs.sort.mostTokens')}</option>
          </select>
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={getCols(t)}
          rows={rows}
          loading={loading}
          emptyText={t('admin.llmLogs.empty')}
        />
      </div>
      {hasMore && (
        <p className="admin-sub-text admin-truncation-note">
          {t('admin.llmLogs.truncationNote', { limit: LOGS_LIMIT })}
        </p>
      )}
    </div>
  )
}
