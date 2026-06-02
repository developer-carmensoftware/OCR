import { describe, it, expect } from 'vitest'
import { recalcRow, nudgeAnchorForTarget } from './apTax'
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

describe('nudgeAnchorForTarget — Adjust button math', () => {
  it('Exclude grand: moves the line total by diff and stays consistent', () => {
    const r = nudgeAnchorForTarget(row({}), 'grand', 10)
    expect(parseNum(r.lineTotal)).toBeCloseTo(117, 2)
    expect(parseNum(r.lineSubTotal) + parseNum(r.taxAmt)).toBeCloseTo(parseNum(r.lineTotal), 2)
  })

  it('Exclude sub: moves the subtotal by diff and re-derives tax', () => {
    const r = nudgeAnchorForTarget(row({}), 'sub', 10)
    expect(parseNum(r.lineSubTotal)).toBeCloseTo(110, 2)
    expect(parseNum(r.taxAmt)).toBeCloseTo(7.7, 2)
  })

  it('Include grand: moves the gross total by diff', () => {
    const r = nudgeAnchorForTarget(row({ unitPrice: '107.00', taxType: 'Include' }), 'grand', 10)
    expect(parseNum(r.lineTotal)).toBeCloseTo(117, 2)
  })

  it('Include sub: moves the subtotal by diff', () => {
    const r = nudgeAnchorForTarget(row({ unitPrice: '107.00', taxType: 'Include' }), 'sub', 10)
    expect(parseNum(r.lineSubTotal)).toBeCloseTo(110, 2)
  })

  it('None: sub and grand both move by diff', () => {
    const r = nudgeAnchorForTarget(row({ unitPrice: '50.00', taxType: 'None' }), 'sub', 10)
    expect(parseNum(r.lineSubTotal)).toBeCloseTo(60, 2)
    expect(parseNum(r.lineTotal)).toBeCloseTo(60, 2)
  })

  it('grouped Exclude row (no unitPrice): grand adjust still moves the total', () => {
    const r = nudgeAnchorForTarget(
      row({ unitPrice: '0', lineSubTotal: '200.00', taxAmt: '14.00', lineTotal: '214.00' }),
      'grand',
      10
    )
    expect(parseNum(r.lineTotal)).toBeCloseTo(224, 2)
    expect(parseNum(r.lineSubTotal) + parseNum(r.taxAmt)).toBeCloseTo(parseNum(r.lineTotal), 2)
  })
})
