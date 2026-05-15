/**
 * Mapping API — GL account/department mapping suggestions and history.
 */

import { apiFetch } from './client'

export async function suggestMapping(payload) {
  const res = await apiFetch('/api/v1/mapping/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[suggestMapping] Error body:', errBody)
    throw new Error(`Suggest failed (${res.status})`)
  }
  return res.json()
}

export async function suggestPaymentTypes(payload) {
  const res = await apiFetch('/api/v1/mapping/suggest-payment-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Suggest payment types failed (${res.status})`)
  return res.json()
}

export async function fetchMappingHistory(bankCode) {
  const res = await apiFetch(`/api/v1/mapping/history?bank_code=${encodeURIComponent(bankCode)}`)
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`)
  return res.json()
}

export async function saveMappingHistory(payload) {
  const res = await apiFetch('/api/v1/mapping/history/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`History save failed (${res.status})`)
  return res.json()
}
