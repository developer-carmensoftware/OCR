import { apiFetch } from './client'

export interface SubmitPayload {
  bank_code: string
  file_prefix: string
  file_source: string
  company: {
    name: string
    taxId: string
    branch: string
    address: string
  }
  header: Record<string, string>
  details: Record<string, string>[]
  mappings: Record<string, { dept: string; acc: string }>
}

export interface SubmitResult {
  ok: boolean
  detail?: string
  [key: string]: unknown
}

export interface SubmitApiError extends Error {
  status?: number
  detail?: string
}

export async function submitToLocal(payload: SubmitPayload): Promise<SubmitResult> {
  const res = await apiFetch('/api/v1/ocr/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errTxt = await res.text()
    let detail = errTxt
    try {
      const parsed = JSON.parse(errTxt) as { detail?: unknown }
      if (Array.isArray(parsed.detail)) {
        detail = (parsed.detail as Array<string | Record<string, string>>)
          .map(d => (typeof d === 'object' ? d.msg || JSON.stringify(d) : d))
          .join(', ')
      } else {
        detail = (parsed.detail as string) || errTxt
      }
    } catch {
      /* ignore */
    }

    const error: SubmitApiError = new Error(`Failed to save data (${res.status})\n${detail}`)
    error.status = res.status
    error.detail = detail
    throw error
  }

  const data = (await res.json()) as SubmitResult

  if (data.ok === false) {
    const error: SubmitApiError = new Error(data.detail || 'An error occurred while saving data')
    error.status = 200
    error.detail = data.detail
    throw error
  }

  return data
}
