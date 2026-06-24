import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { listOrders, type CreditOrder } from '../../lib/api/credits'
import { useT } from '../../i18n/LanguageContext'

interface OrderHistoryState {
  orders: CreditOrder[]
  loading: boolean
  error: string | null
  reload: () => void
}

const POLL_MS = 20_000
const OPEN_STATUSES = new Set(['in_progress'])

/**
 * Loads this tenant's credit orders (newest first). Refetches when the tab
 * regains focus and polls while an order is still open, so an admin decision
 * (approve/reject) surfaces without a manual reload — with a toast on the flip.
 */
export function useOrderHistory(): OrderHistoryState {
  const { t } = useT()
  const [orders, setOrders] = useState<CreditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Previous status by order id; null until the first load (so we don't toast on mount).
  const prevStatus = useRef<Map<string, string> | null>(null)

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      listOrders()
        .then(next => {
          const prev = prevStatus.current
          if (prev) {
            for (const o of next) {
              const was = prev.get(o.id)
              if (was === 'in_progress' && o.status === 'paid') {
                toast.success(t('order.approvedToast'))
              } else if (was === 'in_progress' && o.status === 'void') {
                toast.error(t('order.rejectedToast'))
              }
            }
          }
          prevStatus.current = new Map(next.map(o => [o.id, o.status]))
          setOrders(next)
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => {
          if (!silent) setLoading(false)
        })
    },
    [t]
  )

  useEffect(() => {
    load()
  }, [load])

  // Silent refetch when the user returns to the tab.
  useEffect(() => {
    const silent = () => load(true)
    const onVisible = () => {
      if (document.visibilityState === 'visible') silent()
    }
    window.addEventListener('focus', silent)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', silent)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // Poll while any order is still open; stop once none are.
  const hasOpen = orders.some(o => OPEN_STATUSES.has(o.status))
  useEffect(() => {
    if (!hasOpen) return
    const id = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(id)
  }, [hasOpen, load])

  return { orders, loading, error, reload: load }
}
