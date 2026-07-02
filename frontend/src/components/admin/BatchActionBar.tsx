import { createPortal } from 'react-dom'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Loader2, X, type LucideIcon } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'

export interface BatchAction {
  key: string
  icon: LucideIcon
  labelKey: TKey
  /** btn-confirm | btn-outline | btn-danger — matches the shared .btn vocabulary. */
  cls: string
  onRun: () => void
}

interface Props {
  count: number
  actions: BatchAction[]
  busy: boolean
  onClear: () => void
}

/**
 * Floating bulk-action bar — pinned to the bottom of the viewport (not just the
 * table), the same "act on what I've selected" surface as .orev-actionbar inside
 * the drawer, but for a multi-row selection instead of a single order.
 */
export default function BatchActionBar({ count, actions, busy, onClear }: Props) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const open = count > 0 && actions.length > 0

  const barMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 16 },
        transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
      }

  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div
          className="orev-batchbar"
          role="toolbar"
          aria-label={t('orev.selectAll')}
          {...barMotion}
        >
          <button
            type="button"
            className="orev-batchbar-clear"
            onClick={onClear}
            aria-label={t('orev.batchbar.clear')}
          >
            <X size={14} />
          </button>
          <span className="orev-batchbar-count">{t('orev.batchbar.selected', { n: count })}</span>
          <div className="orev-batchbar-actions">
            {actions.map(a => (
              <button
                key={a.key}
                type="button"
                className={`btn ${a.cls} orev-mini`}
                onClick={a.onRun}
                disabled={busy}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <a.icon size={14} />}
                {t(a.labelKey, { n: count })}
              </button>
            ))}
          </div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
