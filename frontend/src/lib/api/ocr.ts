import { apiFetch, fetchTimeout } from './client'
import { API } from './endpoints'

// Backend LLM timeout is 120s × up to 3 attempts. We cap the client at 150s so
// the user gets a clear error instead of waiting indefinitely.
const EXTRACT_TIMEOUT_MS = 150_000

export interface ExtractedRow {
  Transaction: string
  PayAmt: string
  CommisAmt: string
  TaxAmt: string
  WHTAmount: string
  Total: string
}

export interface ExtractResult {
  id: string
  task_id: string
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
  code?: string
}

/** Machine-readable code returned by the backend when an encrypted PDF needs a password. */
export const PDF_PASSWORD_REQUIRED = 'pdf_password_required'

export interface PdfInfoResult {
  page_count: number
  thumbnails: string[]
}

export async function getPdfInfo(file: File, pdfPassword?: string): Promise<PdfInfoResult> {
  const formData = new FormData()
  formData.append('file', file)
  if (pdfPassword) formData.append('pdf_password', pdfPassword)
  const res = await apiFetch(API.files.pdfInfo, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; code?: string }
    const error: ApiError = new Error(err.detail || `PDF info failed (${res.status})`)
    error.status = res.status
    error.code = err.code
    throw error
  }
  return res.json() as Promise<PdfInfoResult>
}

/**
 * Get a browser-renderable preview for an image the browser can't decode itself
 * (HEIC/HEIF). The backend converts HEIC -> JPEG and returns a base64 data URL.
 */
export async function getFilePreview(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiFetch(API.files.preview, { method: 'POST', body: formData })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail || `Preview failed (${res.status})`)
  }
  const data = (await res.json()) as { data_url: string }
  return data.data_url
}

export async function extractFromFile(
  file: File,
  bankType?: string,
  selectedPages?: number[],
  pdfPassword?: string
): Promise<ExtractResult> {
  const formData = new FormData()
  formData.append('files', file)
  if (selectedPages && selectedPages.length > 0) {
    formData.append('selected_pages', JSON.stringify(selectedPages))
  }
  if (pdfPassword) formData.append('pdf_password', pdfPassword)

  const url = bankType ? `${API.creditCard.extract}?bank_code=${bankType}` : API.creditCard.extract
  const { signal, clear } = fetchTimeout(EXTRACT_TIMEOUT_MS)
  let res: Response
  try {
    res = await apiFetch(url, { method: 'POST', body: formData, signal })
  } catch (err) {
    const e = err as Error
    if (e.name === 'AbortError') {
      const timeout: ApiError = new Error('Extraction timed out — please try again')
      timeout.status = 408
      throw timeout
    }
    throw err
  } finally {
    clear()
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; code?: string }
    const error: ApiError = new Error(err.detail || `Upload failed (${res.status})`)
    error.status = res.status
    error.code = err.code
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
    id: (card.id as string) || '',
    task_id: (card.task_id as string) || '',
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
