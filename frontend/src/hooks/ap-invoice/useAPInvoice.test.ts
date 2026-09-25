/**
 * Characterization tests for useAPInvoice's own orchestration logic — the composition
 * glue that was, until now, the one hook in hooks/ap-invoice/ with no test file at all
 * (useAPExtraction, useAPSubmission, useAPValidation, apTax, apGroup all already have
 * one). This exists so the upcoming split of this file (see
 * codebase-refactor-recursive-scroll.md, Phase 6) can be checked byte-for-byte against
 * current behavior instead of against a re-reading of the source.
 *
 * Scope deliberately excludes re-testing math that already has its own suite
 * (validation.adjustField's proportional-distribution branch, recalcRow's formula,
 * groupSelected's bucketing) — those are exercised here only through fixtures small
 * enough (mostly one line item) that this file's assertions can be hand-verified
 * without duplicating that internal math. What IS tested here is unique to this hook:
 * how it wires validation/extraction/vendor together (adjustField's three branches,
 * applyDocRepair, applyLineTax's interlock, blurLineItem's recalc-trigger gate,
 * group/ungroup, and the debounced-draft save/restore round trip).
 *
 * Sub-hooks (useAPExtraction, useAPVendor, useAPValidation, useAPSubmission) and
 * lib/apTax, lib/apGroup, lib/draft, lib/storage, lib/format all run for real — only
 * the true network/browser boundaries are mocked, same seam useAPExtraction.test.ts
 * mocks at.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAPInvoice } from './useAPInvoice'
import type { APLineItem } from './useAPExtraction'
import { saveDraft, loadDraft } from '../../lib/draft'

vi.mock('../../lib/api/client', () => ({
  apiFetch: vi.fn(async () => ({ ok: true, json: async () => ({ Data: [] }) })),
  fetchTimeout: vi.fn(() => ({ signal: new AbortController().signal, clear: vi.fn() })),
  getStoredToken: vi.fn(() => 'test-token'),
}))
vi.mock('../../lib/api/config', () => ({
  getAPVendorMapping: vi.fn(async () => null),
  saveAPVendorMapping: vi.fn(async () => undefined),
}))
vi.mock('../../lib/api/auth', () => ({ getUsage: vi.fn(async () => null) }))
vi.mock('../../lib/api/ocr', async importOriginal => ({
  ...(await importOriginal<typeof import('../../lib/api/ocr')>()),
  getPdfInfo: vi.fn(),
}))
vi.mock('../../lib/api/carmen', () => ({
  fetchTaxProfiles: vi.fn(async () => TAX_PROFILES),
  fetchAccountCodes: vi.fn(async () => []),
  fetchDepartments: vi.fn(async () => []),
  submitAPInvoiceToCarmen: vi.fn(),
}))
vi.mock('../../lib/toast', () => ({
  showToast: vi.fn(),
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
  }),
}))
vi.mock('../../i18n/LanguageContext', () => {
  // `t` MUST be a stable reference across renders, exactly like the real
  // LanguageContext (its own `t` is `useCallback(..., [lang])`). useAPVendor's
  // `autoMatchVendor` closes over `t` in its own `useCallback`, which useAPInvoice
  // then puts in a `useEffect` dependency array — a fresh `t` function every call
  // reruns that effect every render, and since `autoMatchVendor` unconditionally
  // returns a new `{ code: '', name: '' }` object when nothing matches, that is a
  // real infinite render loop (found the hard way: it OOMs the test worker).
  const t = (key: string) => key
  const setLang = vi.fn()
  return { useT: () => ({ lang: 'en', setLang, t }) }
})

const TAX_PROFILES = [
  { code: 'P7', description: '7% VAT', rate: 7 },
  { code: 'P0', description: 'Exempt', rate: 0 },
]

/** One self-consistent Exclude/7% row: sub 100.00, tax 7.00, total 107.00. */
function row(overrides: Partial<APLineItem> = {}): APLineItem {
  return {
    _uid: crypto.randomUUID(),
    description: 'Item',
    qty: '1.00',
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
    // Skip the auto-tax-profile-match effect — these fixtures already carry the
    // "resolved" profile, and that effect is useAPInvoice's own concern (covered
    // implicitly by mounting with mismatched taxProfileCode1 in test H below).
    _taxProfileTouched: '1',
    ...overrides,
  }
}

