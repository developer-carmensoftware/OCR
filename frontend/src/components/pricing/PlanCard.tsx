import { Check, ArrowRight, MessageCircle } from 'lucide-react'
import { formatThb, formatRate } from '../../lib/money'
import { ENTERPRISE, perDoc, type PackPresentation } from '../../constants/billing'
import type { CreditPack } from '../../lib/api/credits'

interface PlanCardProps {
  pack: CreditPack
  meta: PackPresentation
  onSelect: (pack: CreditPack) => void
}

/**
 * A subscription tier card. The monthly document quota is the hero — it's the
 * only thing that differs between tiers. Shared capabilities are listed once
 * below the grid (PLAN_INCLUDES), not repeated here.
 */
export function PlanCard({ pack, meta, onSelect }: PlanCardProps) {
  const rate = perDoc(pack.price_thb, pack.credits)
  return (
    <div className={`plan-card${meta.highlight ? ' is-highlight' : ''}`}>
      {meta.badge && <span className="plan-badge">{meta.badge}</span>}
      <div className="plan-card-head">
        <h3 className="plan-name">{meta.name}</h3>
        <p className="plan-tagline">{meta.tagline}</p>
      </div>

      <div className="plan-quota">
        <span className="plan-quota-value text-mono">{pack.credits.toLocaleString()}</span>
        <span className="plan-quota-unit">documents / month</span>
      </div>

      <div className="plan-price">
        <span className="plan-price-amount text-mono">฿{formatThb(pack.price_thb)}</span>
        <span className="plan-price-period">/ mo</span>
      </div>
      <div className="plan-rate text-mono">≈ ฿{formatRate(rate)} / doc</div>

      <div className="plan-spacer" aria-hidden="true" />
      <button type="button" className="btn btn-primary plan-cta" onClick={() => onSelect(pack)}>
        Choose {meta.name} <ArrowRight size={14} />
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
              <Check size={15} className="plan-feature-check" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="enterprise-cta">
        <span className="enterprise-price-note">{ENTERPRISE.priceNote}</span>
        <button type="button" className="btn btn-primary enterprise-btn" onClick={onContact}>
          <MessageCircle size={14} /> Contact sales
        </button>
      </div>
    </div>
  )
}
