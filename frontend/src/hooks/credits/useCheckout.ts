import { useCallback, useEffect, useState } from 'react'
import {
  createOrder,
  getCompanyProfile,
  uploadSlip,
  type BillingDocument,
  type BuyerInfo,
  type CreateOrderResponse,
  type CreditPack,
  type QrPayload,
} from '../../lib/api/credits'

export type CheckoutPhase = 'buyer' | 'pay' | 'done'

export interface CheckoutSession {
  pack_code: string
  credits: number
  amount_thb: number
  order_id: string
  qr: QrPayload
  proforma: BillingDocument
}

const STORAGE_KEY = 'credits_active_checkout'

const EMPTY_BUYER: BuyerInfo = { name: '', tax_id: '', address: '', branch: '' }

function readPersisted(): CheckoutSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CheckoutSession) : null
  } catch {
    return null
  }
}

function persist(session: CheckoutSession | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sessionStorage unavailable — non-fatal, resume just won't work */
  }
}

/** Read any in-progress checkout so the catalog can auto-resume on mount. */
export function loadPersistedCheckout(): CheckoutSession | null {
  return readPersisted()
}

interface UseCheckout {
  phase: CheckoutPhase
  session: CheckoutSession | null
  buyer: BuyerInfo
  setBuyer: (b: BuyerInfo) => void
  profileSource: 'carmen' | 'last_invoice' | 'form' | null
  loadingProfile: boolean
  creating: boolean
  uploading: boolean
  error: string | null
  confirmBuyer: () => Promise<void>
  submitSlip: (file: File) => Promise<void>
}

/**
 * Drives one purchase: confirm buyer → create order (QR + proforma) → upload slip.
 * `resume` (from sessionStorage) jumps straight to the pay step so a refresh
 * mid-payment keeps the same server-side order rather than creating a duplicate.
 */
export function useCheckout(pack: CreditPack | null, resume?: CheckoutSession | null): UseCheckout {
  const [phase, setPhase] = useState<CheckoutPhase>(resume ? 'pay' : 'buyer')
  const [session, setSession] = useState<CheckoutSession | null>(resume ?? null)
  const [buyer, setBuyer] = useState<BuyerInfo>(EMPTY_BUYER)
  const [profileSource, setProfileSource] = useState<UseCheckout['profileSource']>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prefill buyer info when entering the buyer step fresh (not on resume).
  useEffect(() => {
    if (phase !== 'buyer' || profileSource !== null) return
    let alive = true
    setLoadingProfile(true)
    getCompanyProfile()
      .then(p => {
        if (!alive) return
        setBuyer({ name: p.name, tax_id: p.tax_id, address: p.address, branch: p.branch })
        setProfileSource(p.source)
      })
      .catch(() => alive && setProfileSource('form'))
      .finally(() => alive && setLoadingProfile(false))
    return () => {
      alive = false
    }
  }, [phase, profileSource])

  const confirmBuyer = useCallback(async () => {
    if (!pack) return
    setCreating(true)
    setError(null)
    try {
      const res: CreateOrderResponse = await createOrder(pack.code, buyer)
      const next: CheckoutSession = {
        pack_code: pack.code,
        credits: pack.credits,
        amount_thb: pack.price_thb,
        order_id: res.order.id,
        qr: res.qr,
        proforma: res.proforma,
      }
      setSession(next)
      persist(next)
      setPhase('pay')
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setCreating(false)
    }
  }, [pack, buyer])

  const submitSlip = useCallback(
    async (file: File) => {
      if (!session) return
      setUploading(true)
      setError(null)
      try {
        await uploadSlip(session.order_id, file)
        persist(null)
        setPhase('done')
      } catch (e) {
        setError((e as Error).message)
        throw e
      } finally {
        setUploading(false)
      }
    },
    [session]
  )

  return {
    phase,
    session,
    buyer,
    setBuyer,
    profileSource,
    loadingProfile,
    creating,
    uploading,
    error,
    confirmBuyer,
    submitSlip,
  }
}

/** Clear any persisted in-progress checkout (used when abandoning the flow). */
export function clearPersistedCheckout(): void {
  persist(null)
}
