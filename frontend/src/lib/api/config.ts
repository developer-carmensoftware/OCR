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

export interface ConfigPatch {
  mappings?: Record<string, { dept: string; acc: string }>
  file_prefix?: string
  description?: string
  /** Which bank the `description` belongs to — the server prefers a per-bank entry over
   *  the BU-wide one, so it needs to know which one the reviewer was looking at. */
  bank_code?: string
}

/**
 * Correct the named parts of the accounting config, leaving the rest alone.
 *
 * NOT `saveAccountingConfig`: that PUT is a full replace on the server — it assigns
 * file_prefix / file_source / description / branch unconditionally and DELETEs every
 * mapping entry before re-inserting. Sending one correction through it wipes the others,
 * and two people reviewing the same BU's queue at once is the expected case.
 */
export async function patchAccountingConfig(patch: ConfigPatch): Promise<void> {
  const res = await apiFetch(API.config.accounting, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    // 400 carries the server's own reason (a dept that forbids the account), which the
    // reviewer has to read — it names the pair they just picked.
    const detail = await res
      .json()
      .then(d => (d as { detail?: string }).detail)
      .catch(() => null)
    throw new Error(detail || `Config save failed (${res.status})`)
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
