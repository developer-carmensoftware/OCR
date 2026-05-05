import { Receipt, FileText, Landmark, CheckCircle2, Clock, Lock, ArrowRight } from 'lucide-react'
import '../styles/pages/home.css'
import logo from '../assets/logo.png'
import { DarkModeToggle, UsageIndicator } from '../components/common'

const MODULES = [
  {
    id: 'credit-card-ocr',
    href: '#/CreditCardOCR',
    name: 'Credit Card Report OCR',
    description: 'AI automatically extracts Credit Card Reports from banks and posts to Carmen GL',
    Icon: FileText,
    useLogo: true,
    iconBg: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
    iconColor: '#fff',
    accent: '#2563eb',
    tag: { label: 'ACTIVE', bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
    features: ['OCR AI', 'Carmen GL', 'Input Tax'],
  },
  {
    id: 'ap-invoice',
    href: '#/APInvoice',
    name: 'AP Invoice Processing',
    description: 'AP Invoice automation reads vendor data and syncs with the accounting system',
    Icon: Receipt,
    useLogo: true,
    iconBg: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    iconColor: '#fff',
    accent: '#7c3aed',
    tag: { label: 'ACTIVE', bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
    features: ['Invoice OCR', 'Auto Matching'],
  },
  {
    id: 'bank-reconciliation',
    href: null,
    name: 'Bank Reconciliation',
    description: 'Bank reconciliation automatically compares statements with ledger entries',
    Icon: Landmark,
    iconBg: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
    iconColor: '#fff',
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

      {/* ─── Hero Header ─── */}
      <div className="home-hero">
        <div className="home-logo">
          <img src={logo} alt="Carmen AI Logo" className="home-logo-img" />
        </div>
        <h1 className="home-title">
          Carmen <span>AI Automation</span>
        </h1>
        <p className="home-subtitle">
          Automated AI for Accounting — Select a module to use
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
                style={{ '--card-accent': mod.accent, textDecoration: 'none' }}
                tabIndex={isComingSoon ? -1 : undefined}
                aria-disabled={isComingSoon ? 'true' : undefined}
              >
                <div className="module-card-header">
                  <div
                    className="module-card-icon"
                    style={{ background: mod.iconBg, color: mod.iconColor }}
                  >
                    {mod.useLogo ? (
                      <img src={logo} alt="Module Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    ) : (
                      <mod.Icon size={28} color="#fff" />
                    )}
                  </div>
                  <div className="module-card-info">
                    <div className="module-card-name">{mod.name}</div>
                    <span
                      className="module-card-tag"
                      style={{
                        background: mod.tag.bg,
                        color: mod.tag.color,
                        border: `1px solid ${mod.tag.border}`,
                      }}
                    >
                      {isComingSoon ? <Clock size={10} /> : <CheckCircle2 size={10} />}
                      {mod.tag.label}
                    </span>
                  </div>
                </div>

                <div className="module-card-desc">{mod.description}</div>

                <div className="module-card-footer">
                  <div className="module-card-features">
                    {mod.features.map((f) => (
                      <span key={f} className="module-card-feature">{f}</span>
                    ))}
                  </div>
                  <div className="module-card-arrow">
                    {isComingSoon ? <Lock size={14} /> : <ArrowRight size={14} />}
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
