import { describe, it, expect } from 'vitest'
import { effectiveTaxProfile, allSameProfile, buildGroupedRow, groupByTaxProfile } from './apGroup'
import { parseNum } from './format'
import type { APLineItem } from '../hooks/ap-invoice/useAPExtraction'

const row = (over: Partial<APLineItem>): APLineItem => ({
  description: 'Item',
  qty: '1',
  unitPrice: '100.00',
  discountAmt: '0.00',
  taxType: 'Exclude',
  taxPct: '7.00',
  taxProfileCode1: 'VAT07',
  lineSubTotal: '100.00',
  taxAmt: '7.00',
  lineTotal: '107.00',
  ...over,
})

describe('effectiveTaxProfile', () => {
  it('returns None for None lines regardless of profile code', () => {
    expect(effectiveTaxProfile(row({ taxType: 'None', taxProfileCode1: 'VAT07' }))).toBe('None')
  })

  it('uses the line profile code when present', () => {
    expect(effectiveTaxProfile(row({ taxProfileCode1: 'VAT07' }))).toBe('VAT07')
  })

  it('returns empty string when the line has no profile', () => {
    expect(effectiveTaxProfile(row({ taxProfileCode1: '' }))).toBe('')
  })
})

describe('allSameProfile', () => {
  it('true when all share the same effective profile', () => {
    expect(allSameProfile([row({}), row({ taxProfileCode1: 'VAT07' })])).toBe(true)
  })

  it('false when profiles differ', () => {
    expect(
      allSameProfile([row({ taxProfileCode1: 'VAT07' }), row({ taxProfileCode1: 'VAT10' })])
    ).toBe(false)
  })

  it('treats a None line as a distinct profile', () => {
    expect(allSameProfile([row({}), row({ taxType: 'None' })])).toBe(false)
  })

  it('empty list is trivially same', () => {
    expect(allSameProfile([])).toBe(true)
  })
})

describe('buildGroupedRow', () => {
  it('sums totals/tax/discount and uses the first row tax fields', () => {
    const merged = buildGroupedRow(
      [
        row({ lineSubTotal: '100.00', taxAmt: '7.00', lineTotal: '107.00', discountAmt: '0.00' }),
        row({ lineSubTotal: '200.00', taxAmt: '14.00', lineTotal: '214.00', discountAmt: '0.00' }),
      ],
      'Grouped'
    )
    expect(merged.description).toBe('Grouped')
    expect(merged.qty).toBe('1')
    expect(parseNum(merged.lineSubTotal)).toBeCloseTo(300, 2)
    expect(parseNum(merged.taxAmt)).toBeCloseTo(21, 2)
    expect(parseNum(merged.lineTotal)).toBeCloseTo(321, 2)
    expect(merged.taxType).toBe('Exclude')
    expect(merged.taxProfileCode1).toBe('VAT07')
    // Exclude: unitPrice anchors on net subtotal + discount.
    expect(parseNum(merged.unitPrice)).toBeCloseTo(300, 2)
  })

  it('Include rows anchor unitPrice on the gross total', () => {
    const merged = buildGroupedRow(
      [
        row({ taxType: 'Include', lineSubTotal: '100.00', lineTotal: '107.00' }),
        row({ taxType: 'Include', lineSubTotal: '100.00', lineTotal: '107.00' }),
      ],
      'Grouped'
    )
    expect(parseNum(merged.unitPrice)).toBeCloseTo(214, 2)
  })

  it('None rows carry zero tax', () => {
    const merged = buildGroupedRow(
      [row({ taxType: 'None', taxAmt: '0.00', lineTotal: '100.00' })],
      'Grouped'
    )
    expect(parseNum(merged.taxPct)).toBe(0)
  })
})

describe('groupByTaxProfile', () => {
  it('one bucket per distinct profile', () => {
    const out = groupByTaxProfile([
      row({ taxProfileCode1: 'VAT07' }),
      row({ taxProfileCode1: 'VAT07' }),
      row({ taxProfileCode1: 'VAT10' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('splits the same profile across Include vs Exclude', () => {
    const out = groupByTaxProfile([
      row({ taxProfileCode1: 'VAT07', taxType: 'Include' }),
      row({ taxProfileCode1: 'VAT07', taxType: 'Exclude' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('labels None and profile buckets, preserving first-seen order', () => {
    const out = groupByTaxProfile([
      row({ taxProfileCode1: 'VAT07' }),
      row({ taxType: 'None', taxProfileCode1: '' }),
    ])
    expect(out[0].description).toBe('Items (VAT07)')
    expect(out[1].description).toBe('Items (No VAT)')
  })

  it('totals are preserved across grouping', () => {
    const out = groupByTaxProfile([
      row({
        taxProfileCode1: 'VAT07',
        lineSubTotal: '100.00',
        taxAmt: '7.00',
        lineTotal: '107.00',
      }),
      row({
        taxProfileCode1: 'VAT07',
        lineSubTotal: '50.00',
        taxAmt: '3.50',
        lineTotal: '53.50',
      }),
    ])
    expect(out).toHaveLength(1)
    expect(parseNum(out[0].lineTotal)).toBeCloseTo(160.5, 2)
  })
})
