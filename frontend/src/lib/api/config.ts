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

/**
 * Correct named GL rules, leaving the rest of the config alone.
 *
 * NOT `saveAccountingConfig`: that PUT is a full replace on the server — it assigns
 * file_prefix / file_source / description / branch unconditionally and DELETEs every
 * mapping entry before re-inserting. Sending one corrected rule through it wipes the
 * others, and two people reviewing the same BU's queue at once is the expected case.
 */
export async function patchAccountingMappings(
  mappings: Record<string, { dept: string; acc: string }>
): Promise<void> {
  const res = await apiFetch(API.config.accountingMappings, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mappings }),
  })
  if (!res.ok) {
    // 400 carries the server's own reason (a dept that forbids the account), which the
    // reviewer has to read — it names the pair they just picked.
    const detail = await res
      .json()
      .then(d => (d as { detail?: string }).detail)
      .catch(() => null)
    throw new Error(detail || `Mapping save failed (${res.status})`)
  }
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
