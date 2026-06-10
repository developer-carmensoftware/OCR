import { apiFetch } from './client'
import { API } from './endpoints'

export interface CarmenCodeItem {
  Code: string
  Name: string
  [key: string]: unknown
}

async function _parseCarmenHttpError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { detail?: string }
    return json.detail || JSON.stringify(json)
  } catch {
    return await res.text()
  }
}

export async function fetchAccountCodes(): Promise<CarmenCodeItem[]> {
  const res = await apiFetch(API.carmen.accountCodes)
  if (!res.ok) throw new Error(`Failed to fetch account codes (${res.status})`)
  const json = (await res.json()) as { Data?: CarmenCodeItem[] }
  return json.Data || []
}

export async function fetchDepartments(): Promise<CarmenCodeItem[]> {
  const res = await apiFetch(API.carmen.departments)
  if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
  const json = (await res.json()) as { Data?: CarmenCodeItem[] }
  return json.Data || []
}

export async function fetchGLPrefixes(): Promise<CarmenCodeItem[]> {
  const res = await apiFetch(API.carmen.glPrefix)
  if (!res.ok) throw new Error(`Failed to fetch GL prefixes (${res.status})`)
  const json = (await res.json()) as { Data?: CarmenCodeItem[] }
  return json.Data || []
}

export interface TaxProfileItem {
  code: string
  desc: string
  rate?: number
}

export async function fetchTaxProfiles(): Promise<TaxProfileItem[]> {
  const res = await apiFetch(API.carmen.taxProfiles)
  if (!res.ok) throw new Error(`Failed to fetch tax profiles (${res.status})`)
  const json = (await res.json()) as { Data?: Array<Record<string, unknown>> }
  return (json.Data || [])
    .filter(p => p.Active !== false) // hide inactive profiles
    .map(p => ({
      code: String(p.Code ?? ''), // e.g. "VAT07"
      desc: String(p.Description ?? ''), // e.g. "VAT 7%"
      rate: p.TaxRate != null ? Number(p.TaxRate) : undefined,
    }))
    .filter(p => p.code)
}

export async function submitToCarmen(
  payload: unknown,
  credit_card_id: string | null = null,
  metadata?: {
    doc_no?: string
    company_name?: string
    bank_code?: string
    branch_no?: string
  }
): Promise<unknown> {
  let url: string = API.carmen.gljv
  const params = new URLSearchParams()
  if (credit_card_id) params.append('credit_card_id', credit_card_id)
  if (metadata) {
    if (metadata.doc_no) params.append('doc_no', metadata.doc_no)
    if (metadata.company_name) params.append('company_name', metadata.company_name)
    if (metadata.bank_code) params.append('bank_code', metadata.bank_code)
    if (metadata.branch_no) params.append('branch_no', metadata.branch_no)
  }
  const q = params.toString()
  if (q) url += `?${q}`

  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await _parseCarmenHttpError(res)
    throw new Error(detail)
  }
  return res.json()
}

export async function submitAPInvoiceToCarmen(
  payload: unknown,
  ap_invoice_id: string | null = null
): Promise<unknown> {
  const url = ap_invoice_id
    ? `${API.carmen.invoice}?ap_invoice_id=${ap_invoice_id}`
    : API.carmen.invoice

  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await _parseCarmenHttpError(res)
    throw new Error(detail)
  }
  return res.json()
}

export async function submitInputTax(payload: unknown): Promise<unknown> {
  const res = await apiFetch(API.carmen.inputTax, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await _parseCarmenHttpError(res)
    throw new Error(detail)
  }
  return res.json()
}
