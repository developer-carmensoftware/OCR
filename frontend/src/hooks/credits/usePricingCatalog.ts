import { useEffect, useState } from 'react'
import { getCreditPacks, type CreditPack } from '../../lib/api/credits'

interface CatalogState {
  plans: CreditPack[]
  packs: CreditPack[]
  loading: boolean
  error: string | null
}

/** Loads the catalog once and splits it into subscription tiers and top-up packs. */
export function usePricingCatalog(): CatalogState {
  const [plans, setPlans] = useState<CreditPack[]>([])
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getCreditPacks()
      .then(all => {
        if (!alive) return
        const sorted = [...all].sort((a, b) => a.sort_order - b.sort_order)
        setPlans(sorted.filter(p => p.kind === 'subscription'))
        setPacks(sorted.filter(p => p.kind === 'topup'))
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  return { plans, packs, loading, error }
}
