import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchUserUsage } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

type OrderBy = 'calls' | 'tokens' | 'cost'

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
      key: 'username',
      label: t('admin.userUsage.col.user'),
      sortable: true,
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
  const [tenantId, setTenantId] = useState('')
  const [orderBy, setOrderBy] = useState<OrderBy>('calls')
  const [days, setDays] = useState(30)
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const from = new Date(Date.now() - days * 86400_000).toISOString()
    fetchUserUsage({ tenant_id: tenantId || undefined, order_by: orderBy, from, limit: 200 })
      .then(r => setRows(r.data ?? []))
      .catch(e =>
        toast.error(
          t('admin.userUsage.toast.loadFailed', { error: e?.message ?? 'failed to load' })
        )
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, orderBy, days])

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.userUsage.title')}</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label={t('admin.userUsage.orderAria')}
            value={orderBy}
            onChange={e => setOrderBy(e.target.value as OrderBy)}
          >
            <option value="calls">{t('admin.userUsage.order.calls')}</option>
            <option value="tokens">{t('admin.userUsage.order.tokens')}</option>
            <option value="cost">{t('admin.userUsage.order.cost')}</option>
          </select>
          <select
            className="admin-select"
            aria-label={t('admin.userUsage.periodAria')}
            value={days}
            onChange={e => setDays(Number(e.target.value))}
          >
            <option value={7}>{t('admin.userUsage.period.7d')}</option>
            <option value={30}>{t('admin.userUsage.period.30d')}</option>
            <option value={90}>{t('admin.userUsage.period.90d')}</option>
          </select>
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>
      <div className="admin-card">
        <DataTable
          columns={getCols(t)}
          rows={rows}
          loading={loading}
          emptyText={t('admin.userUsage.empty')}
        />
      </div>
    </div>
  )
}
