import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import {
  fetchTenants,
  fetchTenantDetail,
  type TenantRow,
  type TenantDetail,
} from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

const fmtDate = (s: string | null) => s?.slice(0, 19).replace('T', ' ') ?? '—'

function metricLabel(t: ReturnType<typeof useT>['t'], metric: string): string {
  const METRIC_LABELS: Record<string, string> = {
    calls: t('admin.tenants.metric.calls'),
    tokens: t('admin.tenants.metric.tokens'),
    cost_usd: t('admin.tenants.metric.cost'),
    documents: t('admin.tenants.metric.documents'),
  }
  return METRIC_LABELS[metric] ?? metric
}

const quotaTier = (pct: number) => (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '')

const TENANTS_LIMIT = 500

export default function TenantsPage() {
  const { t } = useT()
  const [activeOnly, setActiveOnly] = useState(true)
  const [rows, setRows] = useState<TenantRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, TenantDetail>>({})
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({})
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    fetchTenants({ active_only: activeOnly, limit: TENANTS_LIMIT })
      .then(r => {
        setRows(r.data ?? [])
        setTotal(r.total ?? 0)
      })
      .catch(e =>
        toast.error(t('admin.tenants.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [activeOnly])

  // Keyed per-tenant-id (not a single scalar) so an in-flight fetch for one row
  // can't clear the loading indicator of a different row expanded afterward.
  const loadDetail = (id: string) => {
    setLoadingIds(prev => ({ ...prev, [id]: true }))
    setDetailErrors(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    fetchTenantDetail(id)
      .then(d => setDetails(prev => ({ ...prev, [id]: d })))
      .catch(e => setDetailErrors(prev => ({ ...prev, [id]: e?.message ?? 'Failed to load' })))
      .finally(() => setLoadingIds(prev => ({ ...prev, [id]: false })))
  }

  const toggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!details[id]) loadDetail(id)
  }

  const columns: Column<TenantRow>[] = [
    {
      key: '_expand',
      label: <span className="sr-only">{t('admin.tenants.expandRow')}</span>,
      render: r => (
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={expandedId === r.id ? t('admin.tenants.collapse') : t('admin.tenants.expand')}
          aria-expanded={expandedId === r.id}
          onClick={() => toggle(r.id)}
        >
          {expandedId === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    { key: 'host', label: t('admin.tenants.col.host'), sortable: true },
    { key: 'bu_code', label: t('admin.tenants.col.bu'), sortable: true },
    {
      key: 'plan',
      label: t('admin.tenants.col.plan'),
      sortable: true,
      render: r => <span className="status-badge neutral">{r.plan || '—'}</span>,
    },
    {
      key: 'modules_count',
      label: t('admin.tenants.col.modules'),
      sortable: true,
      align: 'right',
      render: r => String(r.modules_count),
    },
    {
      key: 'last_used_at',
      label: t('admin.tenants.col.lastActive'),
      sortable: true,
      render: r => fmtDate(r.last_used_at),
    },
    {
      key: 'is_active',
      label: t('admin.tenants.col.status'),
      sortable: true,
      render: r => (
        <span className={`status-badge ${r.is_active ? 'ok' : 'error'}`}>
          {r.is_active ? t('admin.tenants.status.active') : t('admin.tenants.status.inactive')}
        </span>
      ),
    },
  ]

  const renderExpandedRow = (row: TenantRow) => {
    const d = details[row.id]
    if (d) return <TenantDetailPanel detail={d} t={t} />

    const err = detailErrors[row.id]
    if (err) {
      return (
        <div className="tenant-detail-error" aria-live="polite">
          <span>{t('admin.tenants.detail.loadFailed', { error: err })}</span>
          <button type="button" className="btn btn-outline" onClick={() => loadDetail(row.id)}>
            {t('admin.tenants.detail.retry')}
          </button>
        </div>
      )
    }

    if (loadingIds[row.id]) {
      return (
        <>
          <span className="sr-only" aria-live="polite">
            {t('admin.tenants.detail.loading')}
          </span>
          <TenantDetailSkeleton t={t} />
        </>
      )
    }

    return null
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.tenants.title')}</h2>
        <div className="admin-page-controls">
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
            />
            {t('admin.tenants.activeOnly')}
          </label>
        </div>
      </div>

      <div className="admin-card">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={t('admin.tenants.empty')}
          expandedRowId={expandedId}
          renderExpandedRow={renderExpandedRow}
        />
      </div>
      {!loading && total > rows.length && (
        <p className="admin-sub-text admin-truncation-note">
          {t('admin.tenants.truncationNote', { shown: rows.length, total })}
        </p>
      )}
    </div>
  )
}

function TenantDetailSkeleton({ t }: { t: ReturnType<typeof useT>['t'] }) {
  return (
    <div className="tenant-detail" aria-hidden="true">
      <div className="tenant-detail-meta">
        <span className="skeleton tenant-detail-skeleton-line" />
      </div>

      <section className="tenant-detail-section">
        <h4>{t('admin.tenants.detail.modules')}</h4>
        <div className="tenant-chips">
          <span className="skeleton tenant-chip-skeleton" />
          <span className="skeleton tenant-chip-skeleton" />
        </div>
      </section>

      <section className="tenant-detail-section">
        <h4>{t('admin.tenants.detail.quotas')}</h4>
        <div className="tenant-quota-list">
          <div className="tenant-quota">
            <div className="tenant-quota-label">
              <span className="skeleton tenant-detail-skeleton-line" />
            </div>
            <div className="tenant-quota-bar">
              <div className="skeleton tenant-quota-fill-skeleton" />
            </div>
          </div>
        </div>
      </section>

      <section className="tenant-detail-section">
        <h4>{t('admin.tenants.detail.recentSessions')}</h4>
        <table className="admin-table admin-table--mini">
          <thead>
            <tr>
              <th className="admin-th">{t('admin.tenants.detail.col.user')}</th>
              <th className="admin-th">{t('admin.tenants.detail.col.status')}</th>
              <th className="admin-th">{t('admin.tenants.detail.col.lastUsed')}</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map(i => (
              <tr key={i} className="admin-tr">
                <td className="admin-td">
                  <span className="skeleton skeleton-cell sk-w-68" />
                </td>
                <td className="admin-td">
                  <span className="skeleton skeleton-cell sk-w-50" />
                </td>
                <td className="admin-td">
                  <span className="skeleton skeleton-cell sk-w-78" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function TenantDetailPanel({
  detail,
  t,
}: {
  detail: TenantDetail
  t: ReturnType<typeof useT>['t']
}) {
  return (
    <div className="tenant-detail">
      <div className="tenant-detail-meta">
        <span>
          <strong>{detail.name || detail.host}</strong> · {detail.bu_code}
        </span>
        {detail.contact_email && <span className="admin-sub-text">{detail.contact_email}</span>}
      </div>

      <section className="tenant-detail-section">
        <h4>{t('admin.tenants.detail.modulesCount', { count: detail.modules.length })}</h4>
        {detail.modules.length === 0 ? (
          <span className="admin-sub-text">{t('admin.tenants.detail.noModules')}</span>
        ) : (
          <div className="tenant-chips">
            {detail.modules.map(m => (
              <span key={m.id} className="tenant-chip">
                {m.display_name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="tenant-detail-section">
        <h4>{t('admin.tenants.detail.quotas')}</h4>
        {detail.quotas.length === 0 ? (
          <span className="admin-sub-text">{t('admin.tenants.detail.noQuotas')}</span>
        ) : (
          <div className="tenant-quota-list">
            {detail.quotas.map(q => (
              <div key={`${q.period}-${q.metric}`} className="tenant-quota">
                <div className="tenant-quota-label">
                  {q.period} · {metricLabel(t, q.metric)}
                  <span className="admin-mono admin-sub-text">
                    {q.used} / {q.limit} ({q.pct}%)
                  </span>
                </div>
                <div className="tenant-quota-bar">
                  <div
                    className={`tenant-quota-fill ${quotaTier(q.pct)}`.trim()}
                    style={{ width: `${Math.min(q.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tenant-detail-section">
        <h4>
          {t('admin.tenants.detail.recentSessionsCount', { count: detail.recent_sessions.length })}
        </h4>
        {detail.recent_sessions.length === 0 ? (
          <span className="admin-sub-text">{t('admin.tenants.detail.noSessions')}</span>
        ) : (
          <table className="admin-table admin-table--mini">
            <thead>
              <tr>
                <th className="admin-th">{t('admin.tenants.detail.col.user')}</th>
                <th className="admin-th">{t('admin.tenants.detail.col.status')}</th>
                <th className="admin-th">{t('admin.tenants.detail.col.lastUsed')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.recent_sessions.map(s => (
                <tr key={s.id} className="admin-tr">
                  <td className="admin-td">
                    <div>{s.username || '—'}</div>
                    <div className="admin-sub-text admin-mono">{s.carmen_user_id}</div>
                  </td>
                  <td className="admin-td">
                    <span className={`status-badge ${s.is_active ? 'ok' : 'error'}`}>
                      {s.is_active
                        ? t('admin.tenants.detail.status.active')
                        : t('admin.tenants.detail.status.revoked')}
                    </span>
                  </td>
                  <td className="admin-td">{fmtDate(s.last_used_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
