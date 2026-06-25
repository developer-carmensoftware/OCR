import { useEffect, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Phone, Mail } from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import LanguageToggle from '../components/common/LanguageToggle'
import { useT } from '../i18n/LanguageContext'
import {
  PlanCard,
  FreePlanCard,
  EnterpriseCard,
  PackList,
  FeatureFlows,
  CheckoutFlow,
  PendingOrderBanner,
} from '../components/pricing'
import {
  usePricingCatalog,
  useOrderHistory,
  loadPersistedCheckout,
  clearPersistedCheckout,
  type CheckoutSession,
} from '../hooks/credits'
import { PLAN_META, SALES_CONTACT } from '../constants/billing'
import { getPaymentInfo, type CreditPack, type PaymentInfo } from '../lib/api/credits'
import { useEntrance } from '../lib/useEntrance'
import '../styles/pages/pricing.css'

function ContactDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  return (
    <m.div
      className="ios-sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('plan.contactSales')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'default',
        }}
        aria-label="Close contact sheet"
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      />
      <m.div
        className="ios-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
      >
        <div className="ios-sheet-handle" />
        <button
          type="button"
          className="ios-sheet-close"
          onClick={onClose}
          aria-label={t('contact.close')}
        >
          <X size={16} />
        </button>
        <h3 className="contact-title" style={{ marginTop: '0.5rem' }}>
          {t('plan.contactSales')}
        </h3>
        <p className="contact-sub">{t('contact.sub')}</p>
        <div className="contact-channels">
          <a
            className="contact-channel"
            href={SALES_CONTACT.lineUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} />
            <span className="contact-channel-label">LINE</span>
            <span className="contact-channel-value text-mono">{SALES_CONTACT.line}</span>
          </a>
          <a className="contact-channel" href={`tel:${SALES_CONTACT.phone}`}>
            <Phone size={18} />
            <span className="contact-channel-label">{t('contact.phone')}</span>
            <span className="contact-channel-value text-mono">{SALES_CONTACT.phone}</span>
          </a>
          <a className="contact-channel" href={`mailto:${SALES_CONTACT.email}`}>
            <Mail size={18} />
            <span className="contact-channel-label">{t('contact.email')}</span>
            <span className="contact-channel-value text-mono">{SALES_CONTACT.email}</span>
          </a>
        </div>
      </m.div>
    </m.div>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 120,
      damping: 14,
    },
  },
}

export default function Pricing() {
  const { t } = useT()
  const { plans, packs, loading, error } = usePricingCatalog()
  const { orders, reload } = useOrderHistory()
  const openOrders = orders.filter(o => o.status === 'in_progress')
  const hasOpenOrder = openOrders.length > 0
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
  const [resume, setResume] = useState<CheckoutSession | null>(() => loadPersistedCheckout())
  const [view, setView] = useState<'catalog' | 'checkout'>(resume ? 'checkout' : 'catalog')
  const [selected, setSelected] = useState<CreditPack | null>(null)
  const [showContact, setShowContact] = useState(false)
  const enter = useEntrance('pricing')

  useEffect(() => {
    getPaymentInfo()
      .then(setPaymentInfo)
      .catch(() => setPaymentInfo(null))
  }, [])

  const startCheckout = (pack: CreditPack) => {
    setSelected(pack)
    setView('checkout')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToCatalog = () => {
    clearPersistedCheckout()
    setResume(null)
    setSelected(null)
    setView('catalog')
  }

  return (
    <div className="pricing-page">
      <AppHeader moduleName={t('nav.plansCredits')} eyebrow="Carmen Cloud · AI Automation">
        <div className="segmented-control" style={{ margin: 0, maxHeight: 36, width: 'auto' }}>
          <button
            type="button"
            className="segmented-btn active"
            onClick={() => {
              window.location.hash = '#/pricing'
            }}
          >
            {t('nav.plans')}
          </button>
          <button
            type="button"
            className="segmented-btn"
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
              left: 2,
            }}
          />
        </div>
        <LanguageToggle />
      </AppHeader>

      <AnimatePresence mode="wait">
        {view === 'checkout' ? (
          <m.div
            key="checkout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <CheckoutFlow
              pack={selected}
              resume={resume}
              onCancel={backToCatalog}
              onViewHistory={() => {
                window.location.hash = '#/pricing/orders'
              }}
            />
          </m.div>
        ) : (
          <m.main
            key="catalog"
            className="pricing-main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <PendingOrderBanner orders={openOrders} onChanged={reload} paymentInfo={paymentInfo} />
            <m.header
              className="pricing-hero"
              initial={enter ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
            >
              <h2 className="pricing-title">{t('pricing.title')}</h2>
              <p className="pricing-subtitle">{t('pricing.subtitle')}</p>
            </m.header>
            {error ? (
              <div className="pricing-error">{t('pricing.loadError', { error })}</div>
            ) : loading ? (
              <div className="pricing-skeleton-grid pricing-skeleton-grid--4" aria-hidden="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="pricing-skeleton-card" />
                ))}
              </div>
            ) : (
              <>
                <section className="pricing-section" aria-label="Plans">
                  <m.div
                    className="plan-grid plan-grid--5"
                    variants={containerVariants}
                    initial={enter ? 'hidden' : false}
                    animate="show"
                  >
                    <m.div variants={cardVariants} style={{ display: 'flex' }}>
                      <FreePlanCard />
                    </m.div>
                    {plans.map(pack => (
                      <m.div key={pack.code} variants={cardVariants} style={{ display: 'flex' }}>
                        <PlanCard
                          pack={pack}
                          meta={PLAN_META[pack.code] ?? { name: pack.code }}
                          onSelect={startCheckout}
                          disabled={hasOpenOrder}
                        />
                      </m.div>
                    ))}
                    <m.div variants={cardVariants} style={{ display: 'flex' }}>
                      <EnterpriseCard onContact={() => setShowContact(true)} />
                    </m.div>
                  </m.div>
                </section>

                <section className="pricing-section" aria-labelledby="packs-heading">
                  <div className="pricing-section-head pricing-section-head--center">
                    <h2 id="packs-heading" className="pricing-section-title">
                      {t('pricing.topupTitle')}
                    </h2>
                    <p className="pricing-section-sub">{t('pricing.topupSub')}</p>
                    <p className="pricing-note">{t('pricing.topupNote')}</p>
                  </div>
                  <PackList packs={packs} onSelect={startCheckout} disabled={hasOpenOrder} />
                </section>

                <section className="pricing-section" aria-labelledby="flows-heading">
                  <div className="pricing-section-head pricing-section-head--center">
                    <h2 id="flows-heading" className="pricing-section-title">
                      {t('flows.heading')}
                    </h2>
                    <p className="pricing-section-sub">{t('flows.sub')}</p>
                  </div>
                  <FeatureFlows />
                </section>
              </>
            )}
          </m.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContact && <ContactDialog onClose={() => setShowContact(false)} />}
      </AnimatePresence>
    </div>
  )
}
