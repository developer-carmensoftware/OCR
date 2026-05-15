/**
 * User config API — persists per-BU settings to DB so they survive cache clears.
 */

import { apiFetch } from './client'

export async function getAccountingConfig() {
  const res = await apiFetch('/api/v1/config/accounting')
  if (!res.ok) throw new Error(`Config fetch failed (${res.status})`)
  return res.json()
}

export async function saveAccountingConfig(payload) {
  const res = await apiFetch('/api/v1/config/accounting', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Config save failed (${res.status})`)
  return res.json()
}

export async function getAPVendorMapping(vendorTaxId) {
  const res = await apiFetch(`/api/v1/config/ap-mapping/${encodeURIComponent(vendorTaxId)}`)
  if (!res.ok) throw new Error(`AP mapping fetch failed (${res.status})`)
  return res.json()
}

export async function saveAPVendorMapping(vendorTaxId, mapping) {
  const res = await apiFetch(`/api/v1/config/ap-mapping/${encodeURIComponent(vendorTaxId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping),
  })
  if (!res.ok) throw new Error(`AP mapping save failed (${res.status})`)
  return res.json()
}
