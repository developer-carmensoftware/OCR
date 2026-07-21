import { apiFetch } from './client'
import { API } from './endpoints'
import type { AccountingConfigRequest, AccountingConfigResponse } from '../../types/api'

/** Wire shape: the PUT body is a flat {column: field} map; the GET wraps it. */
export type APVendorMapping = Record<string, string>

export interface APVendorMappingResponse {
  vendor_tax_id: string
  mapping: APVendorMapping
}

export async function getAccountingConfig(): Promise<AccountingConfigResponse> {
  const res = await apiFetch(API.config.accounting)
  if (!res.ok) throw new Error(`Config fetch failed (${res.status})`)
  return res.json() as Promise<AccountingConfigResponse>
}

export async function saveAccountingConfig(
  payload: AccountingConfigRequest
): Promise<AccountingConfigResponse> {
  const res = await apiFetch(API.config.accounting, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Config save failed (${res.status})`)
  return res.json() as Promise<AccountingConfigResponse>
}

export async function getAPVendorMapping(vendorTaxId: string): Promise<APVendorMappingResponse> {
  const res = await apiFetch(API.config.apMapping(vendorTaxId))
  if (!res.ok) throw new Error(`AP mapping fetch failed (${res.status})`)
  return res.json() as Promise<APVendorMappingResponse>
}

export async function saveAPVendorMapping(
  vendorTaxId: string,
  mapping: APVendorMapping
): Promise<{ ok: boolean }> {
  const res = await apiFetch(API.config.apMapping(vendorTaxId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping),
  })
  if (!res.ok) throw new Error(`AP mapping save failed (${res.status})`)
  return res.json() as Promise<{ ok: boolean }>
}
