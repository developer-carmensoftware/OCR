import { useEffect, useRef, useState, useReducer } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Maximize2,
  Pause,
  RotateCw,
  Send,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import ProformaDocument from '../pricing/ProformaDocument'
import DataTable, { type Column } from './DataTable'
import { STAGE_KEY, STAGE_TONE, timeAgo } from './orderHelpers'
import {
  approveOrder,
  fetchAdminOrderDocuments,
  fetchCreditBalance,
  fetchCreditLedger,
  getOrderSlipUrl,
  orderStage,
  updateOrderNote,
  listCreditOrders,
  postArBatch,
  rejectOrder,
  type AdminCreditOrder,
  type CreditLedgerEntry,
} from '../../lib/api/adminClient'
import type { BillingDocument, PaymentInfo } from '../../lib/api/credits'
import { formatThb } from '../../lib/money'
import { useT } from '../../i18n/LanguageContext'

// Reject reasons are shown to the (Thai-default) buyer, so they stay Thai
// regardless of the reviewer's UI language.
const REJECT_PRESETS = [
  'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องชำระ',
  'สลิปไม่ชัดเจน อ่านยอด/รายละเอียดไม่ได้',
  'บัญชีปลายทางไม่ใช่บัญชีของบริษัท',
  'สลิปนี้ถูกใช้ยืนยันการชำระไปแล้ว',
]
const REJECT_OTHER = 'อื่น ๆ (ระบุเหตุผล)'

function fmtDateTime(s: string | null): string {
  return s ? new Date(s).toLocaleString() : '—'
}

function num(v: string | number | null): number {
  return typeof v === 'string' ? Number(v) : (v ?? 0)
}

function slipIsPdf(url: string): boolean {
  return /\.pdf$/i.test(url.split('?')[0])
}

/** Keep the company name when a mutation endpoint returns it null (no Tenant join). */
function withName(updated: AdminCreditOrder, prev: AdminCreditOrder): AdminCreditOrder {
  return {
    ...updated,
    tenant_name: updated.tenant_name ?? prev.tenant_name,
    buyer_name: updated.buyer_name ?? prev.buyer_name,
  }
}

// ── Slip viewer (zoom / pan / rotate for images; native iframe for PDFs) ───────

