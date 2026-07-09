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

const fmtDate = (s: string | null) => s?.slice(0, 19).replace('T', ' ') ?? '—'

const METRIC_LABELS: Record<string, string> = {
  calls: 'API Calls',
  tokens: 'Tokens',
  cost_usd: 'Cost (USD)',
  documents: 'Documents',
}
const metricLabel = (metric: string) => METRIC_LABELS[metric] ?? metric

const quotaTier = (pct: number) => (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '')

const TENANTS_LIMIT = 500

export default function TenantsPage() {
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
      .catch(e => toast.error(`Tenants: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }

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
      label: <span className="sr-only">Expand row</span>,
      render: r => (
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={expandedId === r.id ? 'Collapse' : 'Expand'}
          aria-expanded={expandedId === r.id}
          onClick={() => toggle(r.id)}
        >
          {expandedId === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    { key: 'host', label: 'Host', sortable: true },
    { key: 'bu_code', label: 'BU', sortable: true },
    {
      key: 'plan',
      label: 'Plan',
      sortable: true,
      render: r => <span className="status-badge neutral">{r.plan || '—'}</span>,
    },
    {
      key: 'modules_count',
      label: 'Modules',
      sortable: true,
      align: 'right',
      render: r => String(r.modules_count),
    },
    {
      key: 'last_used_at',
      label: 'Last Active',
      sortable: true,
      render: r => fmtDate(r.last_used_at),
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: r => (
        <span className={`status-badge ${r.is_active ? 'ok' : 'error'}`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ]

  const renderExpandedRow = (row: TenantRow) => {
    const d = details[row.id]
    if (d) return <TenantDetailPanel detail={d} />

    const err = detailErrors[row.id]
    if (err) {
      return (
        <div className="tenant-detail-error" aria-live="polite">
          <span>Failed to load tenant detail: {err}</span>
          <button type="button" className="btn btn-outline" onClick={() => loadDetail(row.id)}>
            Retry
          </button>
        </div>
      )
    }

    if (loadingIds[row.id]) {
      return (
        <>
          <span className="sr-only" aria-live="polite">
            Loading tenant details…
          </span>
          <TenantDetailSkeleton />
        </>
      )
    }

    return null
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Tenants</h2>
        <div className="admin-page-controls">
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>
        </div>
      </div>

      <div className="admin-card">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText="No tenants found"
          expandedRowId={expandedId}
          renderExpandedRow={renderExpandedRow}
        />
      </div>
      {!loading && total > rows.length && (
        <p className="admin-sub-text admin-truncation-note">
          Showing {rows.length} of {total} — narrow the filter to see the rest.
        </p>
      )}
    </div>
  )
}

function TenantDetailSkeleton() {
  return (
    <div className="tenant-detail" aria-hidden="true">
      <div className="tenant-detail-meta">
        <span className="skeleton tenant-detail-skeleton-line" />
      </div>

      <section className="tenant-detail-section">
        <h4>Modules</h4>
        <div className="tenant-chips">
          <span className="skeleton tenant-chip-skeleton" />
          <span className="skeleton tenant-chip-skeleton" />
        </div>
      </section>

      <section className="tenant-detail-section">
        <h4>Quotas</h4>
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
        <h4>Recent Sessions</h4>
        <table className="admin-table admin-table--mini">
          <thead>
            <tr>
              <th className="admin-th">User</th>
              <th className="admin-th">Status</th>
              <th className="admin-th">Last Used</th>
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

function TenantDetailPanel({ detail }: { detail: TenantDetail }) {
  return (
    <div className="tenant-detail">
      <div className="tenant-detail-meta">
        <span>
          <strong>{detail.name || detail.host}</strong> · {detail.bu_code}
        </span>
        {detail.contact_email && <span className="admin-sub-text">{detail.contact_email}</span>}
      </div>

      <section className="tenant-detail-section">
        <h4>Modules ({detail.modules.length})</h4>
        {detail.modules.length === 0 ? (
          <span className="admin-sub-text">No modules enabled</span>
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
        <h4>Quotas</h4>
        {detail.quotas.length === 0 ? (
          <span className="admin-sub-text">No quotas configured</span>
        ) : (
          <div className="tenant-quota-list">
            {detail.quotas.map(q => (
              <div key={`${q.period}-${q.metric}`} className="tenant-quota">
                <div className="tenant-quota-label">
                  {q.period} · {metricLabel(q.metric)}
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
        <h4>Recent Sessions ({detail.recent_sessions.length})</h4>
        {detail.recent_sessions.length === 0 ? (
          <span className="admin-sub-text">No sessions</span>
        ) : (
          <table className="admin-table admin-table--mini">
            <thead>
              <tr>
                <th className="admin-th">User</th>
                <th className="admin-th">Status</th>
                <th className="admin-th">Last Used</th>
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
                      {s.is_active ? 'Active' : 'Revoked'}
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
