import { apiFetch } from './client'
import { API } from './endpoints'

// ── Catalog ───────────────────────────────────────────────────────────────────

export type PackKind = 'subscription' | 'topup'

export interface CreditPack {
  code: string
  kind: PackKind
  credits: number
  price_thb: number
  sort_order: number
}

// ── Orders & documents ────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'awaiting_review' | 'paid' | 'rejected' | 'cancelled'

export interface CreditOrder {
  id: string
  pack_code: string
  credits: number
  amount_thb: number
  status: OrderStatus
}

export interface BuyerInfo {
  name: string
  tax_id: string
  address: string
  branch: string
}

export interface CompanyProfile extends BuyerInfo {
  /** where the prefill came from: 'carmen' | 'last_invoice' | 'form' */
  source: 'carmen' | 'last_invoice' | 'form'
}

export interface QrPayload {
  payload: string
  amount_thb: number
  promptpay_id: string
}

export interface BillingDocument {
  id: string
  doc_type: 'proforma' | 'tax_invoice'
  number: string
  issue_date: string
  seller_name: string | null
  seller_tax_id: string | null
  seller_address: string | null
  seller_branch: string | null
  buyer_name: string | null
  buyer_tax_id: string | null
  buyer_address: string | null
  buyer_branch: string | null
  pack_code: string
  description: string | null
  credits: number
  subtotal: string | number
  vat_rate: string | number
  vat_amount: string | number
  total: string | number
  currency: string
  created_at: string | null
}

export interface CreateOrderResponse {
  order: CreditOrder
  qr: QrPayload
  proforma: BillingDocument
}

/** Raised on a 409 — the tenant already has an open order for this pack. */
export class OpenOrderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OpenOrderError'
  }
}

async function detail(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { detail?: string }
  return err.detail || fallback
}

/** Full catalog (subscription tiers + top-up packs), cheapest-first within kind. */
export async function getCreditPacks(): Promise<CreditPack[]> {
  const res = await apiFetch(API.credits.packs)
  if (!res.ok) throw new Error(`Failed to load plans (${res.status})`)
  return res.json() as Promise<CreditPack[]>
}

/** Prefilled buyer info for the order form (Carmen → last invoice → empty form). */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  const res = await apiFetch(API.credits.companyProfile)
  if (!res.ok) throw new Error(`Failed to load company profile (${res.status})`)
  return res.json() as Promise<CompanyProfile>
}

/** Create a pending order → returns the PromptPay QR payload + proforma invoice. */
export async function createOrder(
  packCode: string,
  buyer?: Partial<BuyerInfo>
): Promise<CreateOrderResponse> {
  const res = await apiFetch(API.credits.orders, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pack_code: packCode, buyer: buyer ?? null }),
  })
  if (res.status === 409)
    throw new OpenOrderError(await detail(res, 'You already have an open order'))
  if (!res.ok) throw new Error(await detail(res, `Failed to create the order (${res.status})`))
  return res.json() as Promise<CreateOrderResponse>
}

/** Upload the payment slip → moves the order to awaiting_review. */
export async function uploadSlip(orderId: string, file: File): Promise<{ status: OrderStatus }> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch(API.credits.orderSlip(orderId), { method: 'POST', body: form })
  if (!res.ok) throw new Error(await detail(res, `Failed to upload the slip (${res.status})`))
  const body = (await res.json()) as { order_id: string; status: OrderStatus }
  return { status: body.status }
}

/** This tenant's orders, newest first. */
export async function listOrders(): Promise<CreditOrder[]> {
  const res = await apiFetch(API.credits.orders)
  if (!res.ok) throw new Error(`Failed to load order history (${res.status})`)
  return res.json() as Promise<CreditOrder[]>
}

/** All billing documents (proforma + tax invoice) issued for an order. */
export async function getOrderDocuments(orderId: string): Promise<BillingDocument[]> {
  const res = await apiFetch(API.credits.orderDocuments(orderId))
  if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
  return res.json() as Promise<BillingDocument[]>
}
