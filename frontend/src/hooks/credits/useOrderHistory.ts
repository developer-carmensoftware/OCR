import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { listOrders, OPEN_ORDER_STATUSES, type CreditOrder } from '../../lib/api/credits'
import { useT } from '../../i18n/LanguageContext'

interface OrderHistoryState {
  /** Every open order (in_progress/on_hold) — never paged; see below. */
  openOrders: CreditOrder[]
  /** One page of settled orders, newest first. */
  history: CreditOrder[]
  /** Pager state for `history` — open orders are never paged. */
  historyOffset: number
  historyLimit: number
  historyTotal: number
  setHistoryOffset: (offset: number) => void
  loading: boolean
  error: string | null
  reload: () => void
}

const POLL_MS = 20_000
const PAGE_SIZE = 8
// Widened to Set<string>: compared against plain-string map values below (`was`).
const OPEN_STATUSES: Set<string> = new Set(OPEN_ORDER_STATUSES)

/**
 * Loads this tenant's credit orders. Refetches when the tab regains focus and polls
 * while an order is still open, so an admin decision (approve/reject) surfaces without
 * a manual reload — with a toast on the flip.
 *
 * The two lists are fetched separately rather than split from one array client-side:
 * the pending banner must show EVERY open order — an on_hold one from three weeks ago
 * still needs the customer to act, and would fall off a page of newest-first rows —
 * while the settled history is the part that grows without bound and gets paged.
 */
export function useOrderHistory(): OrderHistoryState {
  const { t } = useT()
  const [openOrders, setOpenOrders] = useState<CreditOrder[]>([])
  const [history, setHistory] = useState<CreditOrder[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // One window at a time, moved by the pager. ponytail: offset paging — a settled order
  // arriving while the reader sits on page 2 shifts what page 2 holds. Rare and harmless
  // for a list this size; keyset on (created_at, id) if it ever bites.
  const [offset, setOffset] = useState(0)
  // Previous status by order id; null until the first load (so we don't toast on mount).
  const prevStatus = useRef<Map<string, string> | null>(null)

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      Promise.all([
        // Open orders are bounded by the one-open-order-per-pack lock, so `limit` here
        // is a sanity cap, not a window the UI pages through.
        listOrders({ openOnly: true, limit: 100 }),
        listOrders({ openOnly: false, limit: PAGE_SIZE, offset }),
      ])
        .then(([open, settled]) => {
          const prev = prevStatus.current
          if (prev) {
            // ponytail: only what is currently on screen can flip visibly. A decision
            // reached while the reader is on page 3 lands on settled page 1 and skips
            // its toast — the bell still notifies, so nothing is actually lost.
            for (const o of [...open.data, ...settled.data]) {
              const was = prev.get(o.id)
              // Compare against the open-status set (not a single string) so a
              // decision reached while on_hold — or a fast in_progress→complete
              // jump between two 20s polls — still surfaces its toast.
              const wasOpen = !!was && OPEN_STATUSES.has(was)
              if (wasOpen && (o.status === 'paid' || o.status === 'complete')) {
                toast.success(t('order.approvedToast'))
              } else if (wasOpen && o.status === 'void') {
                toast.error(t('order.rejectedToast'))
              }
            }
          }
          prevStatus.current = new Map([...open.data, ...settled.data].map(o => [o.id, o.status]))
          setOpenOrders(open.data)
          setHistory(settled.data)
          setHistoryTotal(settled.total)
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => {
          if (!silent) setLoading(false)
        })
    },
    [t, offset]
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
  const hasOpen = openOrders.length > 0
  useEffect(() => {
    if (!hasOpen) return
    const id = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(id)
  }, [hasOpen, load])

  return {
    openOrders,
    history,
    historyOffset: offset,
    historyLimit: PAGE_SIZE,
    historyTotal,
    setHistoryOffset: setOffset,
    loading,
    error,
    reload: load,
  }
}
