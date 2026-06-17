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
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import type { BuyerInfo, CreditPack } from '../../lib/api/credits'

function itemName(code: string): string {
  return PLAN_META[code]?.name ?? PACK_META[code]?.name ?? code
}

interface Props {
  pack: CreditPack | null
  resume?: CheckoutSession | null
  onCancel: () => void
  onViewHistory: () => void
}

const SOURCE_KEY: Record<string, TKey | ''> = {
  carmen: 'checkout.sourceCarmen',
  last_invoice: 'checkout.sourceLastInvoice',
  form: '',
}

export default function CheckoutFlow({ pack, resume, onCancel, onViewHistory }: Props) {
  const { t } = useT()
  const c = useCheckout(pack, resume)
  const [showDoc, setShowDoc] = useState(false)

  const STEPS = [
    { n: 1, label: t('checkout.step1') },
    { n: 2, label: t('checkout.step2') },
    { n: 3, label: t('checkout.step3') },
  ]

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
      toast.error(c.error || t('checkout.createError'))
    }
  }

  const handleSlip = async (file: File) => {
    await c.submitSlip(file)
    toast.success(t('checkout.slipSubmittedToast'))
  }

  return (
    <div className="checkout">
      <button type="button" className="checkout-back" onClick={onCancel}>
        <ArrowLeft size={15} /> {t('checkout.backToPlans')}
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
                <h3 className="checkout-section-title">{t('checkout.billingTitle')}</h3>
                {c.profileSource && SOURCE_KEY[c.profileSource] && (
                  <span className="checkout-source-badge">
                    <ShieldCheck size={12} /> {t(SOURCE_KEY[c.profileSource] as TKey)}
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
                    <span className="checkout-field-label">{t('checkout.fieldName')}</span>
                    <input
                      className="checkout-input"
                      value={c.buyer.name}
                      onChange={e => updateBuyer({ name: e.target.value })}
                      placeholder={t('checkout.phName')}
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">{t('checkout.fieldTaxId')}</span>
                    <input
                      className="checkout-input text-mono"
                      value={c.buyer.tax_id}
                      onChange={e => updateBuyer({ tax_id: e.target.value })}
                      placeholder={t('checkout.phTaxId')}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="checkout-field checkout-field--wide">
                    <span className="checkout-field-label">{t('checkout.fieldAddress')}</span>
                    <input
                      className="checkout-input"
                      value={c.buyer.address}
                      onChange={e => updateBuyer({ address: e.target.value })}
                      placeholder={t('checkout.phAddress')}
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">{t('checkout.fieldBranch')}</span>
                    <input
                      className="checkout-input"
                      value={c.buyer.branch}
                      onChange={e => updateBuyer({ branch: e.target.value })}
                      placeholder={t('checkout.phBranch')}
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">{t('checkout.fieldEmail')}</span>
                    <input
                      className="checkout-input"
                      type="email"
                      value={c.buyer.email}
                      onChange={e => updateBuyer({ email: e.target.value })}
                      placeholder={t('checkout.phEmail')}
                    />
                  </label>
                </div>
              )}
            </div>

            <aside className="checkout-summary">
              <h4 className="checkout-summary-title">{t('checkout.summaryTitle')}</h4>
              <div className="checkout-summary-row">
                <span>{itemName(code)}</span>
                <span className="text-mono">
                  {credits.toLocaleString()} {t('pack.creditsUnit')}
                </span>
              </div>
              <div className="checkout-summary-row checkout-summary-kind">
                <span>{isSubscription ? t('checkout.kindMonthly') : t('checkout.kindTopup')}</span>
              </div>
              <div className="checkout-summary-total">
                <span>{t('checkout.totalDue')}</span>
                <span className="text-mono">฿{formatThb(amount, true)}</span>
              </div>
              <p className="checkout-vat-note">{t('checkout.vatNote')}</p>
              <button
                type="button"
                className="btn btn-primary checkout-confirm"
                onClick={handleConfirm}
                disabled={c.creating || c.loadingProfile || !c.buyer.name.trim()}
              >
                {c.creating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> {t('checkout.creatingOrder')}
                  </>
                ) : (
                  t('checkout.continueToPayment')
                )}
              </button>
              {!c.buyer.name.trim() && !c.loadingProfile && (
                <p className="checkout-hint">{t('checkout.enterNameHint')}</p>
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
                  <h3 className="checkout-section-title">{t('checkout.scanToPay')}</h3>
                  <p className="checkout-pay-sub">{t('checkout.scanSub')}</p>
                </div>
              </div>
              <PromptPayQR qr={c.session.qr} />
            </div>

            <div className="panel-card checkout-slip-card">
              <h3 className="checkout-section-title">{t('checkout.confirmPayment')}</h3>
              <p className="checkout-pay-sub">{t('checkout.confirmSub')}</p>
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
                {showDoc ? t('checkout.hideInvoice') : t('checkout.viewInvoice')}
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
            <h3 className="checkout-done-title">{t('checkout.slipSubmittedTitle')}</h3>
            <p className="checkout-done-sub">{t('checkout.slipSubmittedSub')}</p>
            <div className="checkout-done-actions">
              <button type="button" className="btn btn-primary" onClick={onViewHistory}>
                {t('checkout.viewOrderHistory')}
              </button>
              <button type="button" className="btn btn-outline" onClick={onCancel}>
                {t('checkout.backToPlans')}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
