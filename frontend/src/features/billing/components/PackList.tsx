import { useState, type PointerEvent } from 'react'
import { m } from 'framer-motion'
import { formatThb } from '@/shared/lib/money'
import { useEntrance } from '@/shared/lib/useEntrance'
import { PACK_META, perDoc } from '@/features/billing/constants'
import { useT } from '@/i18n/LanguageContext'
import type { CreditPack } from '@/shared/api/credits'

interface Props {
  packs: CreditPack[]
  onSelect: (pack: CreditPack) => void
  disabled?: boolean
}

/** Same curve as `--ease-out` in base.css. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const

// Entrance, first view per session only. Full transform strings rather than framer's
// x/y shorthands, which run on the main thread.
const railVariants = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const segmentVariants = {
  hidden: { opacity: 0, transform: 'translateY(8px)' },
  show: {
    opacity: 1,
    transform: 'translateY(0px)',
    transition: { duration: 0.35, ease: EASE_OUT },
  },
}
// The saving lands just after its segment, so the eye reads the number, then the deal.
const chipVariants = {
  hidden: { opacity: 0, transform: 'scale(0.9)' },
  show: {
    opacity: 1,
    transform: 'scale(1)',
    transition: { delay: 0.15, duration: 0.25, ease: EASE_OUT },
  },
}

interface Glide {
  x: number
  y: number
  w: number
  h: number
  on: boolean
  /** Arriving from outside the rail: appear in place instead of sliding from the last spot. */
  instant: boolean
}

/**
 * Top-up packs as one segmented rail — deliberately NOT the tier card grid, so
 * "buy once, pick a quantity" reads differently from "subscribe monthly". Each
 * segment starts checkout, and says how much cheaper per document it is than the
 * dearest pack; that figure is derived from the catalog, so a DB reprice needs no
 * frontend edit. One highlight glides between segments under the mouse, so moving
 * along the rail reads as one surface rather than four cells flicking on and off.
 */
export default function PackList({ packs, onSelect, disabled }: Props) {
  const { t } = useT()
  const enter = useEntrance('pricing-packs')
  const [glide, setGlide] = useState<Glide | null>(null)
  const maxRate = Math.max(...packs.map(p => perDoc(p.price_thb, p.credits)))

  // Mouse only: touch has no hover, and keyboard focus has its own ring —
  // a keyboard action should never wait on an animation.
  const glideTo = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'mouse' || disabled) return
    const el = e.currentTarget
    setGlide(g => ({
      x: el.offsetLeft,
      y: el.offsetTop,
      w: el.offsetWidth,
      h: el.offsetHeight,
      on: true,
      instant: !g?.on,
    }))
  }

  return (
    <m.div
      className="pack-grid"
      variants={railVariants}
      initial={enter ? 'hidden' : false}
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      onPointerLeave={() => setGlide(g => g && { ...g, on: false })}
    >
      <span
        className="pack-glide"
        aria-hidden="true"
        data-on={glide?.on || undefined}
        data-instant={glide?.instant || undefined}
        style={
          glide
            ? {
                width: glide.w,
                height: glide.h,
                transform: `translate(${glide.x}px, ${glide.y}px)`,
              }
            : undefined
        }
      />
      {packs.map(pack => {
        const meta = PACK_META[pack.code]
        const rate = perDoc(pack.price_thb, pack.credits)
        const save = maxRate > 0 ? Math.round((1 - rate / maxRate) * 100) : 0
        return (
          <m.button
            type="button"
            key={pack.code}
            className="pack-card"
            variants={segmentVariants}
            onPointerEnter={glideTo}
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
                  <m.span className="pack-card-save" variants={chipVariants}>
                    {t('pack.save', { pct: save })}
                  </m.span>
                )}
              </span>
            </span>
          </m.button>
        )
      })}
    </m.div>
  )
}
