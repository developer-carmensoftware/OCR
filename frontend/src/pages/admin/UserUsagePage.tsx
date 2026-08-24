import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import PeriodPicker, { daysAgo, endOfDay, today } from '../../components/admin/PeriodPicker'
import { fetchUserUsage } from '../../lib/api/adminClient'
import { useTableQuery } from '../../hooks/admin/useTableQuery'
import { useT } from '../../i18n/LanguageContext'

interface UserRow {
  carmen_user_id: string
  // Resolved from ocr_sessions, which is retained 90 days — older users fall back to the id.
  username: string | null
  total_calls: number
  total_tokens: number
  total_cost_usd: number
  avg_latency_ms: number | null
}

function getCols(t: ReturnType<typeof useT>['t']): Column<UserRow>[] {
  return [
    {
      // Not sortable: the name is looked up from ocr_sessions after the aggregate runs,
      // so ordering by it could only ever order the page against itself.
      key: 'username',
      label: t('admin.userUsage.col.user'),
      render: r => (
        <div>
          <div>{r.username ?? '—'}</div>
          <div className="admin-sub-text admin-mono">{r.carmen_user_id}</div>
        </div>
      ),
    },
    { key: 'total_calls', label: t('admin.userUsage.col.calls'), sortable: true, align: 'right' },
    { key: 'total_tokens', label: t('admin.userUsage.col.tokens'), sortable: true, align: 'right' },
    {
      key: 'total_cost_usd',
      label: t('admin.userUsage.col.cost'),
      sortable: true,
      align: 'right',
      render: r => `$${Number(r.total_cost_usd ?? 0).toFixed(4)}`,
    },
    {
      key: 'avg_latency_ms',
      label: t('admin.userUsage.col.avgLatency'),
      sortable: true,
      align: 'right',
      render: r => (r.avg_latency_ms == null ? '—' : `${r.avg_latency_ms} ms`),
    },
  ]
}

export default function UserUsagePage() {
  const { t } = useT()
  // The "order by" dropdown is gone — it offered three of the five orders the column
  // headers appear to promise, and the headers used to disagree with it anyway. Both
  // now drive the same server-side sort over the whole aggregate.
  const { params, set, server } = useTableQuery({
    defaultSort: 'total_calls',
    filters: { tenant_id: '', from: daysAgo(30), to: today() },
  })
  const [rows, setRows] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchUserUsage({
      tenant_id: params.tenant_id || undefined,
      from: params.from,
      to: endOfDay(params.to),
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
        toast.error(
          t('admin.userUsage.toast.loadFailed', { error: e?.message ?? 'failed to load' })
        )
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.userUsage.title')}</h2>
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
          emptyText={t('admin.userUsage.empty')}
          server={server(total)}
        />
      </div>
    </div>
  )
}
