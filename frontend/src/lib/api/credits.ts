import { apiFetch } from './client'

export interface CreditPack {
  code: string
  credits: number
  price_thb: number
  sort_order: number
}

export interface CreditOrder {
  id: string
  pack_code: string
  credits: number
  amount_thb: number
  status: string
}

/** Top-up pack catalog for the current tenant (cheapest first). */
export async function getCreditPacks(): Promise<CreditPack[]> {
  const res = await apiFetch('/api/v1/credits/packs')
  if (!res.ok) throw new Error(`Failed to load credit packs (${res.status})`)
  return res.json() as Promise<CreditPack[]>
}

/** Create a pending top-up order (fulfilled offline by an admin in v1). */
export async function createCreditOrder(packCode: string): Promise<CreditOrder> {
  const res = await apiFetch('/api/v1/credits/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pack_code: packCode }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail || `Failed to create order (${res.status})`)
  }
  return res.json() as Promise<CreditOrder>
}
