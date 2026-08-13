import { useState, useEffect, useMemo } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { ChevronRight, Coins } from 'lucide-react'
import { getUsage } from '../../lib/api/auth'
import { getStoredToken } from '../../lib/api/client'
import { useAuth } from '../../contexts/AuthContext'
import type { UsageData } from '../../lib/api/auth'
import { computeUsageStats } from '../../lib/usage'
import { useT } from '../../i18n/LanguageContext'

type T = ReturnType<typeof useT>['t']

/**
 * The CTA half. Static — nothing here depends on the fetch — so the skeleton
 * renders it too and the badge doesn't jump width when data lands.
 *
 * `Coins` is the app's established credit glyph: PackList (the credit packs
 * this links to), CreditsPage, the admin Credits nav and KPI all use it.
 * Keeping it is what ties the badge to its destination. Don't swap it for a
 * tier icon — Gem/Rocket are plan tiers in PlanCard, and Sparkles means AI.
 * It carries "credits" so the word only has to carry the verb, and it stays
 * visible when the label collapses on narrow screens: an icon-only CTA still
 * reads as "buy credits", a lone chevron would not.
 */
function CtaHalf({ t }: { t: T }) {
  return (
    <div className="ui-quota-col col-cta">
      <Coins className="ui-quota-cta-icon" size={14} aria-hidden="true" />
      <span className="ui-quota-cta-text">{t('quota.buy')}</span>
      <ChevronRight className="ui-quota-cta-chevron" size={14} aria-hidden="true" />
    </div>
  )
}

/**
 * The credit badge in the app header — and the only link to #/pricing outside
 * the pricing flow itself. It has to read as clickable; see the note at the top
 * of styles/components/usage-indicator.css for the bug that made it read dead.
 */
export default function UsageIndicator() {
  const [usage, setUsage] = useState<UsageData['usage'] | null>(null)
  const [loading, setLoading] = useState(true)
  const { isAuthenticated } = useAuth() as { isAuthenticated: boolean }
  const { t } = useT()
  const reduceMotion = useReducedMotion()

  const fetchUsage = async () => {
    try {
      const token = getStoredToken()
      if (token) {
        const data = await getUsage(token)
        setUsage(data.usage)
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      // Without this the badge sits in its loading state forever under
      // VITE_DEV_AUTH_BYPASS, which renders children unauthenticated.
      setLoading(false)
      return
    }
    void fetchUsage()
    window.addEventListener('ocr:quota-refresh', fetchUsage)
    return () => {
      window.removeEventListener('ocr:quota-refresh', fetchUsage)
    }
  }, [isAuthenticated])

  const stats = useMemo(() => computeUsageStats(usage), [usage])

  if (!isAuthenticated) return null

  // One render path, not three. The destination is known before the fetch is,
  // and the CTA half is static, so the badge renders whole and live from the
  // first paint — only the count is ever unknown. That removes the loading
  // → loaded structural swap (and the layout shift that came with it), and
  // lets someone click Buy while the count is still arriving.
  //
  // `stats` also stays null when /usage fails. Same treatment: on the wizard
  // pages this is the only route into pricing, so an API error must not delete
  // it. The count degrades, the door stays open.
  const hasCount = !loading && stats !== null

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
      <a
        href="#/pricing"
        aria-busy={loading || undefined}
        aria-label={hasCount ? t('quota.aria', { n: stats.remaining }) : t('quota.ariaNoCount')}
        className={`ui-quota ui-quota--link${stats?.isLow ? ' is-low' : ''}`}
      >
        <div className="ui-quota-col col-remain">
          <span className="ui-quota-label">{t('quota.credit')}</span>
          {loading ? (
            <span className="ui-quota-value-sk sk-block" aria-hidden="true" />
          ) : (
            <span className="ui-quota-value">{stats ? stats.remaining : '–'}</span>
          )}
        </div>
        <CtaHalf t={t} />
      </a>
    </m.div>
  )
}
