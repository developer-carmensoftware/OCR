import { useEffect, useState } from 'react'
import { ChevronDown, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/common/AppHeader'
import LanguageToggle from '../components/common/LanguageToggle'
import { useT } from '../i18n/LanguageContext'
import { OrderStatusBadge, PendingOrderBanner, ProformaDocument } from '../components/pricing'
import { useOrderHistory } from '../hooks/credits'
import {
  getOrderDocuments,
  getPaymentInfo,
  type BillingDocument,
  type CreditOrder,
  type PaymentInfo,
} from '../lib/api/credits'
import { catalogName } from '../constants/billing'
import { formatThb, formatDate } from '../lib/money'
import '../styles/pages/pricing.css'

function OrderRow({ order, paymentInfo }: { order: CreditOrder; paymentInfo: PaymentInfo | null }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<BillingDocument[] | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && docs === null) {
      setLoadingDocs(true)
      getOrderDocuments(order.id)
        // ponytail: accounting issues the real tax invoice; customers only see the proforma.
        // Filtering on display (not dropping the API field) keeps admin/audit views intact.
        .then(all => setDocs(all.filter(d => d.doc_type === 'proforma')))
        .catch((e: Error) => toast.error(e.message))
        .finally(() => setLoadingDocs(false))
    }
  }

  return (
    <li className="order-row">
      <button type="button" className="order-row-head" onClick={toggle} aria-expanded={open}>
        <div className="order-row-id">
          <span className="order-row-name">{catalogName(order.pack_code)}</span>
          <span className="order-row-credits text-mono">
            {order.credits.toLocaleString()} {t('pack.creditsUnit')}
          </span>
        </div>
        <span className="order-timeline">
          {[
            { label: t('order.requestedAt'), date: order.created_at },
            { label: t('order.slipUploadedAt'), date: order.slip_uploaded_at },
            { label: t('order.approvedAt'), date: order.approved_at },
          ].map(step => (
            <span key={step.label} className={`ot-step${step.date ? ' ot-done' : ''}`}>
              <span className="ot-dot" />
              <span className="ot-label">{step.label}</span>
              <span className="ot-date text-mono">{step.date ? formatDate(step.date) : '—'}</span>
            </span>
          ))}
        </span>
        <span className="order-row-amount text-mono">฿{formatThb(order.amount_thb)}</span>
        <OrderStatusBadge status={order.status} />
        <ChevronDown
          size={16}
          className="order-row-chevron"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div className="order-row-body">
          {order.status === 'rejected' && (
            <div className="order-rejected">
              {order.rejected_reason ? (
                <p className="order-rejected-note">
                  <strong>{t('order.rejectedReasonLabel')}</strong> {order.rejected_reason}
                </p>
              ) : (
                <p className="order-rejected-note">{t('order.rejectedNote')}</p>
              )}
              <a className="btn btn-primary order-rebuy" href="#/pricing">
                {t('order.orderAgain')} <ArrowRight size={14} />
              </a>
            </div>
          )}

          {loadingDocs ? (
            <div className="order-docs-loading">
              <Loader2 size={16} className="animate-spin" /> {t('order.loadingDocs')}
            </div>
          ) : docs && docs.length > 0 ? (
            <div className="order-docs">
              {docs.map(doc => (
                <ProformaDocument key={doc.id} doc={doc} paymentInfo={paymentInfo} />
              ))}
            </div>
          ) : docs && docs.length === 0 ? (
            <p className="order-docs-empty">{t('order.noDocs')}</p>
          ) : null}
        </div>
      )}
    </li>
  )
}

export default function OrderHistory() {
  const { t } = useT()
  const { orders, loading, error, reload } = useOrderHistory()
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)

  // Open orders (pending / under review / on hold) go in the action banner; the rest in history.
  const OPEN = new Set(['pending', 'awaiting_review', 'on_hold'])
  const openOrders = orders.filter(o => OPEN.has(o.status))
  const history = orders.filter(o => !OPEN.has(o.status))

  useEffect(() => {
    getPaymentInfo()
      .then(setPaymentInfo)
      .catch(() => setPaymentInfo(null))
  }, [])

  return (
    <div className="pricing-page">
      <AppHeader moduleName={t('nav.plansCredits')} eyebrow="Carmen Cloud · AI Automation">
        <div className="segmented-control" style={{ margin: 0, maxHeight: 36, width: 'auto' }}>
          <button
            type="button"
            className="segmented-btn"
            onClick={() => {
              window.location.hash = '#/pricing'
            }}
          >
            {t('nav.plans')}
          </button>
          <button
            type="button"
            className="segmented-btn active"
            onClick={() => {
              window.location.hash = '#/pricing/orders'
            }}
          >
            {t('nav.history')}
          </button>
          <span
            className="segmented-indicator"
            style={{
              width: 'calc(50% - 4px)',
              left: 'calc(50% + 2px)',
            }}
          />
        </div>
        <LanguageToggle />
      </AppHeader>

      <main className="orders-main">
        <div className="orders-head">
          <h1 className="orders-title">{t('order.title')}</h1>
          <a className="btn btn-outline orders-buy-link" href="#/pricing">
            {t('order.buyPlan')} <ArrowRight size={14} />
          </a>
        </div>

        <PendingOrderBanner orders={openOrders} onChanged={reload} paymentInfo={paymentInfo} />

        {error ? (
          <div className="pricing-error">{t('order.loadError', { error })}</div>
        ) : loading ? (
          <div className="orders-skeleton" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="orders-skeleton-row" />
            ))}
          </div>
        ) : history.length === 0 ? (
          openOrders.length === 0 && (
            <div className="orders-empty">
              <div className="orders-empty-icon">
                <ShoppingBag size={40} strokeWidth={1.5} />
              </div>
              <h2 className="orders-empty-title">{t('order.empty')}</h2>
              <p className="orders-empty-sub">{t('order.emptySub')}</p>
              <a className="btn btn-primary" href="#/pricing">
                {t('order.viewAllPlans')}
              </a>
            </div>
          )
        ) : (
          <ul className="order-list">
            {history.map(order => (
              <OrderRow key={order.id} order={order} paymentInfo={paymentInfo} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
