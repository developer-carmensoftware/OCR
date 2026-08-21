import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ShoppingBag, ArrowRight, Loader2, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/common/AppHeader'
import LanguageToggle from '../components/common/LanguageToggle'
import Pager from '../components/common/Pager'
import { useFitRows } from '../hooks/useFitRows'
import { useT } from '../i18n/LanguageContext'
import OrderStatusBadge from '../components/pricing/OrderStatusBadge'
import PendingOrderBanner from '../components/pricing/PendingOrderBanner'
import ProformaDocument from '../components/pricing/ProformaDocument'
import { getUsage, type ActiveSubscription } from '../lib/api/auth'
import { getStoredToken } from '../lib/api/client'
import { useOrderHistory } from '../hooks/credits'
import {
  getOrderDocuments,
  getPaymentInfo,
  type BillingDocument,
  type CreditOrder,
  type PaymentInfo,
} from '../lib/api/credits'
import { catalogName } from '../constants/billing'
import { formatThb } from '../lib/money'
import { formatDate } from '../lib/date'
import '../styles/pages/pricing.css'

function OrderRow({
  order,
  paymentInfo,
  focus = false,
}: {
  order: CreditOrder
  paymentInfo: PaymentInfo | null
  focus?: boolean
}) {
  const { t } = useT()
  const [open, setOpen] = useState(focus)
  const [docs, setDocs] = useState<BillingDocument[] | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const rowRef = useRef<HTMLLIElement>(null)

  const loadDocs = () => {
    if (docs !== null) return
    setLoadingDocs(true)
    getOrderDocuments(order.id)
      // ponytail: accounting issues the real tax invoice; customers only see the proforma.
      // Filtering on display (not dropping the API field) keeps admin/audit views intact.
      .then(all => setDocs(all.filter(d => d.doc_type === 'proforma')))
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoadingDocs(false))
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) loadDocs()
  }

  // Deep-linked from a notification: open, load, scroll into view, flash once.
  useEffect(() => {
    if (!focus) return
    setOpen(true)
    loadDocs()
    rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  return (
    <li ref={rowRef} className={`order-row${focus ? ' order-row--focus' : ''}`}>
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
          {order.status === 'void' && (
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

// The active subscription's license window — answers "when does my plan expire?".
// Reuses the catalog page's usage-strip readout vocabulary (icon + label + mono value)
// so it reads as native; the expiry date is the focal mono stat. period_end comes from
// /usage; top-up-only tenants have no subscription, so nothing renders (credits never expire).
function ActivePlanBanner({ sub }: { sub: ActiveSubscription }) {
  const { t } = useT()
  if (!sub.period_end) return null
  const period = t(sub.billing_period === 'annual' ? 'plan.billingAnnual' : 'plan.billingMonthly')
  return (
    <output className="usage-strip plan-strip">
      <div className="usage-stat">
        <CalendarClock size={15} className="usage-stat-icon" />
        <span className="usage-stat-value">{catalogName(sub.plan_code)}</span>
        <span className="usage-stat-unit">
          {period} · {sub.doc_allowance.toLocaleString()} {t('plan.docsPerMonthSuffix')}
        </span>
      </div>
      <div className="usage-divider" aria-hidden="true" />
      <div className="usage-stat">
        <span className="usage-stat-label">{t('usage.activeUntil')}</span>
        <span className="usage-stat-value text-mono">{formatDate(sub.period_end)}</span>
      </div>
    </output>
  )
}

// The loading placeholders are the REAL boxes with their content hidden (`visibility`
// keeps the geometry), so the skeleton is exactly as tall as what replaces it. A guessed
// pixel height is what made the page jolt: 64px stand-ins for ~83px rows, and a 44px
// stand-in for the plan strip.
function StripSkeleton() {
  return (
    // a plain div, not the banner's <output>: a placeholder must not be a live region
    <div className="usage-strip plan-strip usage-strip--skeleton" aria-hidden="true">
      <div className="usage-stat">
        <CalendarClock size={15} className="usage-stat-icon" />
        <span className="usage-stat-value">&nbsp;</span>
        <span className="usage-stat-unit">&nbsp;</span>
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <li className="order-row orders-skeleton-row" aria-hidden="true">
      <div className="order-row-head">
        <span className="order-timeline">
          <span className="ot-step">
            <span className="ot-dot" />
            <span className="ot-label">&nbsp;</span>
            <span className="ot-date">&nbsp;</span>
          </span>
        </span>
      </div>
    </li>
  )
}

// Mirrors the cap FastAPI enforces on GET /api/v1/credits/orders (422 above it).
const MAX_PAGE = 100

// A notification deep-links as #/pricing/orders?id=<order_id>; pull that id out.
function parseFocusId(): string | null {
  const q = window.location.hash.split('?')[1]
  return q ? new URLSearchParams(q).get('id') : null
}

export default function OrderHistory() {
  const { t } = useT()
  // Page size = however many rows fit above the fold. Measured off `.order-row-head`,
  // the part of a row whose height is fixed — an expanded row is arbitrarily tall.
  // Capped at the backend's /credits/orders limit.
  const [fits, listRef] = useFitRows('.order-row-head', 4)
  const historyLimit = Math.min(fits, MAX_PAGE)
  const {
    openOrders,
    history,
    historyOffset,
    historyTotal,
    setHistoryOffset,
    loading,
    error,
    reload,
  } = useOrderHistory(historyLimit)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [sub, setSub] = useState<ActiveSubscription | null>(null)
  // /usage answers later than the order list, so the strip used to mount after the rows had
  // painted and shove the page down. Both loads now gate one skeleton: the page paints once.
  const [subLoading, setSubLoading] = useState(() => !!getStoredToken())
  const [focusId, setFocusId] = useState(parseFocusId)

  // Re-read the focus id if the hash changes while already on this page.
  useEffect(() => {
    const onHash = () => setFocusId(parseFocusId())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // ponytail: one gate for both fetches. A top-up-only tenant (no subscription) still sees
  // the strip's slot collapse once when /usage comes back empty — cache the last answer per
  // tenant if that ever matters more than the extra storage key.
  const busy = loading || subLoading

  useEffect(() => {
    getPaymentInfo()
      .then(setPaymentInfo)
      .catch(() => setPaymentInfo(null))
    const token = getStoredToken()
    if (token) {
      getUsage(token)
        .then(d => setSub(d.usage.subscription ?? null))
        .catch(() => setSub(null))
        .finally(() => setSubLoading(false))
    }
  }, [])

  return (
    <div className="pricing-page">
      <AppHeader
        moduleName={t('nav.plansCredits')}
        eyebrow="Carmen Cloud · AI Automation"
        backLabel={t('nav.back')}
        onBack={() => {
          window.location.hash = sessionStorage.getItem('pricing:returnTo') || '#/'
        }}
      >
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

      <main className="orders-main" aria-busy={busy}>
        <div className="orders-head">
          <h1 className="orders-title">{t('order.title')}</h1>
          <a className="btn btn-outline orders-buy-link" href="#/pricing">
            {t('order.buyPlan')} <ArrowRight size={14} />
          </a>
        </div>

        {busy ? <StripSkeleton /> : sub && <ActivePlanBanner sub={sub} />}

        <PendingOrderBanner orders={openOrders} onChanged={reload} paymentInfo={paymentInfo} />

        {error ? (
          <div className="pricing-error">{t('order.loadError', { error })}</div>
        ) : busy ? (
          <ul className="order-list" ref={listRef}>
            {Array.from({ length: 3 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </ul>
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
          <>
            <ul className="order-list" ref={listRef}>
              {history.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  paymentInfo={paymentInfo}
                  focus={order.id === focusId}
                />
              ))}
            </ul>
            <Pager
              offset={historyOffset}
              limit={historyLimit}
              total={historyTotal}
              onChange={setHistoryOffset}
            />
          </>
        )}
      </main>
    </div>
  )
}
