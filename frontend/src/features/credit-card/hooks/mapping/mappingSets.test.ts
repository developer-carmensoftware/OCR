import { describe, it, expect, vi } from 'vitest'
import { buildMappingSets, type FeeInvoiceSource } from './mappingSets'
import type { SettlementMappingHook } from './useSettlementMapping'

/**
 * Which lists a bank gets, and that one code is only ever in one of them. The duplicate
 * this guards against was real: settlement keys also landed in the fee-invoice list, so
 * the old modal showed them twice and counted them in the wrong total.
 */

function fee(over: Partial<FeeInvoiceSource> = {}): FeeInvoiceSource {
  return {
    activeScan: { paymentTypes: new Set(['Visa']), commission: true, tax: true, net: true },
    paymentAmount: { Visa: { dept: 'GEN', acc: '1130V' } },
    customPaymentTypes: ['MYCUSTOM'],
    paymentSuggestions: {},
    paymentSuggestLoading: false,
    handlePaymentMappingChange: vi.fn(),
    applyPaymentMappings: vi.fn(),
    addPaymentType: vi.fn().mockReturnValue(null),
    handleRemoveCustomType: vi.fn(),
    autoSuggestPaymentTypes: vi.fn().mockResolvedValue(undefined),
    confirmPaymentSuggestion: vi.fn(),
    rejectPaymentSuggestion: vi.fn(),
    openAmountModal: vi.fn(),
    cancelAmountSelection: vi.fn(),
    saveAmountSelection: vi.fn(),
    ...over,
  }
}

function settlement(over: Partial<SettlementMappingHook> = {}): SettlementMappingHook {
  return {
    postType: 'Summary',
    rows: [{ code: 'VS', mapping: { dept: '', acc: '', source: 'settlement_summary' } }],
    // Both post types, as the page's save sends them.
    mappingsToSave: {
      VS: { dept: '', acc: '', source: 'settlement_summary' },
      'VS INTER PREM': { dept: 'GEN', acc: '1021004', source: 'settlement_detail' },
    },
    suggestions: {},
    suggestLoading: false,
    setRowMapping: vi.fn(),
    applyToMany: vi.fn(),
    addCustomType: vi.fn().mockReturnValue(null),
    removeType: vi.fn(),
    runSuggest: vi.fn().mockResolvedValue(undefined),
    acceptSuggestion: vi.fn(),
    acceptAllSuggestions: vi.fn(),
    rejectSuggestion: vi.fn(),
    snapshot: vi.fn(),
    restore: vi.fn(),
    dropSnapshot: vi.fn(),
    ...over,
  } as unknown as SettlementMappingHook
}

const labels = { feeInvoice: 'Fee invoice', settlement: 'Settlement report · Summary' }

describe('buildMappingSets', () => {
  it('gives a bank with no settlement layout its fee-invoice list, even an empty one', () => {
    const { sets } = buildMappingSets({
      fee: fee({
        activeScan: { paymentTypes: new Set(), commission: false, tax: false, net: false },
        customPaymentTypes: [],
      }),
      settlement: null,
      labels,
    })
    expect(sets.map(s => s.id)).toEqual(['fee_invoice'])
    expect(sets[0].items).toEqual([])
  })

  it('lists the settlement set first, and the fee-invoice list only when it has types', () => {
    const withFee = buildMappingSets({ fee: fee(), settlement: settlement(), labels })
    expect(withFee.sets.map(s => s.id)).toEqual(['settlement_summary', 'fee_invoice'])

    const without = buildMappingSets({
      fee: fee({
        activeScan: { paymentTypes: new Set(), commission: false, tax: false, net: false },
        customPaymentTypes: [],
      }),
      settlement: settlement(),
      labels,
    })
    expect(without.sets.map(s => s.id)).toEqual(['settlement_summary'])
  })

  it('never lists a settlement code under the fee invoice, whichever post type it is', () => {
    const { sets } = buildMappingSets({
      // A legacy untagged key that is also a settlement code, and the Detail code the
      // Summary view is not showing.
      fee: fee({ customPaymentTypes: ['MYCUSTOM', 'VS', 'VS INTER PREM'] }),
      settlement: settlement(),
      labels,
    })
    const feeSet = sets.find(s => s.id === 'fee_invoice')
    expect(feeSet?.items.map(i => i.code)).toEqual(['Visa', 'MYCUSTOM'])
  })

  it('marks what is on the scan, and lets only a typed-in type be removed', () => {
    const { sets } = buildMappingSets({ fee: fee(), settlement: null, labels })
    expect(sets[0].items).toEqual([
      expect.objectContaining({ code: 'Visa', onDocument: true, removable: false }),
      expect.objectContaining({ code: 'MYCUSTOM', onDocument: false, removable: true }),
    ])
  })

  it('refuses an added code that another list already has', () => {
    const f = fee()
    const s = settlement()
    const { sets } = buildMappingSets({ fee: f, settlement: s, labels })

    sets.find(x => x.id === 'fee_invoice')?.add?.('JCB')
    expect(f.addPaymentType).toHaveBeenCalledWith('JCB', new Set(['VS', 'VS INTER PREM']))

    sets.find(x => x.id === 'settlement_summary')?.add?.('AMEX')
    expect(s.addCustomType).toHaveBeenCalledWith('AMEX', new Set(['Visa', 'MYCUSTOM']))
  })

  it('asks the AI about the fee-invoice list only, never the settlement keys', () => {
    const f = fee({ customPaymentTypes: ['MYCUSTOM', 'VS'] })
    const { sets } = buildMappingSets({ fee: f, settlement: settlement(), labels })
    sets.find(x => x.id === 'fee_invoice')?.suggest()
    expect(f.autoSuggestPaymentTypes).toHaveBeenCalledWith(['Visa', 'MYCUSTOM'])
  })

  it('opens, cancels and finishes a draft of every list at once', () => {
    const f = fee()
    const s = settlement()
    const m = buildMappingSets({ fee: f, settlement: s, labels })

    m.open()
    expect(f.openAmountModal).toHaveBeenCalled()
    expect(s.snapshot).toHaveBeenCalled()

    m.cancel()
    expect(f.cancelAmountSelection).toHaveBeenCalled()
    // The old modal reverted only the fee-invoice edits; settlement edits survived Cancel.
    expect(s.restore).toHaveBeenCalled()

    m.done()
    expect(f.saveAmountSelection).toHaveBeenCalled()
    expect(s.dropSnapshot).toHaveBeenCalled()
  })
})
