import { useState } from 'react'
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
import { formatThb } from '../../lib/money'

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
  const isReviewing = order.status === 'awaiting_review'
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<BillingDocument[] | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && docs === null) {
      setLoadingDocs(true)
      getOrderDocuments(order.id)
        .then(setDocs)
        .catch((e: Error) => toast.error(e.message))
        .finally(() => setLoadingDocs(false))
    }
  }

  const handleSlip = async (file: File) => {
    setUploading(true)
    try {
      await uploadSlip(order.id, file)
      toast.success(t('checkout.slipSubmittedToast'))
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
      throw e
    } finally {
      setUploading(false)
    }
  }

  const doCancel = async () => {
    setShowCancelModal(false)
    setCancelling(true)
    try {
      await cancelOrder(order.id)
      toast.success(t('order.cancelledToast'))
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCancelling(false)
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
        {isReviewing ? t('order.reviewingBanner.body') : t('order.pendingNote')}
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
          onClick={() => setShowCancelModal(true)}
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
        onCancel={() => setShowCancelModal(false)}
      />
    </div>
  )
}

/**
 * Surfaces open orders (pending + awaiting_review) on the catalog page.
 * Pending: upload slip or cancel. Reviewing: view invoice or cancel (with warning).
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

  const hasReviewing = orders.some(o => o.status === 'awaiting_review')
  const BannerIcon = hasReviewing ? Clock : AlertTriangle

  return (
    <div className="order-pending-banner" role="alert">
      <div className="order-pending-banner-head">
        <BannerIcon size={18} className="order-pending-banner-icon" />
        <div>
          <h2 className="order-pending-banner-title">
            {hasReviewing ? t('order.reviewingBanner.title') : t('order.pendingBanner.title')}
          </h2>
          <p className="order-pending-banner-body">
            {hasReviewing ? t('order.reviewingBanner.body') : t('order.pendingBanner.body')}
          </p>
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
