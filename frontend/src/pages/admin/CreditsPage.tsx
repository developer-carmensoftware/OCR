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

// Mirrors the active top-up credit_packs catalog (see migration 219).
const PACKS = [
  { code: 'pack_small', label: '500 credits — ฿1,200' },
  { code: 'pack_medium', label: '2,500 credits — ฿5,000' },
  { code: 'pack_large', label: '10,000 credits — ฿15,000' },
]

const COLS: Column<CreditLedgerEntry>[] = [
  {
    key: 'created_at',
    label: 'When',
    sortable: true,
    render: r => (r.created_at ? new Date(r.created_at).toLocaleString() : '—'),
  },
  { key: 'reason', label: 'Reason', sortable: true },
  {
    key: 'delta',
    label: 'Change',
    sortable: true,
    align: 'right',
    render: r => (r.delta > 0 ? `+${r.delta}` : String(r.delta)),
  },
  { key: 'balance_after', label: 'Balance', sortable: true, align: 'right' },
  { key: 'pack_code', label: 'Pack', render: r => r.pack_code ?? '—' },
  { key: 'note', label: 'Note', render: r => r.note ?? r.ref ?? '—' },
]

export default function CreditsPage() {
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
      .catch(e => toast.error(`Credits: ${e?.message ?? 'failed to load'}`))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [tenantId])

  const handleTopup = async () => {
    setBusy(true)
    try {
      const b = await topupCredits(tenantId, packCode)
      setBalance(b.balance)
      toast.success(`Topped up — balance ${b.balance}`)
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
      toast.error('Enter a non-zero amount')
      return
    }
    setBusy(true)
    try {
      const b = await adjustCredits(tenantId, delta, adjustNote || undefined)
      setBalance(b.balance)
      setAdjustDelta('')
      setAdjustNote('')
      toast.success(`Adjusted — balance ${b.balance}`)
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
        <h2 className="admin-page-title">Credits</h2>
        <div className="admin-page-controls">
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>
      </div>

      {!tenantId ? (
        <div className="admin-card ac-empty">Select a tenant to manage top-up credits.</div>
      ) : (
        <>
          <div className="ac-grid">
            <div className="admin-card ac-balance-card">
              <span className="ac-balance-label">
                <Coins size={14} /> Top-up balance
              </span>
              <span className="ac-balance-value">{balance ?? '—'}</span>
            </div>

            <div className="admin-card ac-action-card">
              <h3 className="ac-action-title">Top up a pack</h3>
              <div className="ac-row">
                <select
                  className="ac-input"
                  value={packCode}
                  onChange={e => setPackCode(e.target.value)}
                  aria-label="Credit pack"
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
                  Grant
                </button>
              </div>
            </div>

            <div className="admin-card ac-action-card">
              <h3 className="ac-action-title">Manual adjust</h3>
              <div className="ac-row">
                <input
                  className="ac-input ac-input--num"
                  type="number"
                  placeholder="±credits"
                  value={adjustDelta}
                  onChange={e => setAdjustDelta(e.target.value)}
                  aria-label="Adjustment amount"
                />
                <input
                  className="ac-input"
                  type="text"
                  placeholder="Note (optional)"
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  aria-label="Adjustment note"
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={() => void handleAdjust()}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="admin-card">
            <DataTable
              columns={COLS}
              rows={ledger}
              loading={loading}
              emptyText="No credit history yet"
            />
          </div>
        </>
      )}
    </div>
  )
}
