import { useState } from 'react'
import { ChevronDown, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import AppHeader from '../components/common/AppHeader'
import { OrderStatusBadge, ProformaDocument, SlipUpload } from '../components/pricing'
import { useOrderHistory } from '../hooks/credits'
import {
  getOrderDocuments,
  uploadSlip,
  type BillingDocument,
  type CreditOrder,
} from '../lib/api/credits'
import { catalogName } from '../constants/billing'
import { formatThb } from '../lib/money'
import '../styles/pages/pricing.css'

function OrderRow({ order, onChanged }: { order: CreditOrder; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState<BillingDocument[] | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(false)

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
      toast.success('Slip submitted — our team will review it shortly')
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
      throw e
    } finally {
      setUploading(false)
    }
  }

  return (
    <li className="order-row">
      <button type="button" className="order-row-head" onClick={toggle} aria-expanded={open}>
        <div className="order-row-id">
          <span className="order-row-name">{catalogName(order.pack_code)}</span>
          <span className="order-row-credits text-mono">
            {order.credits.toLocaleString()} credits
          </span>
        </div>
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
          {order.status === 'pending' && (
            <div className="order-resume">
              <p className="order-resume-note">
                No slip uploaded yet. If you've already paid, upload the slip for our team to
                review.
              </p>
              <SlipUpload onUpload={handleSlip} uploading={uploading} />
            </div>
          )}

          {order.status === 'rejected' && (
            <div className="order-rejected">
              <p className="order-rejected-note">
                This slip didn't pass review. Please place a new order.
              </p>
              <a className="btn btn-primary order-rebuy" href="#/pricing">
                Order again <ArrowRight size={14} />
              </a>
            </div>
          )}

          {loadingDocs ? (
            <div className="order-docs-loading">
              <Loader2 size={16} className="animate-spin" /> Loading documents…
            </div>
          ) : docs && docs.length > 0 ? (
            <div className="order-docs">
              {docs.map(doc => (
                <ProformaDocument key={doc.id} doc={doc} />
              ))}
            </div>
          ) : docs && docs.length === 0 ? (
            <p className="order-docs-empty">No documents for this order yet</p>
          ) : null}
        </div>
      )}
    </li>
  )
}

export default function OrderHistory() {
  const { orders, loading, error, reload } = useOrderHistory()

  return (
    <div className="pricing-page">
      <AppHeader moduleName="Order History" eyebrow="Carmen Cloud · OCR Module" />

      <main className="orders-main">
        <div className="orders-head">
          <h1 className="orders-title">Order history</h1>
          <a className="btn btn-outline orders-buy-link" href="#/pricing">
            Buy a plan <ArrowRight size={14} />
          </a>
        </div>

        {error ? (
          <div className="pricing-error">Failed to load history: {error}</div>
        ) : loading ? (
          <div className="orders-skeleton" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="orders-skeleton-row" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="orders-empty">
            <div className="orders-empty-icon">
              <ShoppingBag size={40} strokeWidth={1.5} />
            </div>
            <h2 className="orders-empty-title">No orders yet</h2>
            <p className="orders-empty-sub">
              Pick a monthly plan or top up credits to keep working past your free quota.
            </p>
            <a className="btn btn-primary" href="#/pricing">
              View all plans
            </a>
          </div>
        ) : (
          <ul className="order-list">
            {orders.map(order => (
              <OrderRow key={order.id} order={order} onChanged={reload} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
