import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronDown, CheckCircle2, ShieldCheck, Loader2, ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import StepWizard from '../common/StepWizard'
import PromptPayQR from './PromptPayQR'
import ProformaDocument from './ProformaDocument'
import SlipUpload from './SlipUpload'
import { useCheckout, type CheckoutSession } from '../../hooks/credits'
import { PLAN_META, PACK_META } from '../../constants/billing'
import { formatThb } from '../../lib/money'
import type { BuyerInfo, CreditPack } from '../../lib/api/credits'

const STEPS = [
  { n: 1, label: 'Billing info' },
  { n: 2, label: 'Payment' },
  { n: 3, label: 'Done' },
]

function itemName(code: string): string {
  return PLAN_META[code]?.name ?? PACK_META[code]?.name ?? code
}

interface Props {
  pack: CreditPack | null
  resume?: CheckoutSession | null
  onCancel: () => void
  onViewHistory: () => void
}

const SOURCE_LABEL: Record<string, string> = {
  carmen: 'From Carmen',
  last_invoice: 'From last invoice',
  form: '',
}

export default function CheckoutFlow({ pack, resume, onCancel, onViewHistory }: Props) {
  const c = useCheckout(pack, resume)
  const [showDoc, setShowDoc] = useState(false)

  const stepNum = c.phase === 'buyer' ? 1 : c.phase === 'pay' ? 2 : 3
  const code = pack?.code ?? c.session?.pack_code ?? ''
  const credits = pack?.credits ?? c.session?.credits ?? 0
  const amount = pack?.price_thb ?? c.session?.amount_thb ?? 0
  const isSubscription = !!PLAN_META[code]

  const updateBuyer = (patch: Partial<BuyerInfo>) => c.setBuyer({ ...c.buyer, ...patch })

  const handleConfirm = async () => {
    try {
      await c.confirmBuyer()
    } catch {
      toast.error(c.error || 'Could not create the order')
    }
  }

  const handleSlip = async (file: File) => {
    await c.submitSlip(file)
    toast.success('Slip submitted — our team will review it shortly')
  }

  return (
    <div className="checkout">
      <button type="button" className="checkout-back" onClick={onCancel}>
        <ArrowLeft size={15} /> Back to plans
      </button>

      <StepWizard step={stepNum} steps={STEPS} />

      <motion.div
        key={c.phase}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="checkout-body"
      >
        {c.phase === 'buyer' && (
          <div className="checkout-grid">
            <div className="panel-card checkout-form">
              <div className="checkout-form-head">
                <h3 className="checkout-section-title">
                  Billing information (for the tax invoice)
                </h3>
                {c.profileSource && SOURCE_LABEL[c.profileSource] && (
                  <span className="checkout-source-badge">
                    <ShieldCheck size={12} /> {SOURCE_LABEL[c.profileSource]}
                  </span>
                )}
              </div>

              {c.loadingProfile ? (
                <div className="checkout-form-skeleton" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="checkout-skel-field" />
                  ))}
                </div>
              ) : (
                <div className="checkout-fields">
                  <label className="checkout-field">
                    <span className="checkout-field-label">Company / buyer name</span>
                    <input
                      className="checkout-input"
                      value={c.buyer.name}
                      onChange={e => updateBuyer({ name: e.target.value })}
                      placeholder="e.g. Example Co., Ltd."
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">Tax ID</span>
                    <input
                      className="checkout-input text-mono"
                      value={c.buyer.tax_id}
                      onChange={e => updateBuyer({ tax_id: e.target.value })}
                      placeholder="0000000000000"
                      inputMode="numeric"
                    />
                  </label>
                  <label className="checkout-field checkout-field--wide">
                    <span className="checkout-field-label">Address</span>
                    <input
                      className="checkout-input"
                      value={c.buyer.address}
                      onChange={e => updateBuyer({ address: e.target.value })}
                      placeholder="Billing address for the tax invoice"
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">Branch</span>
                    <input
                      className="checkout-input"
                      value={c.buyer.branch}
                      onChange={e => updateBuyer({ branch: e.target.value })}
                      placeholder="Head office"
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">Email</span>
                    <input
                      className="checkout-input"
                      type="email"
                      value={c.buyer.email}
                      onChange={e => updateBuyer({ email: e.target.value })}
                      placeholder="billing@example.com"
                    />
                  </label>
                </div>
              )}
            </div>

            <aside className="checkout-summary">
              <h4 className="checkout-summary-title">Order summary</h4>
              <div className="checkout-summary-row">
                <span>{itemName(code)}</span>
                <span className="text-mono">{credits.toLocaleString()} credits</span>
              </div>
              <div className="checkout-summary-row checkout-summary-kind">
                <span>{isSubscription ? 'Monthly plan' : 'Top-up credits (never expire)'}</span>
              </div>
              <div className="checkout-summary-total">
                <span>Total due</span>
                <span className="text-mono">฿{formatThb(amount, true)}</span>
              </div>
              <p className="checkout-vat-note">Prices include 7% VAT</p>
              <button
                type="button"
                className="btn btn-primary checkout-confirm"
                onClick={handleConfirm}
                disabled={c.creating || c.loadingProfile || !c.buyer.name.trim()}
              >
                {c.creating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Creating order…
                  </>
                ) : (
                  'Continue to payment'
                )}
              </button>
              {!c.buyer.name.trim() && !c.loadingProfile && (
                <p className="checkout-hint">Enter the buyer name to continue</p>
              )}
            </aside>
          </div>
        )}

        {c.phase === 'pay' && c.session && (
          <div className="checkout-pay">
            <div className="panel-card checkout-pay-card">
              <div className="checkout-pay-head">
                <ScanLine size={18} className="checkout-pay-head-icon" />
                <div>
                  <h3 className="checkout-section-title">Scan to pay with PromptPay</h3>
                  <p className="checkout-pay-sub">
                    Open your banking app, scan the QR, transfer the exact amount, then upload the
                    slip below.
                  </p>
                </div>
              </div>
              <PromptPayQR qr={c.session.qr} />
            </div>

            <div className="panel-card checkout-slip-card">
              <h3 className="checkout-section-title">Confirm payment</h3>
              <p className="checkout-pay-sub">
                Upload your transfer slip. We'll verify it and add the credits within one business
                day.
              </p>
              <SlipUpload onUpload={handleSlip} uploading={c.uploading} />

              <button
                type="button"
                className="checkout-doc-toggle"
                onClick={() => setShowDoc(v => !v)}
                aria-expanded={showDoc}
              >
                <ChevronDown
                  size={15}
                  style={{
                    transform: showDoc ? 'rotate(180deg)' : 'none',
                    transition: 'transform .2s',
                  }}
                />
                {showDoc ? 'Hide invoice' : 'View invoice (Proforma)'}
              </button>
              {showDoc && <ProformaDocument doc={c.session.proforma} />}
            </div>
          </div>
        )}

        {c.phase === 'done' && (
          <div className="checkout-done">
            <div className="checkout-done-icon">
              <CheckCircle2 size={48} strokeWidth={1.5} />
            </div>
            <h3 className="checkout-done-title">Slip submitted</h3>
            <p className="checkout-done-sub">
              Your order is under review. Once payment is verified, credits are added automatically
              and your tax invoice appears in order history.
            </p>
            <div className="checkout-done-actions">
              <button type="button" className="btn btn-primary" onClick={onViewHistory}>
                View order history
              </button>
              <button type="button" className="btn btn-outline" onClick={onCancel}>
                Back to plans
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
