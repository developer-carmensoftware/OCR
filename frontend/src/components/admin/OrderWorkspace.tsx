import { useEffect, useReducer, useRef, useState } from 'react'
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
import { STAGE_KEY, STAGE_TONE } from './orderConstants'
import { timeAgo } from '../../lib/date'
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
        <iframe src={url} className="orev-slip-frame" title={t('orev.slip.heading')} sandbox="" />
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
  const loadedRef = useRef(false)
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
    loadedRef.current = true
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
        if (o && !loadedRef.current) load()
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

interface ActionsState {
  mode: 'idle' | 'reject' | 'hold'
  preset: string
  reason: string
  holdNote: string
  confirm: 'approve' | null
}

type ActionsAction =
  | { type: 'RESET' }
  | { type: 'SET_MODE'; mode: 'idle' | 'reject' | 'hold' }
  | { type: 'SET_PRESET'; preset: string }
  | { type: 'SET_REASON'; reason: string }
  | { type: 'SET_HOLD_NOTE'; note: string }
  | { type: 'SET_CONFIRM'; confirm: 'approve' | null }
  | { type: 'CHOOSE_PRESET'; preset: string }

const actionsInitial: ActionsState = {
  mode: 'idle',
  preset: REJECT_PRESETS[0],
  reason: REJECT_PRESETS[0],
  holdNote: '',
  confirm: null,
}

function actionsReducer(state: ActionsState, action: ActionsAction): ActionsState {
  switch (action.type) {
    case 'RESET':
      return actionsInitial
    case 'SET_MODE':
      return { ...state, mode: action.mode }
    case 'SET_PRESET':
      return { ...state, preset: action.preset }
    case 'SET_REASON':
      return { ...state, reason: action.reason }
    case 'SET_HOLD_NOTE':
      return { ...state, holdNote: action.note }
    case 'SET_CONFIRM':
      return { ...state, confirm: action.confirm }
    case 'CHOOSE_PRESET':
      return {
        ...state,
        preset: action.preset,
        reason: action.preset === REJECT_OTHER ? '' : action.preset,
      }
    default:
      return state
  }
}

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
  const [state, dispatch] = useReducer(actionsReducer, actionsInitial)
  const { mode, preset, reason, holdNote, confirm } = state
  const confirmTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    dispatch({ type: 'RESET' })
  }, [order.id])

  const arm = (which: 'approve', run: () => void) => {
    if (confirm === which) {
      window.clearTimeout(confirmTimer.current)
      dispatch({ type: 'SET_CONFIRM', confirm: null })
      run()
      return
    }
    dispatch({ type: 'SET_CONFIRM', confirm: which })
    window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(
      () => dispatch({ type: 'SET_CONFIRM', confirm: null }),
      4000
    )
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
                  onChange={() => dispatch({ type: 'CHOOSE_PRESET', preset: p })}
                />
                {p}
              </label>
            ))}
          </div>
          <textarea
            className="orev-textarea"
            aria-label={t('orev.reject.detailPh')}
            value={reason}
            onChange={e => dispatch({ type: 'SET_REASON', reason: e.target.value })}
            rows={2}
            placeholder={t('orev.reject.detailPh')}
          />
        </fieldset>
        <div className="orev-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'idle' })}
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
            onChange={e => dispatch({ type: 'SET_HOLD_NOTE', note: e.target.value })}
            rows={2}
            placeholder={t('orev.note.ph')}
          />
        </label>
        <div className="orev-actions-bar">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => dispatch({ type: 'SET_MODE', mode: 'idle' })}
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
        onClick={() => dispatch({ type: 'SET_MODE', mode: 'reject' })}
      >
        <X size={14} /> {t('orev.act.void')}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        disabled={busy}
        onClick={() => dispatch({ type: 'SET_MODE', mode: 'hold' })}
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

interface WsState {
  slipUrl: string | null
  slipErr: boolean
  proforma: BillingDocument | null
  history: AdminCreditOrder[]
  busy: boolean
}

type WsAction =
  | { type: 'RESET' }
  | { type: 'SET_SLIP_URL'; url: string }
  | { type: 'SET_SLIP_ERR' }
  | { type: 'SET_DOCS'; proforma: BillingDocument | null }
  | { type: 'SET_HISTORY'; history: AdminCreditOrder[] }
  | { type: 'SET_BUSY'; busy: boolean }

const wsInitial: WsState = {
  slipUrl: null,
  slipErr: false,
  proforma: null,
  history: [],
  busy: false,
}

function wsReducer(state: WsState, action: WsAction): WsState {
  switch (action.type) {
    case 'RESET':
      return { ...wsInitial, busy: state.busy }
    case 'SET_SLIP_URL':
      return { ...state, slipUrl: action.url }
    case 'SET_SLIP_ERR':
      return { ...state, slipErr: true }
    case 'SET_DOCS':
      return { ...state, proforma: action.proforma }
    case 'SET_HISTORY':
      return { ...state, history: action.history }
    case 'SET_BUSY':
      return { ...state, busy: action.busy }
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
  const [state, dispatch] = useReducer(wsReducer, wsInitial)
  const { slipUrl, slipErr, proforma, history, busy } = state

  useEffect(() => {
    dispatch({ type: 'RESET' })

    let alive = true
    getOrderSlipUrl(order.id)
      .then(r => alive && dispatch({ type: 'SET_SLIP_URL', url: r.signed_url }))
      .catch(() => alive && dispatch({ type: 'SET_SLIP_ERR' }))
    fetchAdminOrderDocuments(order.id)
      .then(docs => {
        if (!alive) return
        dispatch({
          type: 'SET_DOCS',
          proforma: docs.find(d => d.doc_type === 'proforma') ?? null,
        })
      })
      .catch(() => {})
    if (order.tenant_id) {
      listCreditOrders('all', order.tenant_id)
        .then(rows => alive && dispatch({ type: 'SET_HISTORY', history: rows }))
        .catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [order.id, order.tenant_id, order.status])

  const act = async (fn: () => Promise<AdminCreditOrder>) => {
    dispatch({ type: 'SET_BUSY', busy: true })
    try {
      const updated = withName(await fn(), order)
      onChanged(updated)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      dispatch({ type: 'SET_BUSY', busy: false })
    }
  }

  const company = order.buyer_name || order.tenant_name || '—'
  const priorReject = history.some(o => o.id !== order.id && o.status === 'void')
  const hasSlip = !!order.slip_uploaded_at

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
          </div>
          <div className="orev-doc-scroll">
            {proforma ? (
              <ProformaDocument doc={proforma} paymentInfo={paymentInfo} />
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
