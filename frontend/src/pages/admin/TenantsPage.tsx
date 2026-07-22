import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import KPICard from '../../components/admin/KPICard'
import {
  fetchTenants,
  fetchTenantDetail,
  type TenantRow,
  type TenantDetail,
} from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

const fmtDate = (s: string | null) => s?.slice(0, 19).replace('T', ' ') ?? '—'

/** Days after which a BU that once used the product reads as gone quiet. */
const IDLE_WARN_DAYS = 14

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** Adoption funnel — derived from the rows already on screen, no extra endpoint. */
function funnel(rows: TenantRow[]) {
  const extracted = rows.filter(r => (r.tried ?? 0) > 0)
  const activeCutoff = Date.now() - 7 * 86_400_000
  return {
    loggedIn: rows.length,
    extracted: extracted.length,
    neverExtracted: rows.length - extracted.length,
    medianDocs: median(extracted.map(r => r.tried ?? 0)),
    active7d: extracted.filter(r => r.last_use && new Date(r.last_use).getTime() >= activeCutoff)
      .length,
  }
}

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
  const [neverExtracted, setNeverExtracted] = useState(false)
  const [rows, setRows] = useState<TenantRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, TenantDetail>>({})
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({})
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    fetchTenants({ active_only: activeOnly, limit: TENANTS_LIMIT, include_engagement: true })
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

  // Funnel counts the whole tenant list; the table can be filtered down to the
  // never-extracted slice without the KPIs shifting under you.
  const f = useMemo(() => funnel(rows), [rows])
  const visibleRows = useMemo(
    () => (neverExtracted ? rows.filter(r => !(r.tried ?? 0)) : rows),
    [rows, neverExtracted]
  )

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
      key: 'tried',
      label: t('admin.tenants.col.tried'),
      sortable: true,
      align: 'right',
      render: r => String(r.tried ?? 0),
    },
    {
      key: 'posted_to_carmen',
      label: t('admin.tenants.col.posted'),
      sortable: true,
      align: 'right',
      // Extracted but never submitted = they tried it and didn't trust the result.
      // That is a different problem from not showing up, so it must not look the same.
      render: r => {
        const posted = r.posted_to_carmen ?? 0
        const stale = posted === 0 && (r.tried ?? 0) > 0
        return <span className={stale ? 'text-danger' : undefined}>{posted}</span>
      },
    },
    {
      key: 'active_weeks',
      label: t('admin.tenants.col.activeWeeks'),
      sortable: true,
      align: 'right',
      render: r => String(r.active_weeks ?? 0),
    },
    {
      key: 'days_idle',
      label: t('admin.tenants.col.daysIdle'),
      sortable: true,
      align: 'right',
      render: r =>
        r.days_idle === null || r.days_idle === undefined ? (
          '—'
        ) : (
          <span className={r.days_idle > IDLE_WARN_DAYS ? 'text-warn' : undefined}>
            {r.days_idle}
          </span>
        ),
    },
    {
      key: 'last_use',
      label: t('admin.tenants.col.lastActive'),
      sortable: true,
      // last_use (tasks) over last_used_at (llm_usage_logs): the latter has no row
      // when the call never reached the model, so it silently skips failed attempts
      // and overstates idleness for exactly the BUs that churned on failures.
      render: r => fmtDate(r.last_use ?? r.last_used_at),
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
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={neverExtracted}
              onChange={e => setNeverExtracted(e.target.checked)}
            />
            {t('admin.tenants.filter.neverExtracted')}
          </label>
        </div>
      </div>

      {/* The funnel is the one thing you cannot get by scanning the table: how many
          BUs opened the door and did nothing. Derived from the rows already loaded. */}
      <div className="kpi-grid">
        <KPICard label={t('admin.tenants.kpi.busLoggedIn')} value={f.loggedIn} loading={loading} />
        <KPICard
          label={t('admin.tenants.kpi.busExtracted')}
          value={f.extracted}
          loading={loading}
        />
        <KPICard
          label={t('admin.tenants.kpi.busNeverExtracted')}
          value={f.neverExtracted}
          accent={f.neverExtracted > 0 ? 'yellow' : 'default'}
          loading={loading}
        />
        <KPICard label={t('admin.tenants.kpi.medianDocs')} value={f.medianDocs} loading={loading} />
        <KPICard label={t('admin.tenants.kpi.active7d')} value={f.active7d} loading={loading} />
      </div>

      <div className="admin-card">
        <DataTable
          columns={columns}
          rows={visibleRows}
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
        {/* plan lives here, not as a column: the engagement columns took the width
            and plan is a per-tenant constant, not something you scan a list for. */}
        <span className="status-badge neutral">{detail.plan || '—'}</span>
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
            {/* Opt-out: every catalog module is on unless an admin turned it off, so the
                exceptions are the news. Same convention as the Quotas & Modules page. */}
            {detail.modules_disabled.map(id => (
              <span key={id} className="tenant-chip danger">
                {t('admin.tenants.detail.modulesDisabled', { name: id })}
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
              <div key={q.id} className="tenant-quota">
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