function SlipViewer({ url, error }: { url: string | null; error: boolean }) {
  const { t } = useT()
  const [scale, setScale] = useState(1)
  const [rot, setRot] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number } | null>(null)

  const reset = () => {
    setScale(1)
    setRot(0)
    setPan({ x: 0, y: 0 })
  }

  if (!url) {
    return (
      <div className="orev-slip-fallback">
        {error ? t('orev.slip.errFallback') : t('orev.slip.loading')}
      </div>
    )
  }

  if (slipIsPdf(url)) {
    return (
      <div className="orev-slip">
        <iframe
          src={url}
          className="orev-slip-frame"
          title={t('orev.slip.heading')}
          sandbox="allow-downloads allow-same-origin"
        />
        <a className="orev-slip-link" href={url} target="_blank" rel="noreferrer">
          <ExternalLink size={13} /> {t('orev.slip.openTab')}
        </a>
      </div>
    )
  }

  return (
    <div className="orev-slip">
      <div className="orev-slip-tools">
        <button
          type="button"
          className="orev-tool"
          onClick={() => setScale(s => Math.min(s + 0.25, 4))}
          aria-label={t('orev.slip.zoomIn')}
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          className="orev-tool"
          onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
          aria-label={t('orev.slip.zoomOut')}
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="orev-tool"
          onClick={() => setRot(r => (r + 90) % 360)}
          aria-label={t('orev.slip.rotate')}
        >
          <RotateCw size={15} />
        </button>
        <button
          type="button"
          className="orev-tool"
          onClick={reset}
          aria-label={t('orev.slip.reset')}
        >
          <Maximize2 size={15} />
        </button>
        <span className="orev-slip-zoom">{Math.round(scale * 100)}%</span>
      </div>
      <div
        className="orev-slip-stage"
        onPointerDown={e => {
          drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={e => {
          if (!drag.current) return
          setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })
        }}
        onPointerUp={() => (drag.current = null)}
        style={{ cursor: scale > 1 ? 'grab' : 'default' }}
      >
        <img
          src={url}
          alt={t('orev.slip.heading')}
          className="orev-slip-img"
          draggable={false}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rot}deg)`,
          }}
        />
      </div>
    </div>
  )
}

// ── Verify facts (display only — admin matches these against the slip) ─────────

function VerifyFacts({
  order,
  proforma,
  paymentInfo,
}: {
  order: AdminCreditOrder
  proforma: BillingDocument | null
  paymentInfo: PaymentInfo | null
}) {
  const { t } = useT()
  const vat = proforma ? num(proforma.vat_amount) : null
  const sub = proforma ? num(proforma.subtotal) : null
  const acct = paymentInfo?.bank_account_no
    ? `${paymentInfo.bank_name} ${paymentInfo.bank_account_no} · ${paymentInfo.bank_account_name}`
    : '—'
  return (
    <div className="orev-verify" aria-label={t('orev.verify.eyebrow')}>
      <span className="orev-verify-eyebrow">{t('orev.verify.eyebrow')}</span>
      <dl className="orev-verify-grid">
        <div>
          <dt>{t('orev.verify.amount')}</dt>
          <dd className="mono">
            ฿{formatThb(order.amount_thb, true)}
            {vat != null && sub != null && (
              <span className="orev-verify-hint">
                {' ('}
                {t('orev.verify.amountHint', {
                  sub: `฿${formatThb(sub, true)}`,
                  vat: `฿${formatThb(vat, true)}`,
                })}
                {')'}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('orev.verify.payTo')}</dt>
          <dd>{acct}</dd>
        </div>
        <div>
          <dt>{t('orev.verify.payer')}</dt>
          <dd>
            {proforma?.buyer_name || '—'}
            {proforma?.buyer_contact_name ? ` · ${proforma.buyer_contact_name}` : ''}
          </dd>
        </div>
        <div>
          <dt>{t('orev.verify.time')}</dt>
          <dd className="mono">
            {t('orev.verify.slipAt', { at: fmtDateTime(order.slip_uploaded_at) })}
            {order.expires_at
              ? ` · ${t('orev.verify.expires', { at: fmtDateTime(order.expires_at) })}`
              : ''}
          </dd>
        </div>
      </dl>
    </div>
  )
}

// ── Contact buyer ─────────────────────────────────────────────────────────────

function ContactBuyer({
  proforma,
  adminNote,
}: {
  proforma: BillingDocument | null
  adminNote: string | null
}) {
  const { t } = useT()
  const email = proforma?.buyer_email ?? ''
  const copy = () => {
    navigator.clipboard
      ?.writeText(email)
      .then(() => toast.success(t('orev.contact.copied')))
      .catch(() => toast.error(t('orev.contact.copyFail')))
  }
  return (
    <div className="orev-contact">
      <span className="orev-verify-eyebrow">{t('orev.contact.eyebrow')}</span>
      <div className="orev-contact-row">
        <span className="orev-contact-name">{proforma?.buyer_name || '—'}</span>
        {proforma?.buyer_contact_name && (
          <span className="orev-contact-person">
            {t('orev.contact.purchaser', { name: proforma.buyer_contact_name })}
          </span>
        )}
      </div>
      {email ? (
        <div className="orev-contact-actions">
          <span className="orev-contact-email mono">{email}</span>
          <a className="btn btn-outline orev-mini" href={`mailto:${email}`}>
            <Mail size={13} /> {t('orev.contact.email')}
          </a>
          <button type="button" className="btn btn-outline orev-mini" onClick={copy}>
            <Copy size={13} /> {t('orev.contact.copy')}
          </button>
        </div>
      ) : (
        <p className="orev-contact-noemail">{t('orev.contact.noEmail')}</p>
      )}
      {adminNote && (
        <p className="orev-note">
          <strong>{t('orev.contact.noteLabel')}</strong> {adminNote}
        </p>
      )}
    </div>
  )
}

// ── Company credits & order history (lazy, collapsible) ───────────────────────

function CompanyPanel({
  tenantId,
  history,
  currentId,
}: {
  tenantId: string
  history: AdminCreditOrder[]
  currentId: string
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const loaded = useRef(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const ledgerCols: Column<CreditLedgerEntry>[] = [
    {
      key: 'created_at',
      label: t('orev.ledger.when'),
      render: r => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'),
    },
    { key: 'reason', label: t('orev.ledger.reason') },
    {
      key: 'delta',
      label: t('orev.ledger.change'),
      align: 'right',
      render: r => (r.delta > 0 ? `+${r.delta}` : String(r.delta)),
    },
    { key: 'balance_after', label: t('orev.ledger.balance'), align: 'right' },
    { key: 'note', label: t('orev.ledger.note'), render: r => r.note ?? r.ref ?? '—' },
  ]

  const load = () => {
    loaded.current = true
    Promise.all([fetchCreditBalance(tenantId), fetchCreditLedger(tenantId)])
      .then(([b, l]) => {
        setBalance(b.balance)
        setLedger(l)
      })
      .catch(e => toast.error((e as Error).message))
  }

  const past = history.filter(o => o.id !== currentId)

  return (
    <details
      className="orev-company"
      open={open}
      onToggle={e => {
        const o = (e.target as HTMLDetailsElement).open
        setOpen(o)
        if (o && !loaded.current) load()
      }}
    >
      <summary className="orev-company-summary">
        <Coins size={15} /> {t('orev.company.summary')}
        {balance != null && (
          <span className="orev-company-bal mono">{t('orev.company.balance', { n: balance })}</span>
        )}
      </summary>

      <div className="orev-company-body">
        <h4 className="orev-subhead">{t('orev.company.history')}</h4>
        {past.length === 0 ? (
          <p className="orev-muted">{t('orev.company.noHistory')}</p>
        ) : (
          <ul className="orev-history">
            {past.map(o => (
              <li key={o.id}>
                <span className={`orev-dot is-${STAGE_TONE[orderStage(o)]}`} aria-hidden="true" />
                <span className="mono">฿{formatThb(o.amount_thb)}</span>
                <span className="orev-muted">{o.pack_code}</span>
                <span className="orev-history-status">{t(STAGE_KEY[orderStage(o)])}</span>
                <span className="orev-muted">{timeAgo(o.created_at, t)}</span>
              </li>
            ))}
          </ul>
        )}

        <h4 className="orev-subhead">{t('orev.company.ledger')}</h4>
        <DataTable columns={ledgerCols} rows={ledger} emptyText={t('orev.company.ledgerEmpty')} />
      </div>
    </details>
  )
}

// ── Action bar (status-aware) ─────────────────────────────────────────────────

interface OrderActionsState {
  mode: 'idle' | 'reject' | 'hold'
  preset: string
  reason: string
  holdNote: string
  confirm: 'approve' | null
}

type OrderActionsAction =
  | { type: 'SET_MODE'; payload: 'idle' | 'reject' | 'hold' }
  | { type: 'SET_PRESET'; payload: string }
  | { type: 'SET_REASON'; payload: string }
  | { type: 'SET_HOLD_NOTE'; payload: string }
  | { type: 'SET_CONFIRM'; payload: 'approve' | null }
  | { type: 'CHOOSE_PRESET'; payload: { preset: string; reason: string } }

function orderActionsReducer(
  state: OrderActionsState,
  action: OrderActionsAction
): OrderActionsState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload }
    case 'SET_PRESET':
      return { ...state, preset: action.payload }
    case 'SET_REASON':
      return { ...state, reason: action.payload }
    case 'SET_HOLD_NOTE':
      return { ...state, holdNote: action.payload }
    case 'SET_CONFIRM':
      return { ...state, confirm: action.payload }
    case 'CHOOSE_PRESET':
      return { ...state, preset: action.payload.preset, reason: action.payload.reason }
    default:
      return state
  }
}

const getInitialOrderActionsState = (): OrderActionsState => ({
  mode: 'idle',
  preset: REJECT_PRESETS[0],
  reason: REJECT_PRESETS[0],
  holdNote: '',
  confirm: null,
})

function OrderActions({
  order,
  busy,
  onApprove,
  onReject,
  onHold,
  onPostAr,
  onMapAr,
}: {
  order: AdminCreditOrder
  busy: boolean
  onApprove: () => void
  onReject: (reason: string) => void
  onHold: (note: string) => void
  onPostAr: () => void
  onMapAr: () => void
}) {
  const { t } = useT()
  const [state, dispatch] = useReducer(orderActionsReducer, null, getInitialOrderActionsState)
  const { mode, preset, reason, holdNote, confirm } = state
  const confirmTimer = useRef<number | undefined>(undefined)

  const arm = (which: 'approve', run: () => void) => {
    if (confirm === which) {
      window.clearTimeout(confirmTimer.current)
      dispatch({ type: 'SET_CONFIRM', payload: null })
      run()
      return
    }
    dispatch({ type: 'SET_CONFIRM', payload: which })
    window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(
      () => dispatch({ type: 'SET_CONFIRM', payload: null }),
      4000
    )
  }

  const choosePreset = (p: string) => {
    dispatch({ type: 'SET_PRESET', payload: p })
    dispatch({ type: 'SET_REASON', payload: p === REJECT_OTHER ? '' : p })
  }

  // Terminal: complete or void — read-only.
  if (order.status === 'complete' || order.status === 'void') {
    return (
      <div className="orev-actions orev-actions--readonly">
        {order.status === 'complete' && (
          <span className="orev-outcome is-ok">
            <Check size={15} /> {t('orev.outcome.complete', { ref: order.carmen_ar_ref || '—' })}
          </span>
        )}
        {order.status === 'void' && (
          <span className="orev-outcome is-bad">
            <X size={15} />{' '}
            {t('orev.outcome.void', {
              reason: order.rejected_reason || t('orev.outcome.noReason'),
            })}
          </span>
        )}
      </div>
    )
  }

  // Paid: approved — now post to Carmen AR (needs a mapped AR code).
  if (order.status === 'paid') {
    const mapped = !!order.carmen_ar_code
    return (
      <div className="orev-actions">
        <span className="orev-outcome is-ok">
          <Check size={15} />{' '}
          {order.approved_by
            ? t('orev.outcome.approvedBy', {
                who: order.approved_by,
                when: fmtDateTime(order.approved_at),
              })
            : t('orev.outcome.approved', { when: fmtDateTime(order.approved_at) })}
        </span>
        {mapped ? (
          <button
            type="button"
            className="btn btn-confirm orev-approve"
            disabled={busy}
            onClick={onPostAr}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}{' '}
            {t('orev.act.postAr')} · {order.carmen_ar_code}
          </button>
        ) : (
          <button type="button" className="btn btn-outline" onClick={onMapAr}>
            <AlertTriangle size={14} /> {t('orev.inv.mapToAr')}
          </button>
        )}
      </div>
    )
  }

  // In-progress: full decision bar (approve / void / cancel).
  if (mode === 'reject') {
    return (
      <div className="orev-actions orev-actions--form">
        <fieldset className="orev-reject">
          <legend className="orev-verify-eyebrow">{t('orev.reject.legend')}</legend>
          <div className="orev-reject-presets">
            {[...REJECT_PRESETS, REJECT_OTHER].map(p => (
              <label key={p} className={`orev-radio${preset === p ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="reject-preset"
                  checked={preset === p}
                  onChange={() => choosePreset(p)}
                />
                {p}
              </label>
            ))}
          </div>
          <textarea
            className="orev-textarea"
            value={reason}
            onChange={e => dispatch({ type: 'SET_REASON', payload: e.target.value })}
            rows={2}
            placeholder={t('orev.reject.detailPh')}
            aria-label={t('orev.reject.detailPh')}
          />
        </fieldset>
        <div className="orev-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'idle' })}
          >
            {t('orev.act.back')}
          </button>
          <button
            type="button"
            className="btn btn-overwrite"
            disabled={busy || !reason.trim()}
            onClick={() => onReject(reason.trim())}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}{' '}
            {t('orev.act.confirmVoid')}
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'hold') {
    return (
      <div className="orev-actions orev-actions--form">
        <label className="orev-field">
          <span className="orev-verify-eyebrow">{t('orev.note.legend')}</span>
          <textarea
            className="orev-textarea"
            value={holdNote}
            onChange={e => dispatch({ type: 'SET_HOLD_NOTE', payload: e.target.value })}
            rows={2}
            placeholder={t('orev.note.ph')}
            aria-label={t('orev.note.legend')}
          />
        </label>
        <div className="orev-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'idle' })}
          >
            {t('orev.act.back')}
          </button>
          <button
            type="button"
            className="btn btn-confirm"
            disabled={busy}
            onClick={() => onHold(holdNote.trim())}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}{' '}
            {t('orev.note.save')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="orev-actions">
      <button
        type="button"
        className="btn btn-outline orev-danger"
        disabled={busy}
        onClick={() => dispatch({ type: 'SET_MODE', payload: 'reject' })}
      >
        <X size={14} /> {t('orev.act.void')}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy}
        onClick={() => dispatch({ type: 'SET_MODE', payload: 'hold' })}
      >
        <Pause size={14} /> {t('orev.note.legend')}
      </button>
      <button
        type="button"
        className={`btn btn-confirm orev-approve${confirm === 'approve' ? ' is-confirming' : ''}`}
        disabled={busy}
        onClick={() => arm('approve', onApprove)}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{' '}
        {confirm === 'approve' ? t('orev.act.confirmApprove') : t('orev.act.approve')}
      </button>
    </div>
  )
}

