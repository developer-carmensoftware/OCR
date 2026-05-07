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
    bannerBg: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 60%, #60a5fa 100%)',
    accent: '#2563eb',
    tag: { label: 'ACTIVE', bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
    features: ['OCR AI', 'Carmen GL', 'Input Tax'],
  },
  {
    id: 'ap-invoice',
    href: '#/APInvoice',
    name: 'AP Invoice Processing',
    description: 'Reads vendor invoices automatically, matches GL accounts, and syncs with the accounting system',
    Icon: Receipt,
    useLogo: true,
    bannerBg: 'linear-gradient(135deg, #6d28d9 0%, #8058F1 60%, #a78bfa 100%)',
    accent: '#7c3aed',
    tag: { label: 'ACTIVE', bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
    features: ['Invoice OCR', 'Auto GL Match', 'ERP Sync'],
  },
  {
    id: 'bank-reconciliation',
    href: null,
    name: 'Bank Reconciliation',
    description: 'Automatically compares bank statements against ledger entries to flag discrepancies',
    Icon: Landmark,
    bannerBg: 'linear-gradient(135deg, #0f766e 0%, #0d9488 60%, #2dd4bf 100%)',
    accent: '#0d9488',
    tag: { label: 'COMING SOON', bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },
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
          Powered by Vision LLM · Real-time OCR
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
        <div className="home-modules-title">เลือกโมดูล</div>

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
                {/* Gradient banner */}
                <div className="module-card-banner" style={{ background: mod.bannerBg }}>
                  <div className="module-card-banner-icon">
                    {mod.useLogo ? (
                      <img src={logo} alt="" style={{ width: 34, height: 34, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    ) : (
                      <mod.Icon size={34} color="#fff" strokeWidth={1.75} />
                    )}
                  </div>
                  {isComingSoon && (
                    <div className="module-card-banner-lock">
                      <Lock size={12} color="rgba(255,255,255,0.7)" />
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
