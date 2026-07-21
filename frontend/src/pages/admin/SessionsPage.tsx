import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import TenantSelector from '../../components/admin/TenantSelector'
import { fetchSessions, revokeSession } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

interface SessionRow {
  id: string
  tenant_id: string
  carmen_user_id: string
  username: string
  is_active: boolean
  last_used_at: string | null
  created_at: string | null
}

export default function SessionsPage() {
  const { t } = useT()
  const [tenantId, setTenantId] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    fetchSessions({ tenant_id: tenantId || undefined, active_only: activeOnly, limit: 100 })
      .then(r => setRows(r.data ?? []))
      .catch(e =>
        toast.error(t('admin.sessions.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [tenantId, activeOnly])

  const handleRevoke = async (id: string) => {
    try {
      await revokeSession(id)
      toast.success(t('admin.sessions.toast.revoked'))
      load()
    } catch {
      toast.error(t('admin.sessions.toast.revokeFailed'))
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.sessions.title')}</h2>
        <div className="admin-page-controls">
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={e => setActiveOnly(e.target.checked)}
            />
            {t('admin.sessions.activeOnly')}
          </label>
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-th">{t('admin.sessions.col.user')}</th>
              <th className="admin-th">{t('admin.sessions.col.tenant')}</th>
              <th className="admin-th">{t('admin.sessions.col.status')}</th>
              <th className="admin-th">{t('admin.sessions.col.lastUsed')}</th>
              <th className="admin-th">{t('admin.sessions.col.created')}</th>
              <th className="admin-th" aria-label={t('admin.sessions.actionsAria')}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="admin-td-empty">
                  {t('admin.sessions.loading')}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-td-empty">
                  {t('admin.sessions.empty')}
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <tr key={r.id} className="admin-tr">
                  <td className="admin-td">
                    <div>{r.username || '—'}</div>
                    <div className="admin-sub-text admin-mono">{r.carmen_user_id}</div>
                  </td>
                  <td className="admin-td admin-mono">{r.tenant_id}</td>
                  <td className="admin-td">
                    <span className={`status-badge ${r.is_active ? 'ok' : 'error'}`}>
                      {r.is_active
                        ? t('admin.sessions.status.active')
                        : t('admin.sessions.status.revoked')}
                    </span>
                  </td>
                  <td className="admin-td">
                    {r.last_used_at?.slice(0, 19).replace('T', ' ') ?? '—'}
                  </td>
                  <td className="admin-td">
                    {r.created_at?.slice(0, 19).replace('T', ' ') ?? '—'}
                  </td>
                  <td className="admin-td">
                    {r.is_active && (
                      <button
                        type="button"
                        className="admin-btn-danger-sm"
                        onClick={() => handleRevoke(r.id)}
                      >
                        {t('admin.sessions.revoke')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