// ── Workspace orchestrator ────────────────────────────────────────────────────

interface OrderWorkspaceState {
  slipUrl: string | null
  slipErr: boolean
  proforma: BillingDocument | null
  taxInvoice: BillingDocument | null
  docView: 'proforma' | 'tax_invoice'
  history: AdminCreditOrder[]
  busy: boolean
}

type OrderWorkspaceAction =
  | { type: 'RESET'; payload: { orderId: string } }
  | { type: 'SET_SLIP_URL'; payload: string | null }
  | { type: 'SET_SLIP_ERR'; payload: boolean }
  | {
      type: 'SET_DOCUMENTS'
      payload: { proforma: BillingDocument | null; taxInvoice: BillingDocument | null }
    }
  | { type: 'SET_DOC_VIEW'; payload: 'proforma' | 'tax_invoice' }
  | { type: 'SET_HISTORY'; payload: AdminCreditOrder[] }
  | { type: 'SET_BUSY'; payload: boolean }

const initialOrderWorkspaceState: OrderWorkspaceState = {
  slipUrl: null,
  slipErr: false,
  proforma: null,
  taxInvoice: null,
  docView: 'proforma',
  history: [],
  busy: false,
}

function orderWorkspaceReducer(
  state: OrderWorkspaceState,
  action: OrderWorkspaceAction
): OrderWorkspaceState {
  switch (action.type) {
    case 'RESET':
      return {
        ...state,
        slipUrl: null,
        slipErr: false,
        proforma: null,
        taxInvoice: null,
        docView: 'proforma',
      }
    case 'SET_SLIP_URL':
      return { ...state, slipUrl: action.payload }
    case 'SET_SLIP_ERR':
      return { ...state, slipErr: action.payload }
    case 'SET_DOCUMENTS':
      return { ...state, proforma: action.payload.proforma, taxInvoice: action.payload.taxInvoice }
    case 'SET_DOC_VIEW':
      return { ...state, docView: action.payload }
    case 'SET_HISTORY':
      return { ...state, history: action.payload }
    case 'SET_BUSY':
      return { ...state, busy: action.payload }
    default:
      return state
  }
}

