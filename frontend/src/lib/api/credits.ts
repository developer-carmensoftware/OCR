import { apiFetch } from './client'
import { API } from './endpoints'

// ── Catalog ───────────────────────────────────────────────────────────────────

export type PackKind = 'subscription' | 'topup'

export type BillingPeriod = 'monthly' | 'annual'

export interface CreditPack {
  code: string
  kind: PackKind
  credits: number
  price_thb: number
  /** Annual list price (12 months − 10%); present for subscription tiers only. */
  price_annual_thb?: number | null
  sort_order: number
}

// ── Orders & documents ────────────────────────────────────────────────────────

export type OrderStatus = 'in_progress' | 'paid' | 'complete' | 'void' | 'on_hold'

/** Orders still open: block a new purchase, show in the pending banner, keep polling. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ['in_progress', 'on_hold']

export interface CreditOrder {
  id: string
  pack_code: string
  credits: number
  amount_thb: number
  billing_period?: BillingPeriod // 'monthly' | 'annual'
  status: OrderStatus
  created_at?: string | null // request date
  slip_uploaded_at?: string | null // slip upload date
  approved_at?: string | null // admin approval date
  expires_at?: string | null // proforma valid-until (pending orders)
  rejected_reason?: string | null // reason the admin gave on rejection (shown to buyer)
}

export interface BuyerInfo {
  name: string
  tax_id: string
  address: string
  branch: string
  email: string
  contact_name: string
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

/** Company-level pay-to details printed on the proforma (bank transfer + cheque). */
export interface PaymentInfo {
  bank_name: string
  bank_account_no: string
  bank_account_name: string
  bank_account_type: string
  bank_branch: string
  cheque_payee: string
  seller_name_en: string
  seller_phone: string
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
  buyer_email: string | null
  buyer_contact_name: string | null
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
class OpenOrderError extends Error {
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

/** Company pay-to details (bank transfer + cheque) printed on the proforma. */
export async function getPaymentInfo(): Promise<PaymentInfo> {
  const res = await apiFetch(API.credits.paymentInfo)
  if (!res.ok) throw new Error(`Failed to load payment info (${res.status})`)
  return res.json() as Promise<PaymentInfo>
}

/** Create a pending order → returns the PromptPay QR payload + proforma invoice. */
export async function createOrder(
  packCode: string,
  buyer?: Partial<BuyerInfo>,
  billingPeriod: BillingPeriod = 'monthly'
): Promise<CreateOrderResponse> {
  const res = await apiFetch(API.credits.orders, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pack_code: packCode,
      billing_period: billingPeriod,
      buyer: buyer ?? null,
    }),
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

/** Discard a still-pending order → frees the open-order lock so the pack can be re-ordered. */
export async function cancelOrder(orderId: string): Promise<CreditOrder> {
  const res = await apiFetch(API.credits.orderCancel(orderId), { method: 'POST' })
  if (!res.ok) throw new Error(await detail(res, `Failed to cancel the order (${res.status})`))
  return res.json() as Promise<CreditOrder>
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
