import { Coins, Plus } from 'lucide-react'
import { formatThb, formatRate } from '../../lib/money'
import { PACK_META, perDoc } from '../../constants/billing'
import type { CreditPack } from '../../lib/api/credits'

interface Props {
  packs: CreditPack[]
  onSelect: (pack: CreditPack) => void
}

/**
 * Top-up packs as a compact comparison list — deliberately NOT the same card
 * grid as the plans, so "buy once, never expires" reads differently from
 * "subscribe monthly".
 */
export default function PackList({ packs, onSelect }: Props) {
  return (
    <ul className="pack-list">
      {packs.map(pack => {
        const meta = PACK_META[pack.code]
        const rate = perDoc(pack.price_thb, pack.credits)
        return (
          <li key={pack.code} className="pack-row">
            <div className="pack-row-lead">
              <span className="pack-row-icon">
                <Coins size={18} />
              </span>
              <div className="pack-row-id">
                <span className="pack-row-name">
                  {meta?.name ?? pack.code}
                  {meta?.badge && <span className="pack-row-badge">{meta.badge}</span>}
                </span>
                <span className="pack-row-credits text-mono">
                  {pack.credits.toLocaleString()} credits
                </span>
              </div>
            </div>
            <span className="pack-row-rate text-mono">฿{formatRate(rate)}/doc</span>
            <span className="pack-row-price text-mono">฿{formatThb(pack.price_thb)}</span>
            <button
              type="button"
              className="btn btn-outline pack-row-btn"
              onClick={() => onSelect(pack)}
            >
              <Plus size={14} /> Top up
            </button>
          </li>
        )
      })}
    </ul>
  )
}
