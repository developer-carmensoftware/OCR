/**
 * Submit API — save confirmed receipt data to the local database.
 */

import { apiFetch } from './client'

export async function submitToLocal(payload) {
  const res = await apiFetch('/api/v1/ocr/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errTxt = await res.text()
    let detail = errTxt
    try {
      const parsed = JSON.parse(errTxt)
      if (Array.isArray(parsed.detail)) {
        detail = parsed.detail
          .map(d => (typeof d === 'object' ? d.msg || JSON.stringify(d) : d))
          .join(', ')
      } else {
        detail = parsed.detail || errTxt
      }
    } catch {
      /* ignore */
    }

    const error = new Error(`Failed to save data (${res.status})\n${detail}`)
    error.status = res.status
    error.detail = detail
    throw error
  }

  const data = await res.json()

  if (data.ok === false) {
    const error = new Error(data.detail || 'An error occurred while saving data')
    error.status = 200
    error.detail = data.detail
    throw error
  }

  return data
}
