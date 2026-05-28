import { describe, it, expect } from 'vitest'
import { useAPValidation } from '../hooks/ap-invoice/useAPValidation'

// useAPValidation is a pure computation hook — no mocks needed.

function makeItem(overrides = {}) {
  return {
    description: 'Item',
    qty: '1',
    unitPrice: '100.00',
    discountAmt: '0.00',
    lineSubTotal: '100.00',
    taxPct: '7',
    taxAmt: '7.00',
    lineTotal: '107.00',
    taxType: 'Exclude',
    deptCode: '',
    accountCode: '',
    ...overrides,
  }
}

const EMPTY_HEADER = {
  subTotal: '0',
  totalDiscount: '0',
  taxAmount: '0',
  grandTotal: '0',
  taxType: 'Add',
}

function runAdjust(items, tgt, sumCur, key = 'taxAmt') {
  const { adjustField } = useAPValidation({
    headerData: EMPTY_HEADER,
    lineItems: items,
    fieldMappings: {},
  })
  return adjustField(tgt, sumCur, key, items)
}

// ─── adjustField ──────────────────────────────────────────────────────────────

describe('adjustField', () => {
  describe('proportional distribution', () => {
    it('distributes large taxAmt diff proportionally across taxable items', () => {
      const items = [
        makeItem({ lineSubTotal: '200.00', taxAmt: '14.00', lineTotal: '214.00' }),
        makeItem({ lineSubTotal: '800.00', taxAmt: '56.00', lineTotal: '856.00' }),
      ]
      // current sum = 70, target = 80 → diff = 10
      const updated = runAdjust(items, 80, 70)
      const newTax = updated.map(i => parseFloat(i.taxAmt))
      // proportional: item0 gets 2, item1 gets 8
      expect(newTax[0]).toBeCloseTo(16, 1)
      expect(newTax[1]).toBeCloseTo(64, 1)
      expect(newTax[0] + newTax[1]).toBeCloseTo(80, 2)
    })

    it('last item absorbs rounding penny so total is exact', () => {
      const items = [
        makeItem({ lineSubTotal: '333.33', taxAmt: '23.33', lineTotal: '356.66' }),
        makeItem({ lineSubTotal: '333.33', taxAmt: '23.33', lineTotal: '356.66' }),
        makeItem({ lineSubTotal: '333.34', taxAmt: '23.34', lineTotal: '356.68' }),
      ]
      // current sum = 70.00, target = 80.00 → diff = 10
      const updated = runAdjust(items, 80, 70)
      const totalTax = updated.reduce((s, i) => s + parseFloat(i.taxAmt), 0)
      expect(Math.round(totalTax * 100)).toBe(8000) // exactly 80.00
    })
  })

  // P3 bug fix: equal split when totalSub === 0
  describe('P3: zero-subtotal equal split (bug fix)', () => {
    it('distributes diff equally when all taxable lineSubTotals are 0', () => {
      const items = [
        makeItem({ lineSubTotal: '0.00', taxAmt: '0.00', lineTotal: '7.00', taxPct: '7' }),
        makeItem({ lineSubTotal: '0.00', taxAmt: '0.00', lineTotal: '7.00', taxPct: '7' }),
      ]
      // diff = 10 → each item should get 5
      const updated = runAdjust(items, 10, 0)
      const taxes = updated.map(i => parseFloat(i.taxAmt))
      // Must not dump all onto last item — both should get some
      expect(taxes[0]).toBeGreaterThan(0)
      expect(taxes[1]).toBeGreaterThan(0)
      expect(Math.round((taxes[0] + taxes[1]) * 100)).toBe(1000) // sums to 10.00
    })

    it('does not put full diff on last item when totalSub=0 (regression guard)', () => {
      const items = [
        makeItem({ lineSubTotal: '0.00', taxAmt: '0.00', taxPct: '7' }),
        makeItem({ lineSubTotal: '0.00', taxAmt: '0.00', taxPct: '7' }),
        makeItem({ lineSubTotal: '0.00', taxAmt: '0.00', taxPct: '7' }),
      ]
      const updated = runAdjust(items, 30, 0)
      const taxes = updated.map(i => parseFloat(i.taxAmt))
      // All three should receive equal share (10 each), last must not get all 30
      expect(taxes[2]).toBeLessThan(30)
    })
  })

  describe('small diff (≤1 THB) lands on last taxable item', () => {
    it('places small diff on last taxable item', () => {
      const items = [
        makeItem({ lineSubTotal: '500.00', taxAmt: '35.00' }),
        makeItem({ lineSubTotal: '500.00', taxAmt: '35.00' }),
      ]
      // diff = 0.50 → small, goes to last
      const updated = runAdjust(items, 70.5, 70)
      expect(parseFloat(updated[0].taxAmt)).toBeCloseTo(35.0)
      expect(parseFloat(updated[1].taxAmt)).toBeCloseTo(35.5)
    })
  })

  describe('no-op when diff is zero', () => {
    it('returns items unchanged when tgt === sumCur', () => {
      const items = [makeItem()]
      const updated = runAdjust(items, 7, 7)
      expect(updated).toBe(items) // same reference
    })
  })
})

// ─── validation sums ──────────────────────────────────────────────────────────

describe('useAPValidation sums', () => {
  it('computes sumLineSubTotal, sumTax, sumLineTotal correctly', () => {
    const items = [
      makeItem({ lineSubTotal: '100.00', taxAmt: '7.00', lineTotal: '107.00' }),
      makeItem({ lineSubTotal: '200.00', taxAmt: '14.00', lineTotal: '214.00' }),
    ]
    const { sumLineSubTotal, sumTax, sumLineTotal } = useAPValidation({
      headerData: EMPTY_HEADER,
      lineItems: items,
      fieldMappings: {},
    })
    expect(sumLineSubTotal).toBe(300)
    expect(sumTax).toBe(21)
    expect(sumLineTotal).toBe(321)
  })

  it('isValid=true when all line sums match header targets', () => {
    const items = [makeItem()]
    const header = {
      subTotal: '100',
      totalDiscount: '0',
      taxAmount: '7',
      grandTotal: '107',
      taxType: 'Add',
    }
    const { isValid } = useAPValidation({ headerData: header, lineItems: items, fieldMappings: {} })
    expect(isValid).toBe(true)
  })

  it('isGrandDiff=true when sumLineTotal does not match header grandTotal', () => {
    const items = [makeItem()]
    const header = { ...EMPTY_HEADER, grandTotal: '999' }
    const { isGrandDiff } = useAPValidation({
      headerData: header,
      lineItems: items,
      fieldMappings: {},
    })
    expect(isGrandDiff).toBe(true)
  })
})
