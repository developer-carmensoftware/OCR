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
import { useT } from '../../i18n/LanguageContext'
import type { BillingPeriod, CreditPack } from '../../lib/api/credits'

interface PlanCardProps {
  pack: CreditPack
  meta: PackPresentation
  period?: BillingPeriod
  onSelect: (pack: CreditPack) => void
  disabled?: boolean
  /** Current active plan code, if any — drives upgrade/renew/downgrade labels. */
  activePlanCode?: string | null
  /** Doc allowance of the current active plan — used to determine tier rank. */
  activePlanCredits?: number
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
export function PlanCard({
  pack,
  meta,
  period = 'monthly',
  onSelect,
  disabled,
  activePlanCode,
  activePlanCredits,
}: PlanCardProps) {
  const { t } = useT()
  const isCurrentPlan = activePlanCode === pack.code
  const isDowngrade = activePlanCredits != null && pack.credits < activePlanCredits
  const ctaLabel = isCurrentPlan
    ? t('plan.renew', { name: meta.name })
    : activePlanCode
      ? t('plan.upgrade', { name: meta.name })
      : t('plan.choose', { name: meta.name })
  // Annual: pay for fewer months up front (2 free); the doc allowance is still
  // per month, so the hero stays the per-month price — just the discounted one.
  const annual = period === 'annual' && pack.price_annual_thb != null
  const annualTotal = pack.price_annual_thb ?? pack.price_thb * 12
  const monthlyEquivalent = annual ? annualTotal / 12 : pack.price_thb
  const savePct = annual ? Math.round((1 - monthlyEquivalent / pack.price_thb) * 100) : 0
  const rate = perDoc(pack.price_thb, pack.credits)
  const icon = TIER_ICONS[pack.code]
  return (
    <div className={`plan-card${meta.highlight ? ' is-highlight' : ''}`} data-tier={pack.code}>
      {meta.badge && <span className="plan-badge">{t('plan.badgePopular')}</span>}
      {icon && (
        <span className={`plan-icon ${icon.tint}`}>
          <icon.Icon size={20} weight="duotone" />
        </span>
      )}
      <h3 className="plan-name">{meta.name}</h3>
      <p className="plan-quota-line">
        <span className="text-mono">{pack.credits.toLocaleString()}</span>{' '}
        {t('plan.docsPerMonthSuffix')}
      </p>

      <span
        className="plan-price-was text-mono"
        style={annual ? undefined : { visibility: 'hidden' }}
      >
        ฿{formatThb(pack.price_thb)}
      </span>
      <div className="plan-price">
        <span className="plan-price-amount text-mono">
          ฿{formatThb(annual ? monthlyEquivalent : pack.price_thb)}
        </span>
        <span className="plan-price-period">{t('plan.perMonth')}</span>
      </div>
      {annual ? (
        <p className="plan-rate">
          {t('plan.billedYearly', { total: formatThb(annualTotal) })}{' '}
          <span className="plan-save">{t('plan.saveAnnualPct', { pct: savePct })}</span>
        </p>
      ) : (
        <p className="plan-rate">
          ≈ <span className="text-mono">฿{formatRate(rate)}</span> {t('plan.perDoc')}
        </p>
      )}

      <button
        type="button"
        className={`btn ${meta.highlight ? 'btn-primary' : 'btn-outline'} plan-cta`}
        onClick={() => onSelect(pack)}
        disabled={disabled || isDowngrade}
      >
        {ctaLabel} <ArrowRight size={14} />
      </button>
    </div>
  )
}

/**
 * The free trial as a catalog card. Not purchasable — new accounts already
 * have it — so the CTA simply returns to the app.
 */
export function FreePlanCard() {
  const { t } = useT()
  return (
    <div className="plan-card" data-tier="free">
      <span className="plan-icon plan-icon--free">
        <Sparkle size={20} weight="duotone" />
      </span>
      <h3 className="plan-name">{FREE_PLAN.name}</h3>
      <p className="plan-quota-line">
        <span className="text-mono">{FREE_PLAN.credits}</span> {t('plan.docsUnit')}
      </p>

      <div className="plan-price">
        <span className="plan-price-amount text-mono">฿0</span>
      </div>
      <p className="plan-rate">{t('plan.oneTimeTrial')}</p>

      <button
        type="button"
        className="btn btn-outline plan-cta"
        onClick={() => {
          window.location.hash = '#/'
        }}
      >
        {t('plan.startScanning')} <ArrowRight size={14} />
      </button>
    </div>
  )
}

/** Enterprise — a contact-sales tier, same card anatomy as the priced tiers. */
export function EnterpriseCard({ onContact }: { onContact: () => void }) {
  const { t } = useT()
  return (
    <div className="plan-card" data-tier="enterprise">
      <span className="plan-icon plan-icon--enterprise">
        <Buildings size={20} weight="duotone" />
      </span>
      <h3 className="plan-name">{ENTERPRISE.name}</h3>
      <p className="plan-quota-line">{t('plan.enterpriseTagline')}</p>

      <div className="plan-price">
        <span className="plan-price-amount">{t('plan.custom')}</span>
      </div>
      <p className="plan-rate">{t('plan.customPricing')}</p>

      <button type="button" className="btn btn-outline plan-cta" onClick={onContact}>
        <MessageCircle size={14} /> {t('plan.contactSales')}
      </button>
    </div>
  )
}
