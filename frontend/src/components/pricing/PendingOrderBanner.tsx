import { useReducer } from 'react'
import { AlertTriangle, Clock, ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useT } from '../../i18n/LanguageContext'
import CustomModal from '../common/CustomModal'
import ProformaDocument from './ProformaDocument'
import SlipUpload from './SlipUpload'
import {
  cancelOrder,
  getOrderDocuments,
  uploadSlip,
  type BillingDocument,
  type CreditOrder,
  type PaymentInfo,
} from '../../lib/api/credits'
import { catalogName } from '../../constants/billing'
import { formatThb, formatDate } from '../../lib/money'

// ── OrderRow state ────────────────────────────────────────────────────────────

interface RowState {
  open: boolean
  docs: BillingDocument[] | null
  loadingDocs: boolean
  uploading: boolean
  cancelling: boolean
  showCancelModal: boolean
}

type RowAction =
  | { type: 'TOGGLE_OPEN' }
  | { type: 'LOAD_DOCS_START' }
  | { type: 'LOAD_DOCS_DONE'; docs: BillingDocument[] }
  | { type: 'LOAD_DOCS_ERROR' }
  | { type: 'UPLOAD_START' }
  | { type: 'UPLOAD_DONE' }
  | { type: 'CANCEL_START' }
  | { type: 'CANCEL_DONE' }
  | { type: 'SHOW_CANCEL_MODAL'; show: boolean }

const rowInitial: RowState = {
  open: false,
  docs: null,
  loadingDocs: false,
  uploading: false,
  cancelling: false,
  showCancelModal: false,
}

function rowReducer(state: RowState, action: RowAction): RowState {
  switch (action.type) {
    case 'TOGGLE_OPEN':
      return { ...state, open: !state.open }
    case 'LOAD_DOCS_START':
      return { ...state, loadingDocs: true }
    case 'LOAD_DOCS_DONE':
      return { ...state, loadingDocs: false, docs: action.docs }
    case 'LOAD_DOCS_ERROR':
      return { ...state, loadingDocs: false }
    case 'UPLOAD_START':
      return { ...state, uploading: true }
    case 'UPLOAD_DONE':
      return { ...state, uploading: false }
    case 'CANCEL_START':
      return { ...state, showCancelModal: false, cancelling: true }
    case 'CANCEL_DONE':
      return { ...state, cancelling: false }
    case 'SHOW_CANCEL_MODAL':
      return { ...state, showCancelModal: action.show }
    default:
      return state
  }
}

// ── OrderRow component ────────────────────────────────────────────────────────

