import { m } from 'framer-motion'
import { formatThb } from '@/shared/lib/money'
import { PACK_META, perDoc } from '@/features/billing/constants'
import { cardVariants, containerVariants } from '@/features/billing/motion'
import { useT } from '@/i18n/LanguageContext'
import type { CreditPack } from '@/shared/api/credits'

interface Props {
  packs: CreditPack[]
  onSelect: (pack: CreditPack) => void
  disabled?: boolean
  /** Play the entrance (the page's `useEntrance` value). Off by default, e.g. in the tour. */
  enter?: boolean
}

/**
 * Top-up packs as a row of cards, spaced and lifted like the plan cards above. The
 * whole card is the button (no CTA: a pack has nothing to configure), and each says
 * how much cheaper per document it is than the dearest pack; that figure is derived
 * from the catalog, so a DB reprice needs no frontend edit.
 *
 * Motion wrapper and card are separate elements, as in the plan grid: framer writes
 * an inline transform on the wrapper during the entrance, which would otherwise
 * override the card's CSS hover lift.
 */
export default function PackList({ packs, onSelect, disabled, enter = false }: Props) {
  const { t } = useT()
  const maxRate = Math.max(...packs.map(p => perDoc(p.price_thb, p.credits)))
  return (
    <m.div
      className="pack-grid"
      variants={containerVariants}
      initial={enter ? 'hidden' : false}
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      {packs.map(pack => {
        const meta = PACK_META[pack.code]
        const rate = perDoc(pack.price_thb, pack.credits)
        const save = maxRate > 0 ? Math.round((1 - rate / maxRate) * 100) : 0
        return (
          <m.div key={pack.code} className="pack-cell" variants={cardVariants}>
            <button
              type="button"
              className="pack-card"
              onClick={() => onSelect(pack)}
              disabled={disabled}
            >
              <span className="pack-card-id">
                <span className="pack-card-credits text-mono">{pack.credits.toLocaleString()}</span>
                <span className="pack-card-unit">
                  {t('pack.creditsUnit')}
                  {meta?.badge && (
                    <span className="pack-card-badge">{t('pack.badgeBestValue')}</span>
                  )}
                </span>
              </span>
              <span className="pack-card-price">
                <span className="pack-card-amount text-mono">฿{formatThb(pack.price_thb)}</span>
                <span className="pack-card-meta">
                  <span className="pack-card-rate text-mono">
                    ฿{formatThb(rate, true)}
                    {t('pack.perDoc')}
                  </span>
                  {save > 0 && (
                    <span className="pack-card-save">{t('pack.save', { pct: save })}</span>
                  )}
                </span>
              </span>
            </button>
          </m.div>
        )
      })}
    </m.div>
  )
}
