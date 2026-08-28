import { toast } from 'sonner'
import TenantSelector from '../../components/admin/TenantSelector'
import PeriodPicker, { daysAgo, endOfDay, today } from '../../components/admin/PeriodPicker'
import Pager from '../../components/common/Pager'
import { fetchAlerts, resolveAlert } from '../../lib/api/adminClient'
import { useTableQuery } from '../../hooks/admin/useTableQuery'
import { useTableData } from '../../hooks/admin/useTableData'
import { useT } from '../../i18n/LanguageContext'
import { fmtDateTime } from '../../lib/date'

interface Alert {
  id: number
  tenant_id: string
  tenant_name?: string | null
  module_id: string | null
  metric: string
  severity: string | null
  threshold: number | null
  actual: number | null
  description: string | null
  created_at: string | null
  resolved_at: string | null
}

/** A card, not a table row — so this list pages on its own rather than via DataTable. */
const PER_PAGE = 20

export default function AnomaliesPage() {
  const { t } = useT()
  // 'all' as the default status would drown the open ones; the period filter is what
  // makes a resolved alert from two months ago reachable at all.
  const { params, set } = useTableQuery({
    defaultSort: 'created_at',
    filters: { status: 'open', tenant_id: '', from: daysAgo(30), to: today() },
  })
  const {
    rows: alerts,
    total,
    loading,
    reload,
  } = useTableData<Alert>(
    () =>
      fetchAlerts({
        status: params.status,
        tenant_id: params.tenant_id || undefined,
        from: params.from,
        to: endOfDay(params.to),
        limit: PER_PAGE,
        offset: params.offset,
      }),
    [params],
    'admin.anomalies.toast.loadFailed'
  )

  const handleResolve = async (id: number) => {
    try {
      await resolveAlert(id)
      toast.success(t('admin.anomalies.toast.resolved'))
      reload()
    } catch {
      toast.error(t('admin.anomalies.toast.resolveFailed'))
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.anomalies.title')}</h2>
        <div className="admin-page-controls">
          <select
            className="admin-select"
            aria-label={t('admin.anomalies.statusFilterAria')}
            value={params.status}
            onChange={e => set({ status: e.target.value })}
          >
            <option value="open">{t('admin.anomalies.status.open')}</option>
            <option value="resolved">{t('admin.anomalies.status.resolved')}</option>
            <option value="all">{t('admin.anomalies.status.all')}</option>
          </select>
          <PeriodPicker
            value={{ from: params.from, to: params.to }}
            onChange={p => set({ from: p.from, to: p.to })}
          />
          <TenantSelector value={params.tenant_id} onChange={v => set({ tenant_id: v })} />
        </div>
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="admin-td-empty">{t('admin.anomalies.loading')}</div>
        ) : alerts.length === 0 ? (
          <div className="admin-td-empty">{t('admin.anomalies.empty')}</div>
        ) : (
          <div className="alert-list">
            {alerts.map(a => (
              <div key={a.id} className={`alert-item alert-item--${a.severity ?? 'warn'}`}>
                <div className="alert-meta">
                  <span className={`alert-severity alert-severity--${a.severity}`}>
                    {a.severity?.toUpperCase() ?? t('admin.anomalies.warnFallback')}
                  </span>
                  <span className="alert-metric">{a.metric}</span>
                  {a.module_id && <span className="alert-module">{a.module_id}</span>}
                  <span className="alert-tenant">{a.tenant_name ?? a.tenant_id}</span>
                </div>
                <div className="alert-body">
                  {a.description && <p className="alert-description">{a.description}</p>}
                  {a.threshold != null && (
                    <p className="alert-values">
                      {t('admin.anomalies.threshold')} <b>{a.threshold}</b>{' '}
                      {t('admin.anomalies.actual')} <b className="text-red">{a.actual}</b>
                    </p>
                  )}
                  <p className="alert-time">
                    {fmtDateTime(a.created_at)}
                    {a.resolved_at &&
                      ` → ${t('admin.anomalies.resolvedAt', { date: fmtDateTime(a.resolved_at) })}`}
                  </p>
                </div>
                {!a.resolved_at && (
                  <button
                    type="button"
                    className="alert-resolve-btn"
                    onClick={() => handleResolve(a.id)}
                  >
                    {t('admin.anomalies.resolve')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Pager
        offset={params.offset}
        limit={PER_PAGE}
        total={total}
        onChange={offset => set({ offset })}
      />
    </div>
  )
}