function OrderRow({
  order,
  onChanged,
  paymentInfo,
}: {
  order: CreditOrder
  onChanged: () => void
  paymentInfo: PaymentInfo | null
}) {
  const { t } = useT()
  const isOnHold = order.status === 'on_hold'
  const isReviewing = !!order.slip_uploaded_at
  const [state, dispatch] = useReducer(rowReducer, rowInitial)
  const { open, docs, loadingDocs, uploading, cancelling, showCancelModal } = state

  const toggle = () => {
    const next = !open
    dispatch({ type: 'TOGGLE_OPEN' })
    if (next && docs === null) {
      dispatch({ type: 'LOAD_DOCS_START' })
      getOrderDocuments(order.id)
        .then(docs => dispatch({ type: 'LOAD_DOCS_DONE', docs }))
        .catch((e: Error) => {
          toast.error(e.message)
          dispatch({ type: 'LOAD_DOCS_ERROR' })
        })
    }
  }

  const handleSlip = async (file: File) => {
    dispatch({ type: 'UPLOAD_START' })
    try {
      await uploadSlip(order.id, file)
      toast.success(t('checkout.slipSubmittedToast'))
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
      throw e
    } finally {
      dispatch({ type: 'UPLOAD_DONE' })
    }
  }

  const doCancel = async () => {
    dispatch({ type: 'CANCEL_START' })
    try {
      await cancelOrder(order.id)
      toast.success(t('order.cancelledToast'))
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      dispatch({ type: 'CANCEL_DONE' })
    }
  }

  return (
    <div className="pending-order">
      <div className="pending-order-head">
        <div className="order-row-id">
          <span className="order-row-name">{catalogName(order.pack_code)}</span>
          <span className="order-row-credits text-mono">
            {order.credits.toLocaleString()} {t('pack.creditsUnit')}
          </span>
        </div>
        <span className="order-row-amount text-mono">฿{formatThb(order.amount_thb)}</span>
        <button
          type="button"
          className="pending-order-toggle"
          onClick={toggle}
          aria-expanded={open}
        >
          {t('order.viewInvoice')}
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      <p className="order-resume-note">
        {isOnHold
          ? t('order.onHoldNote')
          : isReviewing
            ? t('order.reviewingBanner.body')
            : t('order.pendingNote')}
        {!isReviewing && !isOnHold && order.expires_at && (
          <span className="order-expiry-note">
            {' · '}
            {t('order.expires')} {formatDate(order.expires_at)}
          </span>
        )}
      </p>

      {open &&
        (loadingDocs ? (
          <div className="order-docs-loading">
            <Loader2 size={16} className="animate-spin" /> {t('order.loadingDocs')}
          </div>
        ) : docs && docs.length > 0 ? (
          <div className="order-docs">
            {docs.map(doc => (
              <ProformaDocument key={doc.id} doc={doc} paymentInfo={paymentInfo} />
            ))}
          </div>
        ) : null)}

      <div className="pending-order-actions">
        {!isReviewing && <SlipUpload onUpload={handleSlip} uploading={uploading} />}
        <button
          type="button"
          className="btn btn-outline pending-order-cancel"
          onClick={() => dispatch({ type: 'SHOW_CANCEL_MODAL', show: true })}
          disabled={cancelling}
        >
          {cancelling && <Loader2 size={14} className="animate-spin" />} {t('order.cancel')}
        </button>
      </div>

      <CustomModal
        show={showCancelModal}
        type="warning"
        title={t('order.cancel')}
        message={isReviewing ? t('order.cancelReviewConfirm') : t('order.cancelConfirm')}
        confirmText={t('order.cancel')}
        cancelText={t('modal.cancel')}
        onConfirm={doCancel}
        onCancel={() => dispatch({ type: 'SHOW_CANCEL_MODAL', show: false })}
      />
    </div>
  )
}

/**
 * Surfaces open orders (pending / awaiting_review / on_hold) on the catalog page.
 * Pending: upload slip or cancel. Reviewing: view invoice or cancel (with warning).
 * On hold: past its payment window, needs the admin to contact the buyer.
 */
export default function PendingOrderBanner({
  orders,
  onChanged,
  paymentInfo,
}: {
  orders: CreditOrder[]
  onChanged: () => void
  paymentInfo: PaymentInfo | null
}) {
  const { t } = useT()
  if (orders.length === 0) return null

  // on_hold needs the buyer's attention most, so it wins the shared banner head.
  const hasOnHold = orders.some(o => o.status === 'on_hold')
  const hasReviewing = orders.some(o => !!o.slip_uploaded_at)
  const BannerIcon = hasOnHold || hasReviewing ? Clock : AlertTriangle
  const titleKey = hasOnHold
    ? 'order.onHoldBanner.title'
    : hasReviewing
      ? 'order.reviewingBanner.title'
      : 'order.pendingBanner.title'
  const bodyKey = hasOnHold
    ? 'order.onHoldBanner.body'
    : hasReviewing
      ? 'order.reviewingBanner.body'
      : 'order.pendingBanner.body'

  return (
    <div className="order-pending-banner" role="alert">
      <div className="order-pending-banner-head">
        <BannerIcon size={18} className="order-pending-banner-icon" />
        <div>
          <h2 className="order-pending-banner-title">{t(titleKey)}</h2>
          <p className="order-pending-banner-body">{t(bodyKey)}</p>
        </div>
      </div>
      <div className="pending-order-list">
        {orders.map(o => (
          <OrderRow key={o.id} order={o} onChanged={onChanged} paymentInfo={paymentInfo} />
        ))}
      </div>
    </div>
  )
}
