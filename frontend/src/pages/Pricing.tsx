import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageCircle, Phone, Mail } from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import DarkModeToggle from '../components/common/DarkModeToggle'
import {
  PlanCard,
  FreePlanCard,
  EnterpriseCard,
  PackList,
  FeatureFlows,
  CheckoutFlow,
} from '../components/pricing'
import { usePricingCatalog, loadPersistedCheckout, type CheckoutSession } from '../hooks/credits'
import { PLAN_META, SALES_CONTACT } from '../constants/billing'
import type { CreditPack } from '../lib/api/credits'
import { useEntrance } from '../lib/useEntrance'
import '../styles/pages/pricing.css'

function ContactDialog({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="ios-sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Contact sales"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <motion.div
        className="ios-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 360, damping: 36 }}
      >
        <div className="ios-sheet-handle" />
        <button type="button" className="ios-sheet-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h3 className="contact-title" style={{ marginTop: '0.5rem' }}>
          Contact sales
        </h3>
        <p className="contact-sub">
          Talk to our team to tailor an Enterprise plan to your organization's volume.
        </p>
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
            <span className="contact-channel-label">Phone</span>
            <span className="contact-channel-value text-mono">{SALES_CONTACT.phone}</span>
          </a>
          <a className="contact-channel" href={`mailto:${SALES_CONTACT.email}`}>
            <Mail size={18} />
            <span className="contact-channel-label">Email</span>
            <span className="contact-channel-value text-mono">{SALES_CONTACT.email}</span>
          </a>
        </div>
      </motion.div>
    </motion.div>
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
  const { plans, packs, loading, error } = usePricingCatalog()
  const [resume] = useState<CheckoutSession | null>(() => loadPersistedCheckout())
  const [view, setView] = useState<'catalog' | 'checkout'>(resume ? 'checkout' : 'catalog')
  const [selected, setSelected] = useState<CreditPack | null>(null)
  const [showContact, setShowContact] = useState(false)
  const enter = useEntrance('pricing')

  const startCheckout = (pack: CreditPack) => {
    setSelected(pack)
    setView('checkout')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const backToCatalog = () => {
    setSelected(null)
    setView('catalog')
  }

  return (
    <div className="pricing-page">
      <AppHeader moduleName="Plans & Credits" eyebrow="Carmen Cloud · AI Automation">
        <div className="segmented-control" style={{ margin: 0, maxHeight: 36, maxWidth: 200 }}>
          <button
            type="button"
            className="segmented-btn active"
            onClick={() => {
              window.location.hash = '#/pricing'
            }}
          >
            Plans
          </button>
          <button
            type="button"
            className="segmented-btn"
            onClick={() => {
              window.location.hash = '#/pricing/orders'
            }}
          >
            History
          </button>
          <span
            className="segmented-indicator"
            style={{
              width: 'calc(50% - 4px)',
              left: 2,
            }}
          />
        </div>
        <DarkModeToggle />
      </AppHeader>

      {view === 'checkout' ? (
        <CheckoutFlow
          pack={selected}
          resume={resume}
          onCancel={backToCatalog}
          onViewHistory={() => {
            window.location.hash = '#/pricing/orders'
          }}
        />
      ) : (
        <main className="pricing-main">
          <motion.header
            className="pricing-hero"
            initial={enter ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          >
            <h2 className="pricing-title">Start free with 30 documents</h2>
            <p className="pricing-subtitle">Pick the plan that fits your business.</p>
          </motion.header>
          {error ? (
            <div className="pricing-error">Failed to load plans: {error}</div>
          ) : loading ? (
            <div className="pricing-skeleton-grid pricing-skeleton-grid--4" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="pricing-skeleton-card" />
              ))}
            </div>
          ) : (
            <>
              <section className="pricing-section" aria-label="Plans">
                <motion.div
                  className="plan-grid plan-grid--5"
                  variants={containerVariants}
                  initial={enter ? 'hidden' : false}
                  animate="show"
                >
                  <motion.div variants={cardVariants} style={{ display: 'flex' }}>
                    <FreePlanCard />
                  </motion.div>
                  {plans.map(pack => (
                    <motion.div key={pack.code} variants={cardVariants} style={{ display: 'flex' }}>
                      <PlanCard
                        pack={pack}
                        meta={PLAN_META[pack.code] ?? { name: pack.code }}
                        onSelect={startCheckout}
                      />
                    </motion.div>
                  ))}
                  <motion.div variants={cardVariants} style={{ display: 'flex' }}>
                    <EnterpriseCard onContact={() => setShowContact(true)} />
                  </motion.div>
                </motion.div>
              </section>

              <section className="pricing-section" aria-labelledby="packs-heading">
                <div className="pricing-section-head pricing-section-head--center">
                  <h2 id="packs-heading" className="pricing-section-title">
                    Top-up credits
                  </h2>
                  <p className="pricing-section-sub">Works with any plan. Credits never expire.</p>
                  <p className="pricing-note">1 credit = 1 document</p>
                </div>
                <PackList packs={packs} onSelect={startCheckout} />
              </section>

              <section className="pricing-section" aria-labelledby="flows-heading">
                <div className="pricing-section-head pricing-section-head--center">
                  <h2 id="flows-heading" className="pricing-section-title">
                    ระบบ AI ช่วยงานบัญชีของคุณยังไง
                  </h2>
                  <p className="pricing-section-sub">เลือกฟีเจอร์เพื่อดูขั้นตอนการทำงาน</p>
                </div>
                <FeatureFlows />
              </section>
            </>
          )}
        </main>
      )}

      <AnimatePresence>
        {showContact && <ContactDialog onClose={() => setShowContact(false)} />}
      </AnimatePresence>
    </div>
  )
}
