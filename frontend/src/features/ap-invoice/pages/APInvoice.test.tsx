/**
 * The AP wizard page after a draft restore.
 *
 * useAPInvoice.test.ts proves the hook restores its state; this proves the page then shows
 * it. A restored draft never carries the uploaded file (nothing is stored), and the page
 * used to render steps 2-3 only when a file preview existed — so Restore landed on a blank
 * screen while the hook held a complete invoice. Only a render of the page can see that.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import APInvoice from './APInvoice'
import { saveDraft } from '@/shared/lib/draft'

vi.mock('@/shared/api/client', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, json: async () => ({ Data: [] }) })),
  fetchTimeout: vi.fn(() => ({ signal: new AbortController().signal, clear: vi.fn() })),
  getStoredToken: vi.fn(() => 'test-token'),
}))
vi.mock('@/shared/api/config', () => ({
  getAPVendorMapping: vi.fn(async () => null),
  saveAPVendorMapping: vi.fn(async () => undefined),
}))
vi.mock('@/shared/api/auth', () => ({ getUsage: vi.fn(async () => null) }))
vi.mock('@/shared/api/carmen', () => ({
  fetchTaxProfiles: vi.fn(async () => [{ code: 'P7', description: '7% VAT', rate: 7 }]),
  fetchAccountCodes: vi.fn(async () => []),
  fetchDepartments: vi.fn(async () => []),
  submitAPInvoiceToCarmen: vi.fn(),
}))
vi.mock('@/shared/lib/toast', () => ({
  showToast: vi.fn(),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }),
}))
// Page chrome, as in ReviewQueue.test.tsx — not what this test is about.
vi.mock('@/shared/components/common/UsageIndicator', () => ({ default: () => null }))
vi.mock('@/shared/components/common/AppHeader', () => ({ default: () => null }))
vi.mock('@/i18n/LanguageContext', () => {
  // Stable `t`, as in useAPInvoice.test.ts — a fresh function per render loops forever.
  const t = (key: string) => key
  const setLang = vi.fn()
  return { useT: () => ({ lang: 'en', setLang, t }) }
})

const line = (uid: string, description: string) => ({
  _uid: uid,
  description,
  qty: '1',
  unitPrice: '100.00',
  discountPct: '0.00',
  discountAmt: '0.00',
  lineSubTotal: '100.00',
  taxPct: '7.00',
  taxType: 'Exclude',
  taxAmt: '7.00',
  lineTotal: '107.00',
  taxProfileCode1: 'P7',
  deptCode: '',
  accountCode: '',
  _taxProfileTouched: '1',
})

describe('APInvoice page — restoring a draft', () => {
  beforeEach(() => localStorage.clear())

  it('shows the review step, although a restored draft has no file to preview', async () => {
    saveDraft('ap', {
      step: 3,
      headerData: { subTotal: '200.00', taxAmount: '14.00', grandTotal: '214.00' },
      lineItems: [line('a', 'Consulting fee'), line('b', 'Travel')],
      // What a real draft carries: the mapping confirmed at step 2 drives the review columns.
      fieldMappings: { col0: 'description', col1: 'qty', col2: 'unitPrice', col3: 'lineTotal' },
      apInvoiceId: null,
      warnings: [],
      isDuplicate: false,
      systemVendor: { code: '', name: '' },
      vendorSearch: '',
      groupSources: {},
    })
    render(<APInvoice />)

    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }))

    expect(await screen.findByDisplayValue('Consulting fee')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Travel')).toBeInTheDocument()
  })
})
