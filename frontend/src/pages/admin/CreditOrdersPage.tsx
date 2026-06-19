import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, ExternalLink, Loader2, X } from 'lucide-react'
import DataTable, { type Column } from '../../components/admin/DataTable'
import ProformaDocument from '../../components/pricing/ProformaDocument'
import {
  approveOrder,
  fetchAdminOrderDocuments,
  fetchAdminPaymentInfo,
  getOrderSlipUrl,
  listCreditOrders,
  rejectOrder,
  type AdminCreditOrder,
} from '../../lib/api/adminClient'
import type { BillingDocument, PaymentInfo } from '../../lib/api/credits'
import { formatThb } from '../../lib/money'
import '../../styles/pages/pricing.css'
import '../../styles/components/admin-credit-orders.css'

function fmtDate(s: string | null): string {
  return s ? new Date(s).toLocaleString() : '—'
}

function slipExt(url: string): string {
  return (
    url
      .split('?')[0]
      .match(/\.(\w+)$/)?.[1]
      ?.toLowerCase() ?? ''
  )
}

/** Inline review panel shown below the expanded table row. */
function ReviewPanel({ order, onDone }: { order: AdminCreditOrder; onDone: () => void }) {
  const [slipUrl, setSlipUrl] = useState<string | null>(null)
  const [slipErr, setSlipErr] = useState(false)
  const [proforma, setProforma] = useState<BillingDocument | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    getOrderSlipUrl(order.id)
      .then(r => setSlipUrl(r.signed_url))
      .catch(() => setSlipErr(true))
    fetchAdminOrderDocuments(order.id)
      .then(docs => setProforma(docs.find(d => d.doc_type === 'proforma') ?? null))
      .catch(() => {})
    fetchAdminPaymentInfo()
      .then(setPaymentInfo)
      .catch(() => {})
  }, [order.id])

  const doApprove = async () => {
    setBusy(true)
    try {
      await approveOrder(order.id)
      toast.success(`Approved — ${order.credits.toLocaleString()} credits granted`)
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  const doReject = async () => {
    if (!reason.trim()) {
      toast.error('Enter a rejection reason')
      return
    }
    setBusy(true)
    try {
      await rejectOrder(order.id, reason.trim())
      toast.success('Order rejected')
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  const isPdf = slipUrl ? slipExt(slipUrl) === 'pdf' : false

  return (
    <div className="aco-panel">
      <div className="aco-body">
        {/* Left: proforma */}
        <div className="aco-col aco-col--doc">
          {proforma ? (
            <ProformaDocument doc={proforma} paymentInfo={paymentInfo} />
          ) : (
            <div className="aco-slip-fallback">Loading invoice…</div>
          )}
        </div>

        {/* Right: slip */}
        <div className="aco-col aco-col--slip">
          <div className="aco-slip-label">Payment Slip</div>
          {slipUrl && !slipErr ? (
            isPdf ? (
              <iframe src={slipUrl} className="aco-slip-frame" title="Payment slip" />
            ) : (
              <img
                src={slipUrl}
                alt="Payment slip"
                className="aco-slip-img"
                onError={() => setSlipErr(true)}
              />
            )
          ) : (
            <div className="aco-slip-fallback">
              {slipErr ? 'Preview unavailable — open in new tab.' : 'Loading slip…'}
            </div>
          )}
          {slipUrl && (
            <a className="aco-slip-link" href={slipUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Open full slip in new tab
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      {rejecting ? (
        <div className="aco-reject">
          <label className="aco-reject-label" htmlFor={`reason-${order.id}`}>
            Rejection reason (shown to the tenant)
          </label>
          <textarea
            id={`reason-${order.id}`}
            className="aco-reason-input"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Slip amount doesn't match the order total"
            autoFocus
          />
          <div className="aco-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setRejecting(false)}
              disabled={busy}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-confirm aco-danger"
              onClick={doReject}
              disabled={busy}
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Confirm reject
            </button>
          </div>
        </div>
      ) : (
        <div className="aco-actions">
          <button
            type="button"
            className="btn btn-outline aco-danger"
            onClick={() => setRejecting(true)}
            disabled={busy}
          >
            <X size={14} /> Reject
          </button>
          <button type="button" className="btn btn-confirm" onClick={doApprove} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
          </button>
        </div>
      )}
    </div>
  )
}

export default function CreditOrdersPage() {
  const [orders, setOrders] = useState<AdminCreditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setExpandedId(null)
    listCreditOrders('awaiting_review')
      .then(setOrders)
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const cols: Column<AdminCreditOrder>[] = [
    {
      key: 'tenant_name',
      label: 'Tenant',
      sortable: true,
      render: r => r.tenant_name ?? r.tenant_id?.slice(0, 8) ?? '—',
    },
    { key: 'pack_code', label: 'Pack' },
    {
      key: 'credits',
      label: 'Credits',
      align: 'right',
      render: r => r.credits.toLocaleString(),
    },
    {
      key: 'amount_thb',
      label: 'Amount',
      align: 'right',
      render: r => `฿${formatThb(r.amount_thb)}`,
    },
    {
      key: 'slip_uploaded_at',
      label: 'Slip uploaded',
      sortable: true,
      render: r => fmtDate(r.slip_uploaded_at),
    },
    {
      key: 'review',
      label: '',
      align: 'right',
      render: r => (
        <button
          type="button"
          className="btn btn-outline aco-review-btn"
          onClick={() => setExpandedId(prev => (prev === r.id ? null : r.id))}
        >
          {expandedId === r.id ? 'Close' : 'Review'}
        </button>
      ),
    },
  ]

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h2 className="admin-page-title">Slip Review</h2>
        <div className="admin-page-controls">
          <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-card">
        <DataTable
          columns={cols}
          rows={orders}
          loading={loading}
          emptyText="No slips awaiting review"
          expandedRowId={expandedId}
          renderExpandedRow={order => <ReviewPanel order={order} onDone={load} />}
        />
      </div>
    </div>
  )
}
