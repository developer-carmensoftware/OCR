import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import CustomModal from '../../components/common/CustomModal'
import SwapLabel from '../../components/common/SwapLabel'
import {
  endMaintenanceNow,
  fetchMaintenance,
  fetchTenants,
  setMaintenanceSchedule,
  setTenantMaintenance,
  type MaintenanceStatus,
  type TenantRow,
} from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

// Blocks every user — require typing this to arm it (guards against a fat-fingered click).
const CONFIRM_WORD = 'MAINTENANCE'
const pad = (n: number) => String(n).padStart(2, '0')

/** Date → value for <input type="datetime-local"> in the browser's local time. */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** UTC ISO → compact ICT display. */
function fmtICT(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MaintenancePage() {
  const { t } = useT()
  const [status, setStatus] = useState<MaintenanceStatus | null>(null)
  const [message, setMessage] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [saving, setSaving] = useState(false)
  // Typed-confirmation gate for the system-wide enable/update.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [errorNonce, setErrorNonce] = useState(0)

  const load = () => {
    fetchMaintenance()
      .then(s => {
        setStatus(s)
        setMessage(s.message)
        // Only prefill an active or still-upcoming window; a window that has
        // already elapsed is done, so start fresh with empty fields.
        const relevant = !!s.window_end && new Date(s.window_end).getTime() > Date.now()
        setStart(relevant && s.window_start ? toLocalInput(new Date(s.window_start)) : '')
        setEnd(relevant && s.window_end ? toLocalInput(new Date(s.window_end)) : '')
      })
      .catch(e => toast.error(t('admin.maintenance.saveError', { error: e?.message ?? '' })))
    fetchTenants({ active_only: false, limit: 500 })
      .then(r => setTenants(r.data ?? []))
      .catch(() => {})
  }

  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const downTenants = useMemo(() => new Set(status?.tenants ?? []), [status])

  // A start+end window is always required — no indefinite "ON" — so maintenance
  // always has an automatic reopen time and users can never be stranded.
  // Validate first, then require a typed confirmation before actually arming it.
  const requestEnable = () => {
    if (!start || !end) return toast.error(t('admin.maintenance.needTimes'))
    if (new Date(end) <= new Date(start)) return toast.error(t('admin.maintenance.badTimes'))
    setConfirmInput('')
    setConfirmOpen(true)
  }

  const confirmEnable = async () => {
    if (confirmInput.trim().toUpperCase() !== CONFIRM_WORD) {
      setErrorNonce(n => n + 1) // shakes the field
      return
    }
    setSaving(true)
    try {
      await setMaintenanceSchedule(
        new Date(start).toISOString(),
        new Date(end).toISOString(),
        message
      )
      toast.success(t('admin.maintenance.saved'))
      setConfirmOpen(false)
      load()
    } catch (e) {
      toast.error(t('admin.maintenance.saveError', { error: (e as Error)?.message ?? '' }))
    } finally {
      setSaving(false)
    }
  }

  const endNow = async () => {
    setSaving(true)
    try {
      await endMaintenanceNow()
      toast.success(t('admin.maintenance.saved'))
      load()
    } catch (e) {
      toast.error(t('admin.maintenance.saveError', { error: (e as Error)?.message ?? '' }))
    } finally {
      setSaving(false)
    }
  }

  const toggleTenant = async (tenantId: string, enabled: boolean) => {
    try {
      await setTenantMaintenance(tenantId, enabled)
      toast.success(t('admin.maintenance.saved'))
      load()
    } catch (e) {
      toast.error(t('admin.maintenance.saveError', { error: (e as Error)?.message ?? '' }))
    }
  }

  // "Start now": fill start with the current minute and, if empty, end +1h.
  const startNow = () => {
    const now = new Date()
    setStart(toLocalInput(now))
    if (!end) setEnd(toLocalInput(new Date(now.getTime() + 60 * 60 * 1000)))
  }

  const active = status?.active ?? false
  // Only a window whose end is still ahead counts as "scheduled" — a window that
  // has already elapsed left the system reopened, so it reads as Off, not Scheduled.
  const hasWindow = !!(
    status?.window_start &&
    status?.window_end &&
    new Date(status.window_end).getTime() > Date.now()
  )
  const statusLabel = active
    ? t('admin.maintenance.statusActive')
    : hasWindow
      ? t('admin.maintenance.statusScheduled')
      : t('admin.maintenance.statusOff')

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.maintenance.title')}</h2>
      </div>

      {/* System-wide maintenance — always a bounded window */}
      <section className="admin-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.25rem' }}>{t('admin.maintenance.globalTitle')}</h3>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-3)' }}>
          {t('admin.maintenance.scheduleHint')}
        </p>

        <div style={{ marginBottom: '0.75rem' }}>
          <span className={`status-badge ${active ? 'error' : hasWindow ? 'warn' : 'ok'}`}>
            {statusLabel}
          </span>
          {hasWindow && (
            <span style={{ marginLeft: '0.75rem', color: 'var(--text-3)' }}>
              {t('admin.maintenance.currentWindow', {
                start: fmtICT(status!.window_start),
                end: fmtICT(status!.window_end),
              })}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <label htmlFor="maint-start" style={{ display: 'block' }}>
              {t('admin.maintenance.windowStart')}
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
              <input
                id="maint-start"
                type="datetime-local"
                className="admin-form-input"
                value={start}
                onChange={e => setStart(e.target.value)}
              />
              <button type="button" className="btn btn-outline" onClick={startNow}>
                {t('admin.maintenance.startNow')}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="maint-end" style={{ display: 'block' }}>
              {t('admin.maintenance.windowEnd')}
            </label>
            <input
              id="maint-end"
              type="datetime-local"
              className="admin-form-input"
              style={{ display: 'block', marginTop: '0.25rem' }}
              value={end}
              onChange={e => setEnd(e.target.value)}
            />
          </div>
        </div>

        <label style={{ display: 'block', marginBottom: '0.75rem' }}>
          {t('admin.maintenance.message')}
          <textarea
            className="admin-form-input"
            style={{ display: 'block', width: '100%', marginTop: '0.25rem', minHeight: '3rem' }}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </label>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-confirm"
            disabled={saving || !start || !end}
            onClick={requestEnable}
          >
            {active || hasWindow ? t('admin.maintenance.update') : t('admin.maintenance.enableBtn')}
          </button>
          {(active || hasWindow) && (
            <button className="btn btn-outline" disabled={saving} onClick={endNow}>
              {t('admin.maintenance.endNow')}
            </button>
          )}
        </div>
      </section>

      {/* Per-tenant */}
      <section className="admin-card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem' }}>{t('admin.maintenance.perTenantTitle')}</h3>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-3)' }}>
          {t('admin.maintenance.perTenantHint')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {tenants.map(tenant => {
            const down = downTenants.has(tenant.id)
            return (
              <div
                key={tenant.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.25rem',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span>
                  {tenant.name || tenant.host}{' '}
                  <span className="admin-mono" style={{ color: 'var(--text-3)' }}>
                    {tenant.bu_code}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className={`status-badge ${down ? 'error' : 'ok'}`}>
                    {down ? t('admin.maintenance.tenantOn') : t('admin.maintenance.tenantOff')}
                  </span>
                  {/* Verb + object: the badge beside it already states the status,
                      so the button must state the action, not repeat the state. */}
                  <button
                    className="btn btn-sm btn-outline"
                    aria-label={t(
                      down
                        ? 'admin.maintenance.bringOnlineFor'
                        : 'admin.maintenance.takeOfflineFor',
                      { tenant: tenant.name || tenant.host }
                    )}
                    onClick={() => toggleTenant(tenant.id, !down)}
                  >
                    <SwapLabel
                      active={down}
                      idle={t('admin.maintenance.takeOffline')}
                      busy={t('admin.maintenance.bringOnline')}
                    />
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <CustomModal
        show={confirmOpen}
        type="warning"
        title={t('admin.maintenance.confirmTitle')}
        message={t('admin.maintenance.confirmBody')}
        inputLabel={t('admin.maintenance.confirmInputLabel', { word: CONFIRM_WORD })}
        inputPlaceholder={CONFIRM_WORD}
        inputValue={confirmInput}
        onInputChange={setConfirmInput}
        errorNonce={errorNonce}
        busy={saving}
        confirmText={
          active || hasWindow ? t('admin.maintenance.update') : t('admin.maintenance.enableBtn')
        }
        onConfirm={confirmEnable}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
