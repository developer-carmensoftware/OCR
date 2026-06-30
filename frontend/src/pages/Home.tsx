import type React from 'react'
import { m } from 'framer-motion'
import { Receipt, FileText, Landmark, CheckCircle2, Clock, Lock, ArrowRight } from 'lucide-react'
import '../styles/pages/home.css'
import logo from '../assets/logo.png'
import { DarkModeToggle, UsageIndicator, PaymentButton } from '../components/common'
import LanguageToggle from '../components/common/LanguageToggle'
import { useT } from '../i18n/LanguageContext'
import type { TKey } from '../i18n/dict'
import { useEntrance } from '../lib/useEntrance'

interface TagConfig {
  labelKey: TKey
  bg: string
  color: string
  border: string
}
interface Module {
  id: string
  href: string | null
  nameKey: TKey
  descKey: TKey
  Icon: React.ElementType
  useLogo?: boolean
  accent: string
  tag: TagConfig
  features: string[]
}

const ACTIVE_TAG: TagConfig = {
  labelKey: 'home.tagActive',
  bg: 'var(--emerald-light)',
  color: 'oklch(0.30 0.08 188.43)',
  border: 'oklch(0.88 0.06 188.43)',
}

const MODULES: Module[] = [
  {
    id: 'credit-card-ocr',
    href: '#/CreditCardOCR',
    nameKey: 'home.ccName',
    descKey: 'home.ccDesc',
    Icon: FileText,
    useLogo: true,
    accent: 'oklch(0.4714 0.1794 258.7)',
    tag: ACTIVE_TAG,
    features: ['OCR AI', 'Carmen Cloud', 'Input Tax'],
  },
  {
    id: 'ap-invoice',
    href: '#/APInvoice',
    nameKey: 'home.apName',
    descKey: 'home.apDesc',
    Icon: Receipt,
    useLogo: true,
    accent: 'oklch(0.5852 0.1706 253.27)',
    tag: ACTIVE_TAG,
    features: ['Invoice OCR', 'Auto GL Match', 'ERP Sync'],
  },
  {
    id: 'bank-reconciliation',
    href: null,
    nameKey: 'home.bankName',
    descKey: 'home.bankDesc',
    Icon: Landmark,
    accent: 'oklch(0.56 0.10 188.43)',
    tag: {
      labelKey: 'home.tagSoon',
      bg: 'var(--muted)',
      color: 'var(--text-3)',
      border: 'var(--border)',
    },
    features: ['Statement Import', 'Auto Match'],
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
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

export default function Home() {
  const { t } = useT()
  const enter = useEntrance('home')
  return (
    <div className="home-page">
      <div className="home-dark-toggle">
        <UsageIndicator />
        <PaymentButton />
        <LanguageToggle />
        <DarkModeToggle />
      </div>
      <m.div
        className="home-hero"
        initial={enter ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.05 }}
      >
        <div className="home-hero-badge">
          <span className="home-hero-badge-dot" />
          Powered by Carmen Cloud
        </div>
        <div className="home-logo">
          <img src={logo} alt="Carmen Cloud AI Logo" className="home-logo-img" />
        </div>
        <h1 className="home-title">
          Carmen
          <br />
          <span>AI Automation</span>
        </h1>
        <p className="home-subtitle">{t('home.subtitle')}</p>
        <div className="home-version">
          <span className="dot" /> System Online — Beta v1.0.1
        </div>
      </m.div>
      <div className="home-modules">
        <m.div
          className="module-grid"
          variants={containerVariants}
          initial={enter ? 'hidden' : false}
          animate="show"
        >
          {MODULES.map(mod => {
            const isComingSoon = !mod.href
            const Tag = (isComingSoon ? 'div' : 'a') as React.ElementType
            return (
              <m.div key={mod.id} variants={itemVariants} style={{ display: 'flex' }}>
                <Tag
                  href={isComingSoon ? undefined : mod.href}
                  className={`module-card ${isComingSoon ? 'coming-soon' : ''}`}
                  style={{ '--card-accent': mod.accent, width: '100%' } as React.CSSProperties}
                  tabIndex={isComingSoon ? -1 : undefined}
                  aria-disabled={isComingSoon ? 'true' : undefined}
                >
                  <div className="module-card-banner">
                    <div className="module-card-banner-icon">
                      {mod.useLogo ? (
                        <img
                          src={logo}
                          alt=""
                          style={{ width: 30, height: 30, objectFit: 'contain' }}
                        />
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
                  <div className="module-card-content">
                    <div className="module-card-meta">
                      <span
                        className="module-card-tag"
                        style={{
                          background: mod.tag.bg,
                          color: mod.tag.color,
                          border: `1px solid ${mod.tag.border}`,
                        }}
                      >
                        {isComingSoon ? <Clock size={9} /> : <CheckCircle2 size={9} />}
                        {t(mod.tag.labelKey)}
                      </span>
                    </div>
                    <h3 className="module-card-name">{t(mod.nameKey)}</h3>
                    <p className="module-card-desc">{t(mod.descKey)}</p>
                  </div>
                  <div className="module-card-footer">
                    <div className="module-card-features">
                      {mod.features.map(f => (
                        <span key={f} className="module-card-feature">
                          {f}
                        </span>
                      ))}
                    </div>
                    <div className="module-card-arrow">
                      {isComingSoon ? <Lock size={13} /> : <ArrowRight size={13} />}
                    </div>
                  </div>
                </Tag>
              </m.div>
            )
          })}
        </m.div>
      </div>
      <div className="home-footer">Carmen Cloud AI Automation Platform</div>
    </div>
  )
}
