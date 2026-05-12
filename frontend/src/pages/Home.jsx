import { Receipt, FileText, Landmark, CheckCircle2, Clock, Lock, ArrowRight } from 'lucide-react'
import '../styles/pages/home.css'
import logo from '../assets/logo.png'
import { DarkModeToggle, UsageIndicator } from '../components/common'

const MODULES = [
  {
    id: 'credit-card-ocr',
    href: '#/CreditCardOCR',
    name: 'Credit Card Report OCR',
    description: 'AI extracts credit card statements from BBL, KBANK, SCB and posts entries directly to Carmen GL',
    Icon: FileText,
    useLogo: true,
    accent: 'oklch(0.4714 0.1794 258.7)',
    tag: { label: 'ACTIVE', bg: 'var(--emerald-light)', color: 'oklch(0.30 0.08 188.43)', border: 'oklch(0.88 0.06 188.43)' },
    features: ['OCR AI', 'Carmen GL', 'Input Tax'],
  },
  {
    id: 'ap-invoice',
    href: '#/APInvoice',
    name: 'AP Invoice Processing',
    description: 'Reads vendor invoices automatically, matches GL accounts, and syncs with the accounting system',
    Icon: Receipt,
    useLogo: true,
    accent: 'oklch(0.5852 0.1706 253.27)',
    tag: { label: 'ACTIVE', bg: 'var(--emerald-light)', color: 'oklch(0.30 0.08 188.43)', border: 'oklch(0.88 0.06 188.43)' },
    features: ['Invoice OCR', 'Auto GL Match', 'ERP Sync'],
  },
  {
    id: 'bank-reconciliation',
    href: null,
    name: 'Bank Reconciliation',
    description: 'Automatically compares bank statements against ledger entries to flag discrepancies',
    Icon: Landmark,
    accent: 'oklch(0.56 0.10 188.43)',
    tag: { label: 'COMING SOON', bg: 'var(--muted)', color: 'var(--text-3)', border: 'var(--border)' },
    features: ['Statement Import', 'Auto Match'],
  },
]

export default function Home() {
  return (
    <div className="home-page">
      <div className="home-dark-toggle" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <UsageIndicator />
        <DarkModeToggle />
      </div>

      {/* ─── Hero ─── */}
      <div className="home-hero">
        <div className="home-hero-badge">
          <span className="home-hero-badge-dot" />
          Powered by Carmen Cloud 
        </div>

        <div className="home-logo">
          <img src={logo} alt="Carmen AI Logo" className="home-logo-img" />
        </div>

        <h1 className="home-title">
          Carmen<br /><span>AI Automation</span>
        </h1>
        <p className="home-subtitle">
          AI-powered accounting automation — extract invoices and credit card statements,
          then post directly to Carmen Cloud with no manual entry.
        </p>

        <div className="home-version">
          <span className="dot" />
          System Online — Beta v1.0.1
        </div>
      </div>


      {/* ─── Module Cards ─── */}
      <div className="home-modules">
        <div className="home-modules-title">Select Module</div>

        <div className="module-grid">
          {MODULES.map((mod) => {
            const isComingSoon = !mod.href
            const Tag = isComingSoon ? 'div' : 'a'
            return (
              <Tag
                key={mod.id}
                href={isComingSoon ? undefined : mod.href}
                className={`module-card ${isComingSoon ? 'coming-soon' : ''}`}
                style={{ '--card-accent': mod.accent }}
                tabIndex={isComingSoon ? -1 : undefined}
                aria-disabled={isComingSoon ? 'true' : undefined}
              >
                {/* Banner */}
                <div className="module-card-banner">
                  <div className="module-card-banner-icon">
                    {mod.useLogo ? (
                      <img src={logo} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
                    ) : (
                      <mod.Icon size={28} strokeWidth={1.5} />
                    )}
                  </div>
                  {isComingSoon && (
                    <div className="module-card-banner-lock">
                      <Lock size={11} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="module-card-content">
                  <div className="module-card-meta">
                    <span
                      className="module-card-tag"
                      style={{ background: mod.tag.bg, color: mod.tag.color, border: `1px solid ${mod.tag.border}` }}
                    >
                      {isComingSoon ? <Clock size={9} /> : <CheckCircle2 size={9} />}
                      {mod.tag.label}
                    </span>
                  </div>
                  <h3 className="module-card-name">{mod.name}</h3>
                  <p className="module-card-desc">{mod.description}</p>
                </div>

                {/* Footer */}
                <div className="module-card-footer">
                  <div className="module-card-features">
                    {mod.features.map((f) => (
                      <span key={f} className="module-card-feature">{f}</span>
                    ))}
                  </div>
                  <div className="module-card-arrow">
                    {isComingSoon ? <Lock size={13} /> : <ArrowRight size={13} />}
                  </div>
                </div>
              </Tag>
            )
          })}
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="home-footer">
        Carmen AI Automation Platform
      </div>
    </div>
  )
}
