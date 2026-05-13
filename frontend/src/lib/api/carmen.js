/**
 * Carmen API — proxy calls to the Carmen Cloud system.
 */

import { apiFetch } from './client'

export async function fetchAccountCodes() {
  const res = await apiFetch('/api/v1/ocr/carmen/account-codes')
  if (!res.ok) throw new Error(`Failed to fetch account codes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

export async function fetchDepartments() {
  const res = await apiFetch('/api/v1/ocr/carmen/departments')
  if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

export async function fetchGLPrefixes() {
  const res = await apiFetch('/api/v1/ocr/carmen/gl-prefix')
  if (!res.ok) throw new Error(`Failed to fetch GL prefixes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

async function _parseCarmenHttpError(res) {
  try {
    const json = await res.json()
    return json.detail || JSON.stringify(json)
  } catch {
    return await res.text()
  }
}

export async function submitToCarmen(payload) {
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

export async function submitAPInvoiceToCarmen(payload, ap_invoice_id = null) {
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

export async function submitInputTax(payload) {
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
