import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import PeriodPicker, { daysAgo, endOfDay, today } from '../../components/admin/PeriodPicker'
import { fetchLLMLogs } from '../../lib/api/adminClient'
import { useTableQuery } from '../../hooks/admin/useTableQuery'
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
      defaultDesc: true,
      render: r => fmtDateTime(r.created_at),
    },
    {
      // Not sortable, and not keyed on `tenant_id` any more. It used to be both: the
      // cell showed the name while the sort ordered by UUID, so "sort by tenant"
      // produced an order nobody could explain. The name lives in `tenants`, not in
      // this partitioned log table, so ordering by it would cost a join on every page
      // of a 12-month log — and the tenant dropdown above already answers "just this BU".
      key: 'tenant_name',
      label: t('admin.llmLogs.col.tenant'),
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

export default function LLMLogsPage() {
  const { t } = useT()
  // The sort `<select>` that used to sit next to the tenant filter is gone: the column
  // headers drive the same server-side order, and having both meant two controls
  // answering one question differently.
  const { params, set, server } = useTableQuery({
    defaultSort: 'created_at',
    filters: { tenant_id: '', from: daysAgo(30), to: today() },
  })
  const [rows, setRows] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchLLMLogs({
      tenant_id: params.tenant_id || undefined,
      from: params.from,
      to: endOfDay(params.to),
      q: params.q || undefined,
      sort: params.sort,
      dir: params.dir,
      limit: params.limit,
      offset: params.offset,
    })
      .then(r => {
        setRows(r.data ?? [])
        setTotal(r.total ?? 0)
      })
      .catch(e =>
        toast.error(t('admin.llmLogs.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.llmLogs.title')}</h2>
        <div className="admin-page-controls">
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
          emptyText={t('admin.llmLogs.empty')}
          server={server(total)}
          search={{
            value: params.q,
            onChange: q => set({ q }),
            placeholder: t('admin.llmLogs.searchPlaceholder'),
          }}
        />
      </div>
    </div>
  )
}
