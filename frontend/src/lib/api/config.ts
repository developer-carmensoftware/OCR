import { apiFetch } from './client'
import { API } from './endpoints'
import type { AccountingConfigRequest, AccountingConfigResponse } from '../../types/api'

export interface APVendorMapping {
  col_mappings: Record<string, string>
  field_mappings: Record<string, string>
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

export async function getAPVendorMapping(vendorTaxId: string): Promise<APVendorMapping> {
  const res = await apiFetch(API.config.apMapping(vendorTaxId))
  if (!res.ok) throw new Error(`AP mapping fetch failed (${res.status})`)
  return res.json() as Promise<APVendorMapping>
}

export async function saveAPVendorMapping(
  vendorTaxId: string,
  mapping: APVendorMapping
): Promise<APVendorMapping> {
  const res = await apiFetch(API.config.apMapping(vendorTaxId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping),
  })
  if (!res.ok) throw new Error(`AP mapping save failed (${res.status})`)
  return res.json() as Promise<APVendorMapping>
}
