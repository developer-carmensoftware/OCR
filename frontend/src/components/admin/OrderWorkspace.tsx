import { useEffect, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, Coins, Copy } from 'lucide-react'
import ProformaDocument from '../pricing/ProformaDocument'
import DataTable, { type Column } from './DataTable'
import { STAGE_KEY, STAGE_TONE, timeAgo } from '../../lib/orderHelpers'
import { SlipViewer } from './SlipViewer'
import { OrderActions, fmtDateTime } from './OrderActions'
import { useOrderActions } from '../../hooks/admin'
import {
  fetchAdminOrderDocuments,
  fetchCreditBalance,
  fetchCreditLedger,
  getOrderSlipUrl,
  orderStage,
  listCreditOrders,
  type AdminCreditOrder,
  type CreditLedgerEntry,
} from '../../lib/api/adminClient'
import type { BillingDocument, PaymentInfo } from '../../lib/api/credits'
import { formatThb } from '../../lib/money'
import { useT } from '../../i18n/LanguageContext'

function num(v: string | number | null): number {
  return typeof v === 'string' ? Number(v) : (v ?? 0)
}

// ── Loading skeletons (mirror the real slip viewer + proforma document) ────────

function DocSkeleton() {
  return (
    <div className="orev-docsk" aria-hidden="true">
      <div className="orev-docsk-head">
        <span className="skeleton orev-docsk-logo" />
        <div className="orev-docsk-seller">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="skeleton orev-docsk-line" />
          ))}
        </div>
      </div>
      <span className="skeleton orev-docsk-banner" />
      <div className="orev-docsk-grid">
        {Array.from({ length: 2 }).map((_, c) => (
          <div key={c} className="orev-docsk-card">
            <span className="skeleton orev-docsk-cardtitle" />
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="skeleton orev-docsk-line" />
            ))}
          </div>
        ))}
      </div>
      <div className="orev-docsk-table">
        <span className="skeleton orev-docsk-thead" />
        <span className="skeleton orev-docsk-trow" />
        <span className="skeleton orev-docsk-trow" />
      </div>
      <div className="orev-docsk-totals">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="skeleton orev-docsk-totalrow" />
        ))}
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
            {proforma?.buyer_tel ? ` · ${proforma.buyer_tel}` : ''}
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
  const tel = proforma?.buyer_tel ?? ''
  // Which field just got copied — flashes its button to a checkmark for a beat,
  // on top of (not instead of) the toast, so the confirmation lands right at the
  // point of the click as well as in the corner of the screen.
  const [copiedField, setCopiedField] = useState<'email' | 'tel' | null>(null)
  const copiedTimer = useRef<number | undefined>(undefined)
  const copy = (field: 'email' | 'tel', value: string, message: string) => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        toast.success(message)
        setCopiedField(field)
        window.clearTimeout(copiedTimer.current)
        copiedTimer.current = window.setTimeout(() => setCopiedField(null), 1400)
      })
      .catch(() => toast.error(t('orev.contact.copyFail')))
  }
  return (
    <div className="orev-contact">
      <span className="orev-verify-eyebrow">{t('orev.contact.eyebrow')}</span>
      {!proforma ? (
        <div className="orev-contact-sk" aria-hidden="true">
          <span className="skeleton orev-contact-sk-name" />
          <div className="orev-contact-sk-actions">
            <span className="skeleton orev-contact-sk-email" />
            <span className="skeleton orev-contact-sk-btn" />
          </div>
          <div className="orev-contact-sk-actions">
            <span className="skeleton orev-contact-sk-email orev-contact-sk-email--sm" />
            <span className="skeleton orev-contact-sk-btn" />
          </div>
        </div>
      ) : (
        <>
          <div className="orev-contact-row">
            <span className="orev-contact-name">{proforma.buyer_name || '—'}</span>
            {proforma.buyer_contact_name && (
              <span className="orev-contact-person">
                {t('orev.contact.purchaser', { name: proforma.buyer_contact_name })}
              </span>
            )}
          </div>
          {email ? (
            <div className="orev-contact-actions">
              <span className="orev-contact-email mono">{email}</span>
              <button
                type="button"
                className={`orev-copy-btn${copiedField === 'email' ? ' is-copied' : ''}`}
                onClick={() => copy('email', email, t('orev.contact.copied'))}
                aria-label={t('orev.contact.copyEmailAria')}
                title={t('orev.contact.copy')}
              >
                {copiedField === 'email' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          ) : (
            <p className="orev-contact-noemail">{t('orev.contact.noEmail')}</p>
          )}
          {tel && (
            <div className="orev-contact-actions">
              <span className="orev-contact-email mono">{tel}</span>
              <button
                type="button"
                className={`orev-copy-btn${copiedField === 'tel' ? ' is-copied' : ''}`}
                onClick={() => copy('tel', tel, t('orev.contact.telCopied'))}
                aria-label={t('orev.contact.copyTelAria')}
                title={t('orev.contact.copy')}
              >
                {copiedField === 'tel' ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}
        </>
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

// ── Workspace orchestrator ────────────────────────────────────────────────────

interface WsState {
  slipUrl: string | null
  slipErr: boolean
  proforma: BillingDocument | null
  history: AdminCreditOrder[]
}

type WsAction =
  | { type: 'RESET' }
  | { type: 'SET_SLIP_URL'; url: string }
  | { type: 'SET_SLIP_ERR' }
  | { type: 'SET_DOCS'; proforma: BillingDocument | null }
  | { type: 'SET_HISTORY'; history: AdminCreditOrder[] }

const wsInitial: WsState = {
  slipUrl: null,
  slipErr: false,
  proforma: null,
  history: [],
}

function wsReducer(state: WsState, action: WsAction): WsState {
  switch (action.type) {
    case 'RESET':
      return wsInitial
    case 'SET_SLIP_URL':
      return { ...state, slipUrl: action.url }
    case 'SET_SLIP_ERR':
      return { ...state, slipErr: true }
    case 'SET_DOCS':
      return { ...state, proforma: action.proforma }
    case 'SET_HISTORY':
      return { ...state, history: action.history }
    default:
      return state
  }
}

export default function OrderWorkspace({
  order,
  paymentInfo,
  onChanged,
  onMapAr,
  onPostOne,
  posting,
}: {
  order: AdminCreditOrder
  paymentInfo: PaymentInfo | null
  onChanged: (updated: AdminCreditOrder) => void
  onMapAr: () => void
  /** Shared posting function (page-level) — same one the table's inline Post and
   *  batch bar use, so there is exactly one "post to AR" implementation. */
  onPostOne: (order: AdminCreditOrder) => void
  posting: boolean
}) {
  const { t } = useT()
  const [state, dispatch] = useReducer(wsReducer, wsInitial)
  const { slipUrl, slipErr, proforma, history } = state
  const { busy, onApprove, onReject, onHold } = useOrderActions(order, onChanged)

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
              <DocSkeleton />
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
          busy={busy || posting}
          onApprove={onApprove}
          onReject={onReject}
          onHold={onHold}
          onPostAr={() => onPostOne(order)}
          onMapAr={onMapAr}
        />
      </div>
    </section>
  )
}
