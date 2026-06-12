import { useCallback, useEffect, useState } from 'react'
import { listOrders, type CreditOrder } from '../../lib/api/credits'

interface OrderHistoryState {
  orders: CreditOrder[]
  loading: boolean
  error: string | null
  reload: () => void
}

/** Loads this tenant's credit orders (newest first), with manual reload. */
export function useOrderHistory(): OrderHistoryState {
  const [orders, setOrders] = useState<CreditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listOrders()
      .then(setOrders)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return { orders, loading, error, reload: load }
}
