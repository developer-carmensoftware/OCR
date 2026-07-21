import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import StepWizard from '../common/StepWizard'
import ProformaDocument from './ProformaDocument'
import SlipUpload from './SlipUpload'
import { useCheckout, type CheckoutSession } from '../../hooks/credits'
import { PLAN_META, PACK_META } from '../../constants/billing'
import { formatThb } from '../../lib/money'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'
import {
  getPaymentInfo,
  type BillingPeriod,
  type BuyerInfo,
  type CreditPack,
  type PaymentInfo,
} from '../../lib/api/credits'

function itemName(code: string): string {
  return PLAN_META[code]?.name ?? PACK_META[code]?.name ?? code
}

interface Props {
  pack: CreditPack | null
  period?: BillingPeriod
  resume?: CheckoutSession | null
  onCancel: () => void
  onViewHistory: () => void
}

const REQUIRED_BUYER_KEYS: Array<keyof BuyerInfo> = ['name', 'tax_id', 'branch', 'address']

const SOURCE_KEY: Record<string, TKey | ''> = {
  carmen: 'checkout.sourceCarmen',
  last_invoice: 'checkout.sourceLastInvoice',
  form: '',
}

export default function CheckoutFlow({
  pack,
  period = 'monthly',
  resume,
  onCancel,
  onViewHistory,
}: Props) {
  const { t } = useT()
  const c = useCheckout(pack, resume, period)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)

  useEffect(() => {
    getPaymentInfo()
      .then(setPaymentInfo)
      .catch(e => console.warn('payment-info fetch failed, bank block hidden:', e))
  }, [])

  const STEPS = [
    { n: 1, label: t('checkout.step1') },
    { n: 2, label: t('checkout.step2') },
    { n: 3, label: t('checkout.step3') },
  ]

  const stepNum = c.phase === 'buyer' ? 1 : c.phase === 'pay' ? 2 : 3
  const code = pack?.code ?? c.session?.pack_code ?? ''
  const credits = pack?.credits ?? c.session?.credits ?? 0
  const isSubscription = !!PLAN_META[code]
  // On resume there is no `pack` — fall back to the period/amount stored in the session.
  const effectivePeriod: BillingPeriod = pack ? period : (c.session?.billing_period ?? 'monthly')
  const isAnnual = isSubscription && effectivePeriod === 'annual'
  const amount = pack
    ? isAnnual
      ? (pack.price_annual_thb ?? pack.price_thb)
      : pack.price_thb
    : (c.session?.amount_thb ?? 0)
  const kindLabel = isSubscription
    ? isAnnual
      ? t('checkout.kindAnnual')
      : t('checkout.kindMonthly')
    : t('checkout.kindTopup')

  const updateBuyer = (patch: Partial<BuyerInfo>) => c.setBuyer({ ...c.buyer, ...patch })
  const buyerComplete = REQUIRED_BUYER_KEYS.every(k => c.buyer[k].trim())

  const handleConfirm = async () => {
    try {
      await c.confirmBuyer()
    } catch {
      toast.error(c.error || t('checkout.createError'))
    }
  }

  const handleSlip = async (file: File) => {
    try {
      await c.submitSlip(file)
      toast.success(t('checkout.slipSubmittedToast'))
    } catch (e) {
      // submitSlip re-throws after setting c.error; without this catch the failure was
      // silent (SlipUpload swallows it) and the buyer saw the spinner stop with no
      // feedback. Read the thrown error, not c.error — state is stale in this tick.
      toast.error((e as Error).message || t('checkout.slipError'))
    }
  }

  return (
    <div className="checkout">
      <button type="button" className="checkout-back" onClick={onCancel}>
        <ArrowLeft size={15} /> {t('checkout.backToPlans')}
      </button>

      {/* No onStepClick: back-nav is locked once an order is created. */}
      <StepWizard step={stepNum} steps={STEPS} />

      <m.div
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
              {c.profileLoadError && !c.loadingProfile && (
                <p className="checkout-hint">{t('checkout.profileLoadError')}</p>
              )}

              {c.loadingProfile ? (
                <div className="checkout-form-skeleton" aria-hidden="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="checkout-skel-field" />
                  ))}
                </div>
              ) : (
                <div className="checkout-fields">
                  <div className="checkout-row-3">
                    <label className="checkout-field">
                      <span className="checkout-field-label checkout-field-label--required">
                        {t('checkout.fieldName')}
                      </span>
                      <input
                        className="checkout-input"
                        required
                        value={c.buyer.name}
                        onChange={e => updateBuyer({ name: e.target.value })}
                        placeholder={t('checkout.phName')}
                      />
                    </label>
                    <label className="checkout-field">
                      <span className="checkout-field-label checkout-field-label--required">
                        {t('checkout.fieldTaxId')}
                      </span>
                      <input
                        className="checkout-input text-mono"
                        required
                        value={c.buyer.tax_id}
                        onChange={e => updateBuyer({ tax_id: e.target.value })}
                        placeholder={t('checkout.phTaxId')}
                        inputMode="numeric"
                      />
                    </label>
                    <label className="checkout-field">
                      <span className="checkout-field-label checkout-field-label--required">
                        {t('checkout.fieldBranch')}
                      </span>
                      <input
                        className="checkout-input"
                        required
                        value={c.buyer.branch}
                        onChange={e => updateBuyer({ branch: e.target.value })}
                        placeholder={t('checkout.phBranch')}
                      />
                    </label>
                  </div>
                  <label className="checkout-field">
                    <span className="checkout-field-label checkout-field-label--required">
                      {t('checkout.fieldAddress')}
                    </span>
                    <input
                      className="checkout-input"
                      required
                      value={c.buyer.address}
                      onChange={e => updateBuyer({ address: e.target.value })}
                      placeholder={t('checkout.phAddress')}
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">{t('checkout.fieldContactName')}</span>
                    <input
                      className="checkout-input"
                      value={c.buyer.contact_name}
                      onChange={e => updateBuyer({ contact_name: e.target.value })}
                      placeholder={t('checkout.phContactName')}
                    />
                  </label>
                  <label className="checkout-field">
                    <span className="checkout-field-label">{t('checkout.fieldTel')}</span>
                    <input
                      className="checkout-input"
                      type="tel"
                      value={c.buyer.tel}
                      onChange={e => updateBuyer({ tel: e.target.value })}
                      placeholder={t('checkout.phTel')}
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
                <span>{kindLabel}</span>
              </div>
              <div className="checkout-summary-total">
                <span>{t('checkout.totalDue')}</span>
                <span className="text-mono">฿{formatThb(amount, true)}</span>
              </div>
              <p className="checkout-vat-note">{t('checkout.vatNote')}</p>
              <p className="checkout-vat-note">{t('checkout.finalTotalNote')}</p>
              <button
                type="button"
                className="btn btn-primary checkout-confirm"
                onClick={handleConfirm}
                disabled={c.creating || c.loadingProfile || !buyerComplete}
              >
                {c.creating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> {t('checkout.creatingOrder')}
                  </>
                ) : (
                  t('checkout.continueToPayment')
                )}
              </button>
              {!buyerComplete && !c.loadingProfile ? (
                <p className="checkout-hint">{t('checkout.fillAllFieldsHint')}</p>
              ) : (
                <p className="checkout-hint">{t('checkout.verifyHint')}</p>
              )}
            </aside>
          </div>
        )}

        {c.phase === 'pay' && c.session && (
          <div className="checkout-pay">
            <ProformaDocument doc={c.session.proforma} paymentInfo={paymentInfo} />

            <div className="panel-card checkout-slip-card no-print">
              <h3 className="checkout-section-title">{t('checkout.confirmPayment')}</h3>
              <p className="checkout-pay-sub">{t('checkout.confirmSub')}</p>
              <SlipUpload onUpload={handleSlip} uploading={c.uploading} />
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
      </m.div>
    </div>
  )
}
