import { apiFetch } from './client'

export interface CarmenCodeItem {
  Code: string
  Name: string
  [key: string]: unknown
}

async function _parseCarmenHttpError(res: Response): Promise<string> {
  try {
    const json = await res.json() as { detail?: string }
    return json.detail || JSON.stringify(json)
  } catch {
    return await res.text()
  }
}

export async function fetchAccountCodes(): Promise<CarmenCodeItem[]> {
  const res = await apiFetch('/api/v1/ocr/carmen/account-codes')
  if (!res.ok) throw new Error(`Failed to fetch account codes (${res.status})`)
  const json = await res.json() as { Data?: CarmenCodeItem[] }
  return json.Data || []
}

export async function fetchDepartments(): Promise<CarmenCodeItem[]> {
  const res = await apiFetch('/api/v1/ocr/carmen/departments')
  if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
  const json = await res.json() as { Data?: CarmenCodeItem[] }
  return json.Data || []
}

export async function fetchGLPrefixes(): Promise<CarmenCodeItem[]> {
  const res = await apiFetch('/api/v1/ocr/carmen/gl-prefix')
  if (!res.ok) throw new Error(`Failed to fetch GL prefixes (${res.status})`)
  const json = await res.json() as { Data?: CarmenCodeItem[] }
  return json.Data || []
}

export async function submitToCarmen(payload: unknown): Promise<unknown> {
  const res = await apiFetch('/api/v1/ocr/carmen/gljv', {
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
    ? `/api/v1/ocr/carmen/invoice?ap_invoice_id=${ap_invoice_id}`
    : '/api/v1/ocr/carmen/invoice'

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
  const res = await apiFetch('/api/v1/ocr/carmen/input-tax', {
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
