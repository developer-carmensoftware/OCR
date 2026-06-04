import { describe, it, expect } from 'vitest'
import { recalcRow, syncLineTotals } from './apTax'
import { parseNum } from './format'
import type { APLineItem } from '../hooks/ap-invoice/useAPExtraction'

const row = (over: Partial<APLineItem>): APLineItem => ({
  qty: '1',
  unitPrice: '100.00',
  discountAmt: '0.00',
  taxType: 'Exclude',
  taxPct: '7.00',
  lineSubTotal: '100.00',
  taxAmt: '7.00',
  lineTotal: '107.00',
  ...over,
})

describe('recalcRow', () => {
  it('Exclude: tax on top of the net subtotal', () => {
    const r = recalcRow(row({}))
    expect(parseNum(r.lineSubTotal)).toBeCloseTo(100, 2)
    expect(parseNum(r.taxAmt)).toBeCloseTo(7, 2)
    expect(parseNum(r.lineTotal)).toBeCloseTo(107, 2)
  })

  it('Include: gross is fixed, subtotal is backed out', () => {
    const r = recalcRow(row({ unitPrice: '107.00', taxType: 'Include' }))
    expect(parseNum(r.lineSubTotal)).toBeCloseTo(100, 2)
    expect(parseNum(r.taxAmt)).toBeCloseTo(7, 2)
    expect(parseNum(r.lineTotal)).toBeCloseTo(107, 2)
  })

  it('None: no tax, total equals subtotal', () => {
    const r = recalcRow(row({ taxType: 'None' }))
    expect(parseNum(r.taxAmt)).toBe(0)
    expect(parseNum(r.lineTotal)).toBeCloseTo(100, 2)
  })

  it('grouped row (no unitPrice) anchors on lineSubTotal + discountAmt', () => {
    const r = recalcRow(row({ unitPrice: '0', lineSubTotal: '200.00' }))
    expect(parseNum(r.lineSubTotal)).toBeCloseTo(200, 2)
    expect(parseNum(r.taxAmt)).toBeCloseTo(14, 2)
    expect(parseNum(r.lineTotal)).toBeCloseTo(214, 2)
  })
})

describe('syncLineTotals — pin-based Adjust keeps lineTotal = sub + tax', () => {
  it('Exclude: total follows sub + tax', () => {
    const [r] = syncLineTotals([row({ lineSubTotal: '110.00', taxAmt: '7.70', lineTotal: '0.00' })])
    expect(parseNum(r.lineTotal)).toBeCloseTo(117.7, 2)
  })

  it('Include: recomputed uniformly from sub + tax (stale gross is overwritten)', () => {
    const [r] = syncLineTotals([
      row({ taxType: 'Include', lineSubTotal: '100.00', taxAmt: '7.00', lineTotal: '999.99' }),
    ])
    expect(parseNum(r.lineTotal)).toBeCloseTo(107, 2)
  })

  it('None: total equals subtotal', () => {
    const [r] = syncLineTotals([
      row({ taxType: 'None', lineSubTotal: '50.00', taxAmt: '0.00', lineTotal: '0.00' }),
    ])
    expect(parseNum(r.lineTotal)).toBeCloseTo(50, 2)
  })

  it('keeps every row consistent across a list', () => {
    const out = syncLineTotals([
      row({ lineSubTotal: '300.01', taxAmt: '21.00' }),
      row({ taxType: 'None', lineSubTotal: '40.00', taxAmt: '0.00' }),
    ])
    out.forEach(r =>
      expect(parseNum(r.lineSubTotal) + parseNum(r.taxAmt)).toBeCloseTo(parseNum(r.lineTotal), 2)
    )
  })
})
