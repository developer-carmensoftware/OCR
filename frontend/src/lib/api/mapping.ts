import { apiFetch } from './client'
import type {
  SuggestRequest,
  SuggestPaymentTypesRequest,
  SaveHistoryRequest,
  FieldMapping,
} from '../../types/api'

export interface SuggestResponse {
  commission?: FieldMapping | null
  tax?: FieldMapping | null
  net?: FieldMapping | null
  suggestions?: Record<string, FieldMapping | null>
}

export interface SuggestPaymentTypesResponse {
  [paymentType: string]: FieldMapping | null
}

export interface HistoryFieldEntry {
  dept: string
  acc: string
  confirmed_count: number
}

export interface MappingHistoryEntry {
  bank_code: string
  history: Record<string, HistoryFieldEntry>
}

export async function suggestMapping(payload: SuggestRequest): Promise<SuggestResponse> {
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
  return res.json() as Promise<SuggestResponse>
}

export async function suggestPaymentTypes(
  payload: SuggestPaymentTypesRequest
): Promise<SuggestPaymentTypesResponse> {
  const res = await apiFetch('/api/v1/mapping/suggest-payment-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Suggest payment types failed (${res.status})`)
  return res.json() as Promise<SuggestPaymentTypesResponse>
}

export async function fetchMappingHistory(bankCode: string): Promise<MappingHistoryEntry | null> {
  const res = await apiFetch(`/api/v1/mapping/history?bank_code=${encodeURIComponent(bankCode)}`)
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`)
  return res.json() as Promise<MappingHistoryEntry | null>
}

export async function saveMappingHistory(payload: SaveHistoryRequest): Promise<void> {
  const res = await apiFetch('/api/v1/mapping/history/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`History save failed (${res.status})`)
}
