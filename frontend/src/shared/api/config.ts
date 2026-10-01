import { apiFetch } from './client'
import { API } from './endpoints'
import type { AccountingConfigRequest, AccountingConfigResponse } from '@/shared/types/api'

/** Wire shape: the PUT body is a flat {column: field} map; the GET wraps it. */
export type APVendorMapping = Record<string, string>

export interface APVendorMappingResponse {
  vendor_tax_id: string
  mapping: APVendorMapping
}

/**
 * @param bankCode Which bank's GL mappings to read — a BU handling more than one bank has a
 * separate set per bank. Omit for the tenant's own (single-bank) default.
 */
export async function getAccountingConfig(
  bankCode?: string | null
): Promise<AccountingConfigResponse> {
  const url = bankCode
    ? `${API.config.accounting}?bank_code=${encodeURIComponent(bankCode)}`
    : API.config.accounting
  const res = await apiFetch(url)
  if (!res.ok) throw new Error(`Config fetch failed (${res.status})`)
  return res.json() as Promise<AccountingConfigResponse>
}

/** What a save answers: the bank's new `version`, so a page that stays open can save again. */
export interface SaveAccountingConfigResult {
  ok: boolean
  version?: string | null
}

export async function saveAccountingConfig(
  payload: AccountingConfigRequest
): Promise<SaveAccountingConfigResult> {
  const res = await apiFetch(API.config.accounting, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    // The server's own reason when it sends one as text — the mapping page shows it, and a
    // status code names nothing the reader can fix. (A 422's `detail` is a list: status.)
    const detail = await res
      .json()
      .then(d => (d as { detail?: unknown }).detail)
      .catch(() => null)
    // `status` rides along: a 409 is "someone saved first", which the page answers with a
    // choice rather than an error.
    throw Object.assign(
      new Error(typeof detail === 'string' ? detail : `Config save failed (${res.status})`),
      { status: res.status }
    )
  }
  return res.json() as Promise<SaveAccountingConfigResult>
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
