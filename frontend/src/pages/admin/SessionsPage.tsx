import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import PeriodPicker, { daysAgo, endOfDay, today } from '../../components/admin/PeriodPicker'
import { fetchSessions, revokeSession } from '../../lib/api/adminClient'
import { useTableQuery } from '../../hooks/admin/useTableQuery'
import { useTableData } from '../../hooks/admin/useTableData'
import { useT } from '../../i18n/LanguageContext'
import { fmtDateTime } from '../../lib/date'

interface SessionRow {
  id: string
  tenant_id: string
  tenant_name: string | null
  carmen_user_id: string
  username: string
  is_active: boolean
  last_used_at: string | null
  created_at: string | null
}

export default function SessionsPage() {
  const { t } = useT()
  // Was a hand-rolled <table>: no sorting, no paging, no search, and a flat 100-row
  // ceiling over what is really 30 days of login history. DataTable brings all four.
  const { params, set, server } = useTableQuery({
    defaultSort: 'last_used_at',
    filters: { tenant_id: '', active_only: '', from: daysAgo(30), to: today() },
  })
  const { rows, total, loading, reload } = useTableData<SessionRow>(
    () =>
      fetchSessions({
        tenant_id: params.tenant_id || undefined,
        active_only: params.active_only === '1',
        from: params.from,
        to: endOfDay(params.to),
        q: params.q || undefined,
        sort: params.sort,
        dir: params.dir,
        limit: params.limit,
        offset: params.offset,
      }),
    [params],
    'admin.sessions.toast.loadFailed'
  )

  const handleRevoke = async (id: string) => {
    try {
      await revokeSession(id)
      toast.success(t('admin.sessions.toast.revoked'))
      reload()
    } catch {
      toast.error(t('admin.sessions.toast.revokeFailed'))
    }
  }

  const columns: Column<SessionRow>[] = [
    {
      key: 'username',
      label: t('admin.sessions.col.user'),
      sortable: true,
      render: r => (
        <div>
          <div>{r.username || '—'}</div>
          <div className="admin-sub-text admin-mono">{r.carmen_user_id}</div>
        </div>
      ),
    },
    {
      // Displays the name, never sorts by it: the name is not a column on ocr_sessions.
      key: 'tenant_name',
      label: t('admin.sessions.col.tenant'),
      render: r => r.tenant_name ?? r.tenant_id,
    },
    {
      key: 'is_active',
      label: t('admin.sessions.col.status'),
      sortable: true,
      render: r => (
        <span className={`status-badge ${r.is_active ? 'ok' : 'error'}`}>
          {r.is_active ? t('admin.sessions.status.active') : t('admin.sessions.status.revoked')}
        </span>
      ),
    },
    {
      key: 'last_used_at',
      label: t('admin.sessions.col.lastUsed'),
      sortable: true,
      defaultDesc: true,
      render: r => fmtDateTime(r.last_used_at),
    },
    {
      key: 'created_at',
      label: t('admin.sessions.col.created'),
      sortable: true,
      defaultDesc: true,
      render: r => fmtDateTime(r.created_at),
    },
    {
      key: '_actions',
      label: <span className="sr-only">{t('admin.sessions.actionsAria')}</span>,
      render: r =>
        r.is_active ? (
          <button type="button" className="admin-btn-danger-sm" onClick={() => handleRevoke(r.id)}>
            {t('admin.sessions.revoke')}
          </button>
        ) : null,
    },
  ]

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.sessions.title')}</h2>
        <div className="admin-page-controls">
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={params.active_only === '1'}
              onChange={e => set({ active_only: e.target.checked ? '1' : '' })}
            />
            {t('admin.sessions.activeOnly')}
          </label>
          <PeriodPicker
            value={{ from: params.from, to: params.to }}
            onChange={p => set({ from: p.from, to: p.to })}
          />
          <TenantSelector value={params.tenant_id} onChange={v => set({ tenant_id: v })} />
        </div>
      </div>

      <div className="admin-card">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={t('admin.sessions.empty')}
          server={server(total)}
          search={{
            value: params.q,
            onChange: q => set({ q }),
            placeholder: t('admin.sessions.searchPlaceholder'),
          }}
        />
      </div>
    </div>
  )
}
