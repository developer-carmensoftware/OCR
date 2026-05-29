import { apiFetch } from './client'

export interface ExtractedRow {
  Transaction: string
  PayAmt: string
  CommisAmt: string
  TaxAmt: string
  WHTAmount: string
  Total: string
}

export interface ExtractResult {
  bank_name: string
  bank_type: string
  doc_name: string
  company_name: string
  doc_date: string
  doc_no: string
  merchant_name: string
  merchant_id: string
  bank_company_name: string
  branch_no: string
  is_duplicate: boolean
  details: ExtractedRow[]
}

export interface ApiError extends Error {
  status?: number
}

export async function extractFromFile(file: File, bankType?: string): Promise<ExtractResult> {
  const formData = new FormData()
  formData.append('files', file)

  const url = bankType ? `/api/v1/ocr/extract?bank_type=${bankType}` : '/api/v1/ocr/extract'

  const res = await apiFetch(url, { method: 'POST', body: formData })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    const error: ApiError = new Error(err.detail || `Upload failed (${res.status})`)
    error.status = res.status
    throw error
  }

  const results = (await res.json()) as Array<Record<string, unknown>>
  const card = results[0] || {}
  const rawDetails = (card.details as Array<Record<string, string>> | undefined) || []

  const details: ExtractedRow[] = rawDetails.map(d => ({
    Transaction: d.transaction || '',
    PayAmt: d.pay_amt || '',
    CommisAmt: d.commis_amt || '',
    TaxAmt: d.tax_amt || '',
    WHTAmount: '',
    Total: d.total || '',
  }))

  return {
    bank_name: (card.bank_name as string) || '',
    bank_type: bankType || '',
    doc_name: (card.doc_name as string) || '',
    company_name: (card.company_name as string) || '',
    doc_date: (card.doc_date as string) || '',
    doc_no: (card.doc_no as string) || '',
    merchant_name: (card.merchant_name as string) || '',
    merchant_id: (card.merchant_id as string) || '',
    bank_company_name: (card.bank_company_name as string) || '',
    branch_no: (card.branch_no as string) || '',
    is_duplicate: (card.is_duplicate as boolean) || false,
    details,
  }
}

export async function markSubmitted(cardId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/ocr/credit-cards/${cardId}/submit`, { method: 'PATCH' })
  if (!res.ok) {
    console.warn(`markSubmitted failed for ${cardId}: ${res.status}`)
  }
}
