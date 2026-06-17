import { ArrowRight, MessageCircle } from 'lucide-react'
import {
  Sparkle,
  RocketLaunch,
  Diamond,
  Crown,
  Buildings,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react'
import { formatThb, formatRate } from '../../lib/money'
import { ENTERPRISE, FREE_PLAN, perDoc, type PackPresentation } from '../../constants/billing'
import type { CreditPack } from '../../lib/api/credits'

interface PlanCardProps {
  pack: CreditPack
  meta: PackPresentation
  onSelect: (pack: CreditPack) => void
}

const TIER_ICONS: Record<string, { Icon: PhosphorIcon; tint: string }> = {
  sub_starter: { Icon: RocketLaunch, tint: 'plan-icon--starter' },
  sub_standard: { Icon: Diamond, tint: 'plan-icon--standard' },
  sub_pro: { Icon: Crown, tint: 'plan-icon--pro' },
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
    <div className={`plan-card${meta.highlight ? ' is-highlight' : ''}`} data-tier={pack.code}>
      {meta.badge && <span className="plan-badge">{meta.badge}</span>}
      {icon && (
        <span className={`plan-icon ${icon.tint}`}>
          <icon.Icon size={20} weight="duotone" />
        </span>
      )}
      <h3 className="plan-name">{meta.name}</h3>
      <p className="plan-quota-line">
        <span className="text-mono">{pack.credits.toLocaleString()}</span> documents / month
      </p>

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
    <div className="plan-card" data-tier="free">
      <span className="plan-icon plan-icon--free">
        <Sparkle size={20} weight="duotone" />
      </span>
      <h3 className="plan-name">{FREE_PLAN.name}</h3>
      <p className="plan-quota-line">
        <span className="text-mono">{FREE_PLAN.credits}</span> {FREE_PLAN.quotaUnit}
      </p>

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

/** Enterprise — a contact-sales tier, same card anatomy as the priced tiers. */
export function EnterpriseCard({ onContact }: { onContact: () => void }) {
  return (
    <div className="plan-card" data-tier="enterprise">
      <span className="plan-icon plan-icon--enterprise">
        <Buildings size={20} weight="duotone" />
      </span>
      <h3 className="plan-name">{ENTERPRISE.name}</h3>
      <p className="plan-quota-line">{ENTERPRISE.tagline}</p>

      <div className="plan-price">
        <span className="plan-price-amount">Custom</span>
      </div>
      <p className="plan-rate">{ENTERPRISE.priceNote}</p>

      <button type="button" className="btn btn-outline plan-cta" onClick={onContact}>
        <MessageCircle size={14} /> Contact sales
      </button>
    </div>
  )
}
