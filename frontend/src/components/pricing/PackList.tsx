import { Coins } from 'lucide-react'
import { formatThb, formatRate } from '../../lib/money'
import { PACK_META, perDoc } from '../../constants/billing'
import type { CreditPack } from '../../lib/api/credits'

interface Props {
  packs: CreditPack[]
  onSelect: (pack: CreditPack) => void
}

/**
 * Top-up packs as compact clickable cards — deliberately NOT the tier card
 * grid, so "buy once" reads differently from "subscribe monthly". The credit
 * count leads; the whole card starts checkout.
 */
export default function PackList({ packs, onSelect }: Props) {
  return (
    <div className="pack-grid">
      {packs.map(pack => {
        const meta = PACK_META[pack.code]
        const rate = perDoc(pack.price_thb, pack.credits)
        return (
          <button
            type="button"
            key={pack.code}
            className="pack-card"
            onClick={() => onSelect(pack)}
          >
            <span className="pack-card-icon">
              <Coins size={18} />
            </span>
            <span className="pack-card-id">
              <span className="pack-card-credits text-mono">{pack.credits.toLocaleString()}</span>
              <span className="pack-card-unit">
                credits
                {meta?.badge && <span className="pack-card-badge">{meta.badge}</span>}
              </span>
            </span>
            <span className="pack-card-price">
              <span className="pack-card-amount text-mono">฿{formatThb(pack.price_thb)}</span>
              <span className="pack-card-rate text-mono">฿{formatRate(rate)}/doc</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
