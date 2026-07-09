import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Coins } from 'lucide-react'
import DataTable, { type Column } from '../../components/admin/DataTable'
import TenantSelector from '../../components/admin/TenantSelector'
import {
  adjustCredits,
  fetchCreditBalance,
  fetchCreditLedger,
  topupCredits,
  type CreditLedgerEntry,
} from '../../lib/api/adminClient'
import '../../styles/components/admin-credits.css'
import { useT } from '../../i18n/LanguageContext'

// Mirrors the active top-up credit_packs catalog (see migration 219).
function getPacks(t: ReturnType<typeof useT>['t']) {
  return [
    { code: 'pack_small', label: t('admin.credits.pack.small') },
    { code: 'pack_medium', label: t('admin.credits.pack.medium') },
    { code: 'pack_large', label: t('admin.credits.pack.large') },
  ]
}

function getCols(t: ReturnType<typeof useT>['t']): Column<CreditLedgerEntry>[] {
  return [
    {
      key: 'created_at',
      label: t('admin.credits.col.when'),
      sortable: true,
      render: r => (r.created_at ? new Date(r.created_at).toLocaleString() : '—'),
    },
    { key: 'reason', label: t('admin.credits.col.reason'), sortable: true },
    {
      key: 'delta',
      label: t('admin.credits.col.change'),
      sortable: true,
      align: 'right',
      render: r => (r.delta > 0 ? `+${r.delta}` : String(r.delta)),
    },
    { key: 'balance_after', label: t('admin.credits.col.balance'), sortable: true, align: 'right' },
    { key: 'pack_code', label: t('admin.credits.col.pack'), render: r => r.pack_code ?? '—' },
    { key: 'note', label: t('admin.credits.col.note'), render: r => r.note ?? r.ref ?? '—' },
  ]
}

export default function CreditsPage() {
  const { t } = useT()
  const PACKS = getPacks(t)
  const [tenantId, setTenantId] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [packCode, setPackCode] = useState(PACKS[0].code)
  const [adjustDelta, setAdjustDelta] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  const refresh = () => {
    if (!tenantId) {
      setBalance(null)
      setLedger([])
      return
    }
    setLoading(true)
    Promise.all([fetchCreditBalance(tenantId), fetchCreditLedger(tenantId)])
      .then(([b, l]) => {
        setBalance(b.balance)
        setLedger(l)
      })
      .catch(e =>
        toast.error(t('admin.credits.toast.loadFailed', { error: e?.message ?? 'failed to load' }))
      )
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [tenantId])

  const handleTopup = async () => {
    setBusy(true)
    try {
      const b = await topupCredits(tenantId, packCode)
      setBalance(b.balance)
      toast.success(t('admin.credits.toast.toppedUp', { balance: b.balance }))
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleAdjust = async () => {
    const delta = parseInt(adjustDelta, 10)
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error(t('admin.credits.toast.nonZero'))
      return
    }
    setBusy(true)
    try {
      const b = await adjustCredits(tenantId, delta, adjustNote || undefined)
      setBalance(b.balance)
      setAdjustDelta('')
      setAdjustNote('')
      toast.success(t('admin.credits.toast.adjusted', { balance: b.balance }))
      refresh()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">{t('admin.credits.title')}</h2>
        <div className="admin-page-controls">
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      {!tenantId ? (
        <div className="admin-card ac-empty">{t('admin.credits.selectTenant')}</div>
      ) : (
        <>
          <div className="ac-grid">
            <div className="admin-card ac-balance-card">
              <span className="ac-balance-label">
                <Coins size={14} /> {t('admin.credits.balanceLabel')}
              </span>
              <span className="ac-balance-value">{balance ?? '—'}</span>
            </div>

            <div className="admin-card ac-action-card">
              <h3 className="ac-action-title">{t('admin.credits.topupTitle')}</h3>
              <div className="ac-row">
                <select
                  className="ac-input"
                  value={packCode}
                  onChange={e => setPackCode(e.target.value)}
                  aria-label={t('admin.credits.packAria')}
                >
                  {PACKS.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-confirm"
                  disabled={busy}
                  onClick={() => void handleTopup()}
                >
                  {t('admin.credits.grant')}
                </button>
              </div>
            </div>

            <div className="admin-card ac-action-card">
              <h3 className="ac-action-title">{t('admin.credits.adjustTitle')}</h3>
              <div className="ac-row">
                <input
                  className="ac-input ac-input--num"
                  type="number"
                  placeholder={t('admin.credits.adjustAmountPlaceholder')}
                  value={adjustDelta}
                  onChange={e => setAdjustDelta(e.target.value)}
                  aria-label={t('admin.credits.adjustAmountAria')}
                />
                <input
                  className="ac-input"
                  type="text"
                  placeholder={t('admin.credits.notePlaceholder')}
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  aria-label={t('admin.credits.noteAria')}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => void handleAdjust()}
                >
                  {t('admin.credits.apply')}
                </button>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <DataTable
              columns={getCols(t)}
              rows={ledger}
              loading={loading}
              emptyText={t('admin.credits.emptyLedger')}
            />
          </div>
        </>
      )}
    </div>
  )
}