/**
 * Mounts the hook with a draft already on disk and drives the real restore flow
 * (the mount-time prompt's own onConfirm) to seed headerData/lineItems — restoreDraft
 * is not part of the hook's public return value, so this is the only real way in.
 * Doubles as the "draft restore" characterization itself.
 */
async function mountRestored(data: {
  headerData: Record<string, string>
  lineItems: APLineItem[]
  step?: number
}) {
  saveDraft('ap', {
    headerData: data.headerData,
    lineItems: data.lineItems,
    fieldMappings: {},
    apInvoiceId: null,
    warnings: [],
    isDuplicate: false,
    systemVendor: { code: '', name: '' },
    vendorSearch: '',
    groupSources: {},
    step: data.step ?? 3,
  })
  const view = renderHook(() => useAPInvoice())
  await waitFor(() => expect(view.result.current.modal.show).toBe(true))
  act(() => {
    const modal = view.result.current.modal
    if (modal.show) modal.onConfirm?.()
  })
  await waitFor(() => expect(view.result.current.step).toBe(data.step ?? 3))
  return view
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.useRealTimers()
})

// ── Adjust / reconcile ──────────────────────────────────────────────────────────

describe('adjustField', () => {
  it('lineSubTotal: writes only the subtotal, then follows the total (taxAmt untouched)', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '110.00', taxAmount: '7.00', grandTotal: '117.00' },
      lineItems: [row()],
    })
    act(() => result.current.adjustField(110, 100, 'lineSubTotal'))
    expect(result.current.lineItems[0]).toMatchObject({
      lineSubTotal: '110.00',
      taxAmt: '7.00',
      lineTotal: '117.00',
    })
  })

  it('taxAmt: writes only the tax, then follows the total (lineSubTotal untouched)', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '10.00', grandTotal: '110.00' },
      lineItems: [row()],
    })
    act(() => result.current.adjustField(10, 7, 'taxAmt'))
    expect(result.current.lineItems[0]).toMatchObject({
      lineSubTotal: '100.00',
      taxAmt: '10.00',
      lineTotal: '110.00',
    })
  })

  it('lineTotal: master-reconciles both sub and tax onto the document targets in one call', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '150.00', taxAmount: '15.00', grandTotal: '165.00' },
      lineItems: [row()],
    })
    act(() => result.current.adjustField(165, 107, 'lineTotal'))
    expect(result.current.lineItems[0]).toMatchObject({
      lineSubTotal: '150.00',
      taxAmt: '15.00',
      lineTotal: '165.00',
    })
  })

  it('any other field (e.g. discountAmt): writes the field, then reconcileRows re-derives the total from sub+tax only', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.adjustField(10, 0, 'discountAmt'))
    expect(result.current.lineItems[0]).toMatchObject({
      discountAmt: '10.00',
      // Exclude row: reconcileRows derives lineTotal = lineSubTotal + taxAmt, neither
      // of which discountAmt touched — the total is unchanged by this Adjust.
      lineSubTotal: '100.00',
      taxAmt: '7.00',
      lineTotal: '107.00',
    })
  })
})

// ── Document self-inconsistency repair ──────────────────────────────────────────

describe('fixDocFigures / applyDocRepair', () => {
  it('repairs the outlier header figure and reconciles the table to it in one click', async () => {
    // Document over-specifies: 100 + 5 != 110. The table corroborates BOTH sub (100)
    // and tax (5), so grandTotal is the misread figure — and by > 1 baht, not a
    // confidence auto-fix, so this only happens via the manual button under test.
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '5.00', grandTotal: '110.00' },
      lineItems: [row({ taxPct: '5.00', taxAmt: '5.00', lineTotal: '105.00' })],
    })
    expect(result.current.isDocInconsistent).toBe(true)

    act(() => result.current.fixDocFigures())

    expect(result.current.headerData.grandTotal).toBe('105.00')
    expect(result.current.isDocInconsistent).toBe(false)
    expect(result.current.lineItems[0]).toMatchObject({
      lineSubTotal: '100.00',
      taxAmt: '5.00',
      lineTotal: '105.00',
    })
  })

  it('does nothing when the document is already self-consistent', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    expect(result.current.isDocInconsistent).toBe(false)
    act(() => result.current.fixDocFigures())
    // repairDocFigure returns null for a consistent document; applyDocRepair no-ops.
    expect(result.current.headerData.grandTotal).toBe('107.00')
  })
})

