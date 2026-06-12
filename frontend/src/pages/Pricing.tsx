import { useState } from 'react'
import { History, Receipt, X, MessageCircle, Phone, Mail, Check } from 'lucide-react'
import AppHeader from '../components/common/AppHeader'
import DarkModeToggle from '../components/common/DarkModeToggle'
import { PlanCard, EnterpriseBand, PackList, CheckoutFlow } from '../components/pricing'
import { usePricingCatalog, loadPersistedCheckout, type CheckoutSession } from '../hooks/credits'
import { PLAN_META, PLAN_INCLUDES, SALES_CONTACT } from '../constants/billing'
import type { CreditPack } from '../lib/api/credits'
import '../styles/pages/pricing.css'

function ContactDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="contact-overlay" role="dialog" aria-modal="true" aria-label="Contact sales">
      <div className="contact-backdrop" onClick={onClose} />
      <div className="contact-dialog">
        <button type="button" className="contact-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h3 className="contact-title">Contact sales</h3>
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
      </div>
    </div>
  )
}

export default function Pricing() {
  const { plans, packs, loading, error } = usePricingCatalog()
  const [resume] = useState<CheckoutSession | null>(() => loadPersistedCheckout())
  const [view, setView] = useState<'catalog' | 'checkout'>(resume ? 'checkout' : 'catalog')
  const [selected, setSelected] = useState<CreditPack | null>(null)
  const [showContact, setShowContact] = useState(false)

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
      <AppHeader moduleName="Plans & Credits" eyebrow="Carmen Cloud · OCR Module">
        <a className="pricing-history-link" href="#/pricing/orders">
          <History size={15} /> <span>Order history</span>
        </a>
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
          {error ? (
            <div className="pricing-error">Failed to load plans: {error}</div>
          ) : loading ? (
            <div className="pricing-skeleton-grid pricing-skeleton-grid--3" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="pricing-skeleton-card" />
              ))}
            </div>
          ) : (
            <>
              <section className="pricing-section" aria-labelledby="plans-heading">
                <div className="pricing-section-head">
                  <h2 id="plans-heading" className="pricing-section-title">
                    Monthly plans
                  </h2>
                  <p className="pricing-section-sub">
                    Same features across every tier — pick the monthly document quota you need. New
                    accounts start with a 30-document trial.
                  </p>
                </div>
                <div className="plan-grid plan-grid--3">
                  {plans.map(pack => (
                    <PlanCard
                      key={pack.code}
                      pack={pack}
                      meta={PLAN_META[pack.code] ?? { name: pack.code, tagline: '' }}
                      onSelect={startCheckout}
                    />
                  ))}
                </div>

                <div className="plan-includes">
                  <span className="plan-includes-label">Every plan includes</span>
                  <ul className="plan-includes-list">
                    {PLAN_INCLUDES.map(f => (
                      <li key={f}>
                        <Check size={14} className="plan-feature-check" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <EnterpriseBand onContact={() => setShowContact(true)} />
              </section>

              <section className="pricing-section" aria-labelledby="packs-heading">
                <div className="pricing-section-head">
                  <h2 id="packs-heading" className="pricing-section-title">
                    <Receipt size={18} className="pricing-section-icon" /> Top-up credits (one-time)
                  </h2>
                  <p className="pricing-section-sub">
                    Used once your monthly quota runs out. Credits never expire.
                  </p>
                </div>
                <PackList packs={packs} onSelect={startCheckout} />
              </section>
            </>
          )}
        </main>
      )}

      {showContact && <ContactDialog onClose={() => setShowContact(false)} />}
    </div>
  )
}
