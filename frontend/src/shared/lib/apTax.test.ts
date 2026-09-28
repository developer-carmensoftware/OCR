import { describe, it, expect } from 'vitest'
import { applyTaxPatch, matchTaxProfiles, recalcRow, syncLineTotals } from './apTax'
import { parseNum } from './format'
import type { APLineItem } from '@/features/ap-invoice/hooks/useAPExtraction'

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

// ── Parity with the backend post-processor ──────────────────────────────────────
//
// recalcRow and the Python _compute_line_totals are independent implementations of the
// same formula. They agree only because _resolve_line_discount normalises discountAmt so
// that `qty * unitPrice - discountAmt` equals the row's pre-tax amount. If that invariant
// is ever broken on the backend, these fail — which is the point: before it existed, a
// per-unit discount column produced backend totals that recalcRow silently disagreed
// with, so the first edit to any field on such a row moved its amount.
describe('parity with backend post-process output', () => {
  // The six rows of invoice 66-0023 exactly as postprocess() emits them.
  const backendRows: APLineItem[] = [
    ['6', '781.00', '0.00', '4686.00', '328.02', '5014.02'],
    ['1', '480.00', '72.00', '408.00', '28.56', '436.56'],
    ['22', '253.00', '834.90', '4731.10', '331.18', '5062.28'],
    ['1', '4190.00', '628.50', '3561.50', '249.31', '3810.81'],
    ['1', '4060.00', '1218.00', '2842.00', '198.94', '3040.94'],
    ['1', '1625.00', '162.50', '1462.50', '102.37', '1564.87'],
  ].map(([qty, unitPrice, discountAmt, lineSubTotal, taxAmt, lineTotal]) => ({
    qty,
    unitPrice,
    discountAmt,
    taxType: 'Exclude' as const,
    taxPct: '7.00',
    lineSubTotal,
    taxAmt,
    lineTotal,
  }))

  it('test_discount_parity: recalcRow reproduces every backend row unchanged', () => {
    backendRows.forEach(item => {
      const r = recalcRow(item)
      expect(parseNum(r.lineSubTotal)).toBeCloseTo(parseNum(item.lineSubTotal), 1)
      expect(parseNum(r.lineTotal)).toBeCloseTo(parseNum(item.lineTotal), 1)
    })
  })

  it('a percent-discount row survives an unrelated edit without moving', () => {
    // Re-running recalcRow is what any Step-3 edit triggers. The amount must not drift.
    const before = backendRows[3]
    const after = recalcRow(recalcRow(before))
    expect(parseNum(after.lineSubTotal)).toBeCloseTo(3561.5, 2)
  })

  it('restates discountPct from the amounts instead of trusting a stale field', () => {
    const r = recalcRow({ ...backendRows[4], discountPct: '99.00' })
    expect(parseNum(r.discountPct)).toBeCloseTo(30, 1)
  })

  it('a negative credit row recalculates from its price', () => {
    // Under the old `unitPrice > 0` guard this row fell into the grouped-row fallback and
    // editing its price did nothing.
    const r = recalcRow(
      row({ unitPrice: '-190.00', taxType: 'None', lineSubTotal: '0.00', lineTotal: '0.00' })
    )
    expect(parseNum(r.lineSubTotal)).toBeCloseTo(-190, 2)
    expect(parseNum(r.lineTotal)).toBeCloseTo(-190, 2)
  })
})

const PROFILES = [
  { code: 'V7', rate: 7 },
  { code: 'V7B', rate: 7 },
  { code: 'V10', rate: 10 },
] as Parameters<typeof matchTaxProfiles>[1]

describe('matchTaxProfiles', () => {
  // The effect that calls this re-runs on every line change; returning a fresh array when
  // nothing moved would set state, re-render and run it again — forever.
  it('returns the same array when every line already holds its profile', () => {
    const prev = [row({ taxProfileCode1: 'V7' }), row({ taxType: 'None', taxProfileCode1: '' })]
    expect(matchTaxProfiles(prev, PROFILES, undefined)).toBe(prev)
  })

  it("prefers the vendor's profile among same-rate ones, and never touches an edited line", () => {
    const prev = [
      row({ taxProfileCode1: 'V7' }),
      row({ taxProfileCode1: 'X', _taxProfileTouched: '1' }),
    ]
    const next = matchTaxProfiles(prev, PROFILES, 'V7B')
    expect(next.map(r => r.taxProfileCode1)).toEqual(['V7B', 'X'])
  })
})

describe('applyTaxPatch', () => {
  it('picking NONE makes the line non-VAT and clears its profile', () => {
    const r = applyTaxPatch(
      row({ taxProfileCode1: 'V7' }),
      { taxProfileCode1: 'NONE' },
      PROFILES,
      'Exclude'
    )
    expect([r.taxType, r.taxProfileCode1, parseNum(r.taxAmt)]).toEqual(['None', '', 0])
  })

  it('a profile drives the rate; a rate with no profile keeps the rate and blanks the profile', () => {
    const v10 = applyTaxPatch(row({}), { taxProfileCode1: 'V10' }, PROFILES, 'Exclude')
    expect(parseNum(v10.taxPct)).toBe(10)
    const r = applyTaxPatch(row({ taxProfileCode1: 'V7' }), { taxPct: '9' }, PROFILES, 'Exclude')
    expect([parseNum(r.taxPct), r.taxProfileCode1]).toEqual([9, ''])
  })
})
