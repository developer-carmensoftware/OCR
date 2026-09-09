import {
  ArrowRight,
  MessageCircle,
  Sparkles,
  Rocket,
  Gem,
  Crown,
  Building2,
  type LucideIcon,
} from 'lucide-react'
import { formatThb } from '../../lib/money'
import { ENTERPRISE, perDoc, type PackPresentation } from '../../constants/billing'
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

const TIER_ICONS: Record<string, { Icon: LucideIcon; tint: string }> = {
  sub_lite: { Icon: Sparkles, tint: 'plan-icon--lite' },
  sub_starter: { Icon: Rocket, tint: 'plan-icon--starter' },
  sub_growth: { Icon: Gem, tint: 'plan-icon--growth' },
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
  // The card's <h3> already names the tier, so the button prints the action only.
  // "Upgrade to Professional" restated that heading and, at 4-up (~160px of card),
  // could not fit on one line. The tier-specific phrase stays as the accessible
  // name so a screen reader moving button to button still hears four distinct
  // actions rather than "Upgrade plan" four times.
  // A smaller tier is a downgrade, not an upgrade: before Lite existed this branch
  // was rare enough to go unnoticed, but a tier below Starter means every
  // subscriber now meets it on the first card, and "Upgrade to Lite" told them the
  // opposite of the truth on a screen about money.
  const ctaLabel = isCurrentPlan
    ? t('plan.ctaRenew')
    : isDowngrade
      ? t('plan.ctaDowngrade')
      : activePlanCode
        ? t('plan.ctaUpgrade')
        : t('plan.ctaChoose')
  const ctaName = isCurrentPlan
    ? t('plan.renew', { name: meta.name })
    : isDowngrade
      ? t('plan.downgrade', { name: meta.name })
      : activePlanCode
        ? t('plan.upgrade', { name: meta.name })
        : t('plan.choose', { name: meta.name })
  // Annual: pay for fewer months up front (2 free); the doc allowance is still
  // per month, so the hero stays the per-month price — just the discounted one.
  const annual = period === 'annual' && pack.price_annual_thb != null
  const annualTotal = pack.price_annual_thb ?? pack.price_thb * 12
  const monthlyEquivalent = annual ? annualTotal / 12 : pack.price_thb
  const savePct = annual ? Math.round((1 - monthlyEquivalent / pack.price_thb) * 100) : 0
  const rate = perDoc(annual ? monthlyEquivalent : pack.price_thb, pack.credits)
  const icon = TIER_ICONS[pack.code]
  return (
    <div className={`plan-card${meta.highlight ? ' is-highlight' : ''}`} data-tier={pack.code}>
      {meta.badge && <span className="plan-badge">{t('plan.badgePopular')}</span>}
      {icon && (
        <span className={`plan-icon ${icon.tint}`}>
          <icon.Icon size={20} />
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
      {annual && (
        <p className="plan-rate">
          {t('plan.billedYearly', { total: formatThb(annualTotal) })}{' '}
          <span className="plan-save">{t('plan.saveAnnualPct', { pct: savePct })}</span>
        </p>
      )}
      <p className="plan-rate">
        ≈ <span className="text-mono">฿{formatThb(rate, true)}</span> {t('plan.perDoc')}
      </p>

      {/* Why the reason sits on a WRAPPER: a disabled button suppresses its own
          title in every browser, so the hint has to hang off something enabled.
          It can't be a visible line either — that would make this one card taller
          than its siblings and desync the price row across the grid (.plan-price
          is margin-top:auto). .sr-only carries the same sentence to assistive tech
          at zero layout cost, since a title alone is not reliably announced. */}
      <span className="plan-cta-tip" title={isDowngrade ? t('plan.downgradeNote') : undefined}>
        <button
          type="button"
          className={`btn ${meta.highlight ? 'btn-primary' : 'btn-outline'} plan-cta`}
          onClick={() => onSelect(pack)}
          disabled={disabled || isDowngrade}
          aria-label={ctaName}
          aria-describedby={isDowngrade ? `${pack.code}-downgrade` : undefined}
        >
          {ctaLabel} <ArrowRight size={14} />
        </button>
        {isDowngrade && (
          <span id={`${pack.code}-downgrade`} className="sr-only">
            {t('plan.downgradeNote')}
          </span>
        )}
      </span>
    </div>
  )
}

/** Enterprise — a full-width contact band below the plan grid. */
export function EnterpriseCard({ onContact }: { onContact: () => void }) {
  const { t } = useT()
  return (
    <div className="enterprise-band" data-tier="enterprise">
      <span className="enterprise-band-icon">
        <Building2 size={22} />
      </span>
      <div className="enterprise-band-copy">
        <strong className="enterprise-band-name">{ENTERPRISE.name}</strong>
        <span className="enterprise-band-tagline">
          {t('plan.enterpriseTagline')} · {t('plan.customPricing')}
        </span>
      </div>
      <button type="button" className="btn btn-outline enterprise-band-cta" onClick={onContact}>
        <MessageCircle size={14} /> {t('plan.contactSales')}
      </button>
    </div>
  )
}
