/**
 * OCR API — extract receipt data from uploaded files.
 */

import { apiFetch } from './client'

export async function extractFromFile(file, bankType) {
  const formData = new FormData()
  formData.append('files', file)

  const url = bankType ? `/api/v1/ocr/extract?bank_type=${bankType}` : '/api/v1/ocr/extract'

  const res = await apiFetch(url, { method: 'POST', body: formData })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const error = new Error(err.detail || `Upload failed (${res.status})`)
    error.status = res.status
    throw error
  }

  const results = await res.json()
  const card = results[0] || {}

  const details = (card.details || []).map(d => ({
    Transaction: d.transaction || '',
    PayAmt: d.pay_amt || '',
    CommisAmt: d.commis_amt || '',
    TaxAmt: d.tax_amt || '',
    WHTAmount: '',
    Total: d.total || '',
  }))

  return {
    bank_name: card.bank_name || '',
    bank_type: bankType || '',
    doc_name: card.doc_name || '',
    company_name: card.company_name || '',
    doc_date: card.doc_date || '',
    doc_no: card.doc_no || '',
    merchant_name: card.merchant_name || '',
    merchant_id: card.merchant_id || '',
    bank_companyname: card.bank_companyname || '',
    branch_no: card.branch_no || '',
    is_duplicate: card.is_duplicate || false,
    details,
  }
}

export async function markSubmitted(cardId) {
  const res = await apiFetch(`/api/v1/ocr/credit-cards/${cardId}/submit`, { method: 'PATCH' })
  if (!res.ok) {
    console.warn(`markSubmitted failed for ${cardId}: ${res.status}`)
  }
}
