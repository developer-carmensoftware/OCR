import { formatThb } from '@/shared/lib/money'
import { PACK_META, perDoc } from '@/features/billing/constants'
import { useT } from '@/i18n/LanguageContext'
import type { CreditPack } from '@/shared/api/credits'

interface Props {
  packs: CreditPack[]
  onSelect: (pack: CreditPack) => void
  disabled?: boolean
}

/**
 * Top-up packs as one segmented rail — deliberately NOT the tier card grid, so
 * "buy once, pick a quantity" reads differently from "subscribe monthly". Each
 * segment starts checkout, and says how much cheaper per document it is than the
 * dearest pack; that figure is derived from the catalog, so a DB reprice needs no
 * frontend edit.
 */
export default function PackList({ packs, onSelect, disabled }: Props) {
  const { t } = useT()
  const maxRate = Math.max(...packs.map(p => perDoc(p.price_thb, p.credits)))
  return (
    <div className="pack-grid">
      {packs.map(pack => {
        const meta = PACK_META[pack.code]
        const rate = perDoc(pack.price_thb, pack.credits)
        const save = maxRate > 0 ? Math.round((1 - rate / maxRate) * 100) : 0
        return (
          <button
            type="button"
            key={pack.code}
            className="pack-card"
            onClick={() => onSelect(pack)}
            disabled={disabled}
          >
            <span className="pack-card-id">
              <span className="pack-card-credits text-mono">{pack.credits.toLocaleString()}</span>
              <span className="pack-card-unit">
                {t('pack.creditsUnit')}
                {meta?.badge && <span className="pack-card-badge">{t('pack.badgeBestValue')}</span>}
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
        )
      })}
    </div>
  )
}