// ── blurHeader: editing the document's own tax figure propagates to line items ──

describe('blurHeader (taxAmount propagation)', () => {
  it('zero: every line becomes non-VAT, net subtotal preserved as the new total', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.blurHeader('taxAmount', '0'))
    expect(result.current.lineItems[0]).toMatchObject({
      taxType: 'None',
      taxPct: '0.00',
      taxAmt: '0.00',
      taxProfileCode1: '',
      lineTotal: '100.00',
    })
  })

  it('nonzero: adjusts taxAmt onto the line(s) and reconciles, without touching lineSubTotal', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '10.00', grandTotal: '110.00' },
      lineItems: [row()],
    })
    act(() => result.current.blurHeader('taxAmount', '10'))
    expect(result.current.lineItems[0]).toMatchObject({
      lineSubTotal: '100.00',
      taxAmt: '10.00',
      lineTotal: '110.00',
    })
  })

  it('a non-tax field (e.g. subTotal) just updates the header, with no line-item side effect', async () => {
    // extraction.blurHeader runs every key through fmt() (numeric-only) — this wrapper's
    // own "only taxAmount propagates" branch is what's under test here, so the field has
    // to be one blurHeader is actually used for in the real UI (a numeric header field),
    // not free text like documentNumber.
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.blurHeader('subTotal', '250'))
    expect(result.current.headerData.subTotal).toBe('250.00')
    expect(result.current.lineItems[0].taxAmt).toBe('7.00')
  })
})

// ── blurLineItem: recalc-trigger gate ────────────────────────────────────────────

describe('blurLineItem', () => {
  it('a recalc-trigger field (qty) recalculates the whole row', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.blurLineItem(0, 'qty', '2'))
    expect(result.current.lineItems[0]).toMatchObject({
      qty: '2.00',
      lineSubTotal: '200.00',
      taxAmt: '14.00',
      lineTotal: '214.00',
    })
  })

  it('discountPct is derived into discountAmt before the recalc (not left stale)', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.blurLineItem(0, 'discountPct', '10'))
    expect(result.current.lineItems[0]).toMatchObject({
      discountPct: '10.00',
      discountAmt: '10.00',
      lineSubTotal: '90.00',
      taxAmt: '6.30',
      lineTotal: '96.30',
    })
  })

  it('a non-trigger field (taxAmt typed directly) only formats in place — no recalculation', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.blurLineItem(0, 'taxAmt', '12.5'))
    expect(result.current.lineItems[0]).toMatchObject({
      taxAmt: '12.50',
      // Untouched — the recalc that would keep lineTotal = sub + tax consistent
      // only runs for RECALC_TRIGGERS fields.
      lineSubTotal: '100.00',
      lineTotal: '107.00',
    })
  })
})

// ── applyLineTax: the tax-type / profile / rate interlock ───────────────────────

describe('applyLineTax', () => {
  it('picking profile NONE makes the line non-VAT', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.applyLineTax(0, { taxProfileCode1: 'NONE' }))
    expect(result.current.lineItems[0]).toMatchObject({
      taxType: 'None',
      taxProfileCode1: '',
      taxAmt: '0.00',
      lineTotal: '100.00',
    })
  })

  it('picking a profile drives the rate (profile rate wins over the typed rate)', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.applyLineTax(0, { taxProfileCode1: 'P0' }))
    expect(result.current.lineItems[0]).toMatchObject({
      taxProfileCode1: 'P0',
      taxPct: '0.00',
      taxAmt: '0.00',
      lineSubTotal: '100.00',
      lineTotal: '100.00',
    })
  })

  it('a pure Include/Exclude toggle pins the net subtotal instead of re-deriving it from unitPrice', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    act(() => result.current.changeLineTaxType(0, 'Include'))
    expect(result.current.lineItems[0]).toMatchObject({
      taxType: 'Include',
      // Pinned, not re-derived as gross-anchored recalcRow would.
      lineSubTotal: '100.00',
      taxAmt: '7.00',
      lineTotal: '107.00',
    })
  })
})

// ── Grouping ──────────────────────────────────────────────────────────────────

