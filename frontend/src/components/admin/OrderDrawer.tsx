import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import OrderWorkspace from './OrderWorkspace'
import type { AdminCreditOrder } from '../../lib/api/adminClient'
import type { PaymentInfo } from '../../lib/api/credits'
import { useT } from '../../i18n/LanguageContext'

interface Props {
  order: AdminCreditOrder | null
  paymentInfo: PaymentInfo | null
  onClose: () => void
  onChanged: (updated: AdminCreditOrder) => void
  onMapAr: () => void
  onPostOne: (order: AdminCreditOrder) => void
  posting: boolean
}

/**
 * Right slide-over hosting OrderWorkspace — the single detail surface for an order
 * (slip, proforma, credit history, and the decision/post actions). Every trigger
 * that needs to "look at an order" opens this same drawer; there is no separate
 * quick-view.
 */
export default function OrderDrawer({
  order,
  paymentInfo,
  onClose,
  onChanged,
  onMapAr,
  onPostOne,
  posting,
}: Props) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const open = !!order

  // Escape closes; lock body scroll behind the drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  const panelMotion = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
      }

  return createPortal(
    <AnimatePresence>
      {open && order && (
        <m.div
          className="orev-drawer-scrim"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <m.aside
            className="orev-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('orev.title')}
            onClick={e => e.stopPropagation()}
            {...panelMotion}
          >
            <button
              type="button"
              className="orev-drawer-close"
              onClick={onClose}
              aria-label={t('orev.drawer.close')}
            >
              <X size={18} />
            </button>
            <OrderWorkspace
              order={order}
              paymentInfo={paymentInfo}
              onChanged={onChanged}
              onMapAr={onMapAr}
              onPostOne={onPostOne}
              posting={posting}
            />
          </m.aside>
        </m.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
