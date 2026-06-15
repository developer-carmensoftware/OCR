import {
  Check,
  ArrowRight,
  MessageCircle,
  Gift,
  Zap,
  Briefcase,
  Building2,
  type LucideIcon,
} from 'lucide-react'
import { formatThb, formatRate } from '../../lib/money'
import {
  ENTERPRISE,
  FREE_PLAN,
  PLAN_INCLUDES,
  perDoc,
  type PackPresentation,
} from '../../constants/billing'
import type { CreditPack } from '../../lib/api/credits'

interface PlanCardProps {
  pack: CreditPack
  meta: PackPresentation
  onSelect: (pack: CreditPack) => void
}

/** Per-tier icon + tint class. Presentation-only, so it lives here, not in constants. */
const TIER_ICONS: Record<string, { Icon: LucideIcon; tint: string }> = {
  sub_starter: { Icon: Zap, tint: 'plan-icon--starter' },
  sub_standard: { Icon: Briefcase, tint: 'plan-icon--standard' },
  sub_pro: { Icon: Building2, tint: 'plan-icon--pro' },
}

/** Filled-circle check bullet shared by plan cards and the enterprise band. */
function PlanCheck() {
  return (
    <span className="plan-check" aria-hidden="true">
      <Check size={10} strokeWidth={3.5} />
    </span>
  )
}

/**
 * A subscription tier card. Reference-style anatomy: icon chip, name, bold
 * quota line, divider, short check bullets, then the price as the big number
 * anchored at the bottom next to the CTA. Only the highlighted tier gets the
 * primary CTA.
 */
export function PlanCard({ pack, meta, onSelect }: PlanCardProps) {
  const rate = perDoc(pack.price_thb, pack.credits)
  const icon = TIER_ICONS[pack.code]
  return (
    <div className={`plan-card${meta.highlight ? ' is-highlight' : ''}`}>
      {meta.badge && <span className="plan-badge">{meta.badge}</span>}
      {icon && (
        <span className={`plan-icon ${icon.tint}`}>
          <icon.Icon size={20} strokeWidth={1.9} />
        </span>
      )}
      <h3 className="plan-name">{meta.name}</h3>
      <p className="plan-quota-line">
        <span className="text-mono">{pack.credits.toLocaleString()}</span> documents / month
      </p>

      <ul className="plan-features">
        {PLAN_INCLUDES.map(f => (
          <li key={f}>
            <PlanCheck />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="plan-price">
        <span className="plan-price-amount text-mono">฿{formatThb(pack.price_thb)}</span>
        <span className="plan-price-period">/ month</span>
      </div>
      <p className="plan-rate">
        ≈ <span className="text-mono">฿{formatRate(rate)}</span> / doc
      </p>

      <button
        type="button"
        className={`btn ${meta.highlight ? 'btn-primary' : 'btn-outline'} plan-cta`}
        onClick={() => onSelect(pack)}
      >
        Choose {meta.name} <ArrowRight size={14} />
      </button>
    </div>
  )
}

/**
 * The free trial as a catalog card. Not purchasable — new accounts already
 * have it — so the CTA simply returns to the app.
 */
export function FreePlanCard() {
  return (
    <div className="plan-card">
      <span className="plan-icon plan-icon--free">
        <Gift size={20} strokeWidth={1.9} />
      </span>
      <h3 className="plan-name">{FREE_PLAN.name}</h3>
      <p className="plan-quota-line">
        <span className="text-mono">{FREE_PLAN.credits}</span> {FREE_PLAN.quotaUnit}
      </p>

      <ul className="plan-features">
        {FREE_PLAN.features.map(f => (
          <li key={f}>
            <PlanCheck />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="plan-price">
        <span className="plan-price-amount text-mono">฿0</span>
      </div>
      <p className="plan-rate">One-time trial</p>

      <button
        type="button"
        className="btn btn-outline plan-cta"
        onClick={() => {
          window.location.hash = '#/'
        }}
      >
        {FREE_PLAN.ctaLabel} <ArrowRight size={14} />
      </button>
    </div>
  )
}

/** Enterprise — full-width contact band below the tier row. */
export function EnterpriseBand({ onContact }: { onContact: () => void }) {
  return (
    <div className="enterprise-band">
      <div className="enterprise-main">
        <div className="enterprise-head">
          <h3 className="enterprise-name">{ENTERPRISE.name}</h3>
          <span className="enterprise-badge">{ENTERPRISE.badge}</span>
        </div>
        <p className="enterprise-tagline">{ENTERPRISE.tagline}</p>
        <ul className="enterprise-features">
          {ENTERPRISE.features.map(f => (
            <li key={f}>
              <PlanCheck />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="enterprise-cta">
        <span className="enterprise-price-note">{ENTERPRISE.priceNote}</span>
        <button type="button" className="btn btn-outline enterprise-btn" onClick={onContact}>
          <MessageCircle size={14} /> Contact sales
        </button>
      </div>
    </div>
  )
}
