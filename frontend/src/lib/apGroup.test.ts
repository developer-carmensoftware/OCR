import { describe, it, expect } from 'vitest'
import { effectiveTaxProfile, buildGroupedRow, groupSelected } from './apGroup'
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

  it('stamps _taxProfileTouched on the result', () => {
    const merged = buildGroupedRow([row({})], 'Grouped')
    expect(merged._taxProfileTouched).toBe('1')
  })
})

describe('groupSelected', () => {
  it('same profile → 1 bucket, row uses the supplied description', () => {
    const out = groupSelected(
      [row({ taxProfileCode1: 'VAT07' }), row({ taxProfileCode1: 'VAT07' })],
      'Services'
    )
    expect(out).toHaveLength(1)
    expect(out[0].bucket).toHaveLength(2)
    expect(out[0].row.description).toBe('Services')
  })

  it('different profiles → 2 buckets, both rows share the same description', () => {
    const out = groupSelected(
      [row({ taxProfileCode1: 'VAT07' }), row({ taxProfileCode1: 'VAT10' })],
      'Mixed services'
    )
    expect(out).toHaveLength(2)
    expect(out[0].row.description).toBe('Mixed services')
    expect(out[1].row.description).toBe('Mixed services')
  })

  it('different taxType (Include vs Exclude) same profile → 2 buckets', () => {
    const out = groupSelected(
      [
        row({ taxType: 'Include', taxProfileCode1: 'VAT07' }),
        row({ taxType: 'Exclude', taxProfileCode1: 'VAT07' }),
      ],
      'Combined'
    )
    expect(out).toHaveLength(2)
  })

  it('None + profile → 2 buckets', () => {
    const out = groupSelected(
      [row({ taxType: 'None', taxProfileCode1: '' }), row({ taxProfileCode1: 'VAT07' })],
      'Combined'
    )
    expect(out).toHaveLength(2)
  })

  it('totals are preserved across grouping', () => {
    const out = groupSelected(
      [
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
      ],
      'Services'
    )
    expect(out).toHaveLength(1)
    expect(parseNum(out[0].row.lineTotal)).toBeCloseTo(160.5, 2)
  })

  it('each grouped row has _taxProfileTouched stamped', () => {
    const out = groupSelected(
      [row({ taxProfileCode1: 'VAT07' }), row({ taxProfileCode1: 'VAT10' })],
      'Test'
    )
    expect(out[0].row._taxProfileTouched).toBe('1')
    expect(out[1].row._taxProfileTouched).toBe('1')
  })

  it('preserves first-seen profile order', () => {
    const out = groupSelected(
      [
        row({ taxProfileCode1: 'VAT10' }),
        row({ taxProfileCode1: 'VAT07' }),
        row({ taxProfileCode1: 'VAT10' }),
      ],
      'Test'
    )
    expect(out).toHaveLength(2)
    expect(out[0].bucket[0].taxProfileCode1).toBe('VAT10')
    expect(out[1].bucket[0].taxProfileCode1).toBe('VAT07')
  })
})