export default function OrderWorkspace({
  order,
  paymentInfo,
  onChanged,
  onMapAr,
}: {
  order: AdminCreditOrder
  paymentInfo: PaymentInfo | null
  onChanged: (updated: AdminCreditOrder) => void
  onMapAr: () => void
}) {
  const { t } = useT()
  const [state, dispatch] = useReducer(orderWorkspaceReducer, initialOrderWorkspaceState)
  const { slipUrl, slipErr, proforma, taxInvoice, docView, history, busy } = state

  useEffect(() => {
    dispatch({ type: 'RESET', payload: { orderId: order.id } })

    let alive = true
    getOrderSlipUrl(order.id)
      .then(r => alive && dispatch({ type: 'SET_SLIP_URL', payload: r.signed_url }))
      .catch(() => alive && dispatch({ type: 'SET_SLIP_ERR', payload: true }))
    fetchAdminOrderDocuments(order.id)
      .then(docs => {
        if (!alive) return
        dispatch({
          type: 'SET_DOCUMENTS',
          payload: {
            proforma: docs.find(d => d.doc_type === 'proforma') ?? null,
            taxInvoice: docs.find(d => d.doc_type === 'tax_invoice') ?? null,
          },
        })
      })
      .catch(() => {})
    if (order.tenant_id) {
      listCreditOrders('all', order.tenant_id)
        .then(rows => alive && dispatch({ type: 'SET_HISTORY', payload: rows }))
        .catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [order.id, order.tenant_id, order.status])

  const act = async (fn: () => Promise<AdminCreditOrder>) => {
    dispatch({ type: 'SET_BUSY', payload: true })
    try {
      const updated = withName(await fn(), order)
      onChanged(updated)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      dispatch({ type: 'SET_BUSY', payload: false })
    }
  }

  const company = order.buyer_name || order.tenant_name || '—'
  const priorReject = history.some(o => o.id !== order.id && o.status === 'void')
  const hasSlip = !!order.slip_uploaded_at
  const shownDoc = docView === 'tax_invoice' && taxInvoice ? taxInvoice : proforma

  return (
    <section className="orev-workspace" aria-label={t('orev.title')}>
      <header className="orev-head">
        <div className="orev-head-main">
          <h3 className="orev-company-name">{company}</h3>
          <span className="orev-amount mono">฿{formatThb(order.amount_thb, true)}</span>
          <span className="orev-pack">
            {order.pack_code} · {t('orev.credits', { n: order.credits.toLocaleString() })}
          </span>
        </div>
        <div className="orev-head-meta">
          <span className={`orev-badge is-${STAGE_TONE[orderStage(order)]}`}>
            {t(STAGE_KEY[orderStage(order)])}
          </span>
          {priorReject && (
            <span className="orev-badge is-bad" title={t('orev.priorRejectTitle')}>
              <AlertTriangle size={12} /> {t('orev.priorReject')}
            </span>
          )}
          <span className="orev-head-time mono">
            {t('orev.head.created', { at: fmtDateTime(order.created_at) })}
            {order.slip_uploaded_at
              ? ` · ${t('orev.head.slip', { at: fmtDateTime(order.slip_uploaded_at) })}`
              : ''}
          </span>
        </div>
      </header>

      <VerifyFacts order={order} proforma={proforma} paymentInfo={paymentInfo} />
      <ContactBuyer proforma={proforma} adminNote={order.admin_note} />

      <div className="orev-compare">
        <div className="orev-compare-col">
          <div className="orev-col-head">{t('orev.slip.heading')}</div>
          {hasSlip ? (
            <SlipViewer url={slipUrl} error={slipErr} />
          ) : (
            <div className="orev-slip-fallback">{t('orev.slip.none')}</div>
          )}
        </div>
        <div className="orev-compare-col">
          <div className="orev-col-head">
            <span>{t('orev.doc.heading')}</span>
            {taxInvoice && (
              <div className="orev-doc-toggle">
                <button
                  type="button"
                  className={docView === 'proforma' ? 'is-on' : ''}
                  onClick={() => dispatch({ type: 'SET_DOC_VIEW', payload: 'proforma' })}
                >
                  {t('orev.doc.proforma')}
                </button>
                <button
                  type="button"
                  className={docView === 'tax_invoice' ? 'is-on' : ''}
                  onClick={() => dispatch({ type: 'SET_DOC_VIEW', payload: 'tax_invoice' })}
                >
                  {t('orev.doc.taxInvoice')}
                </button>
              </div>
            )}
          </div>
          <div className="orev-doc-scroll">
            {shownDoc ? (
              <ProformaDocument doc={shownDoc} paymentInfo={paymentInfo} />
            ) : (
              <div className="orev-slip-fallback">{t('orev.doc.loading')}</div>
            )}
          </div>
        </div>
      </div>

      {order.tenant_id && (
        <CompanyPanel tenantId={order.tenant_id} history={history} currentId={order.id} />
      )}

      <div className="orev-actionbar">
        <OrderActions
          key={order.id}
          order={order}
          busy={busy}
          onApprove={() =>
            act(async () => {
              const u = await approveOrder(order.id)
              toast.success(t('orev.toast.approved', { n: order.credits.toLocaleString() }))
              return u
            })
          }
          onReject={reason =>
            act(async () => {
              const u = await rejectOrder(order.id, reason)
              toast.success(t('orev.toast.voided'))
              return u
            })
          }
          onHold={note =>
            act(async () => {
              const u = await updateOrderNote(order.id, note || undefined)
              toast.success(t('orev.toast.noteSaved'))
              return u
            })
          }
          onPostAr={() =>
            act(async () => {
              const { results } = await postArBatch([order.id])
              const r = results[0]
              if (!r?.success) throw new Error(r?.error || 'AR posting failed')
              toast.success(t('orev.toast.posted'))
              return { ...order, status: 'complete', carmen_ar_ref: r.carmen_ar_ref }
            })
          }
          onMapAr={onMapAr}
        />
      </div>
    </section>
  )
}