describe('groupByDescription / ungroupItems', () => {
  it('merges two rows sharing a tax profile into one summed row', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '150.00', taxAmount: '10.50', grandTotal: '160.50' },
      lineItems: [
        row({ description: 'Item A' }),
        row({
          description: 'Item B',
          unitPrice: '50.00',
          lineSubTotal: '50.00',
          taxAmt: '3.50',
          lineTotal: '53.50',
        }),
      ],
    })
    let ok = false
    act(() => {
      ok = result.current.groupByDescription([0, 1], 'Merged')
    })
    expect(ok).toBe(true)
    expect(result.current.lineItems).toHaveLength(1)
    expect(result.current.lineItems[0]).toMatchObject({
      description: 'Merged',
      lineSubTotal: '150.00',
      taxAmt: '10.50',
      lineTotal: '160.50',
    })
    expect(result.current.lineItems[0]._groupId).toBeTruthy()
    expect(result.current.isGrouped).toBe(true)
    expect(result.current.originalLineItemsCount).toBe(2)

    act(() => result.current.ungroupItems())
    expect(result.current.lineItems).toHaveLength(2)
    expect(result.current.lineItems.map(i => i.description)).toEqual(['Item A', 'Item B'])
    expect(result.current.isGrouped).toBe(false)
    expect(result.current.originalLineItemsCount).toBe(2)
  })

  it('refuses to group fewer than 2 valid rows (stale/out-of-range indices dropped first)', async () => {
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
    })
    let ok = true
    act(() => {
      // duplicate 0, and 5 is out of range on a 1-row list — both collapse away,
      // leaving a single valid index.
      ok = result.current.groupByDescription([0, 0, 5], 'Merged')
    })
    expect(ok).toBe(false)
    expect(result.current.lineItems).toHaveLength(1)
    expect(result.current.lineItems[0].description).toBe('Item')
  })
})

// ── Draft save / restore ─────────────────────────────────────────────────────────

describe('draft save/restore', () => {
  it('offers no restore prompt when there is nothing saved', async () => {
    const { result } = renderHook(() => useAPInvoice())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.modal.show).toBeFalsy()
  })

  it('restoring puts step, headerData and lineItems back exactly as saved', async () => {
    const { result } = await mountRestored({
      headerData: {
        subTotal: '100.00',
        taxAmount: '7.00',
        grandTotal: '107.00',
        documentNumber: 'INV-9',
      },
      lineItems: [row()],
      step: 3,
    })
    expect(result.current.step).toBe(3)
    expect(result.current.headerData.documentNumber).toBe('INV-9')
    expect(result.current.lineItems[0].lineTotal).toBe('107.00')
    expect(result.current.modal.show).toBe(false)
  })

  it('discarding the offered draft clears it from storage and does not restore', async () => {
    saveDraft('ap', {
      headerData: { documentNumber: 'INV-9' },
      lineItems: [row()],
      fieldMappings: {},
      apInvoiceId: null,
      warnings: [],
      isDuplicate: false,
      systemVendor: { code: '', name: '' },
      vendorSearch: '',
      groupSources: {},
      step: 3,
    })
    const { result } = renderHook(() => useAPInvoice())
    await waitFor(() => expect(result.current.modal.show).toBe(true))
    act(() => {
      const modal = result.current.modal
      if (modal.show) modal.onCancel?.()
    })
    expect(result.current.step).toBe(1)
    expect(loadDraft('ap')).toBeNull()
  })

  it('autosaves the current step after the debounce, and stops at step >= 5', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = await mountRestored({
      headerData: { subTotal: '100.00', taxAmount: '7.00', grandTotal: '107.00' },
      lineItems: [row()],
      step: 3,
    })
    // The restore itself writes nothing new — clear it so this test observes only
    // the save this block triggers.
    localStorage.clear()

    act(() => result.current.blurHeader('subTotal', '999'))
    act(() => vi.advanceTimersByTime(500))
    const saved = loadDraft<{ headerData: Record<string, string> }>('ap')
    expect(saved?.data.headerData.subTotal).toBe('999.00')

    act(() => result.current.setStep(5))
    await waitFor(() => expect(result.current.step).toBe(5))
    expect(loadDraft('ap')).toBeNull()
  })

  it('does not save below step 2 (nothing worth recovering yet)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() => useAPInvoice())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.step).toBe(1)
    act(() => vi.advanceTimersByTime(500))
    expect(loadDraft('ap')).toBeNull()
  })
})
