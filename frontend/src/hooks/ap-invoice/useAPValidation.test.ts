import { describe, it, expect } from 'vitest'
import { reconcileRows, repairDocFigure, useAPValidation } from './useAPValidation'
import { syncLineTotals } from '../../lib/apTax'
import type { APLineItem } from './useAPExtraction'
import type { APInvoiceHeader } from '../../constants/apInvoice'

// reconcileRows is the shared per-row reconcile used by the Adjust buttons and the
// header-tax blur. After a single field is written, it re-derives the dependent field
// by taxType so each row keeps `lineSubTotal + taxAmt == lineTotal`.

describe('reconcileRows', () => {
  it('Exclude: derives lineTotal from lineSubTotal + taxAmt', () => {
    const [row] = reconcileRows([
      { taxType: 'Exclude', lineSubTotal: '100.00', taxAmt: '7.00', lineTotal: '999.99' },
    ])
    expect(row.lineTotal).toBe('107.00')
    expect(row.lineSubTotal).toBe('100.00') // untouched
  })

  it('None: lineTotal collapses to lineSubTotal (taxAmt 0)', () => {
    const [row] = reconcileRows([
      { taxType: 'None', lineSubTotal: '50.00', taxAmt: '0.00', lineTotal: '57.00' },
    ])
    expect(row.lineTotal).toBe('50.00')
  })

  it('Include: derives lineSubTotal from lineTotal − taxAmt (gross stays fixed)', () => {
    const [row] = reconcileRows([
      { taxType: 'Include', lineSubTotal: '999.99', taxAmt: '7.00', lineTotal: '107.00' },
    ])
    expect(row.lineSubTotal).toBe('100.00')
    expect(row.lineTotal).toBe('107.00') // untouched
  })

  it('no taxType defaults to the Exclude branch', () => {
    const [row] = reconcileRows([{ lineSubTotal: '200.00', taxAmt: '14.00', lineTotal: '0.00' }])
    expect(row.lineTotal).toBe('214.00')
  })

  it('simulates a Tax-adjust click: bumping taxAmt then reconciling keeps the row balanced', () => {
    // adjustField has written the new taxAmt (7 → 14) onto the row; reconcile must move
    // lineTotal with it so the grand-total summary does not desync ("whack-a-mole").
    const adjusted: APLineItem[] = [
      { taxType: 'Exclude', lineSubTotal: '100.00', taxAmt: '14.00', lineTotal: '107.00' },
    ]
    const [row] = reconcileRows(adjusted)
    expect(row.lineTotal).toBe('114.00')
    expect(Number(row.lineSubTotal) + Number(row.taxAmt)).toBe(Number(row.lineTotal))
  })

  it('preserves array length and other fields', () => {
    const rows = reconcileRows([
      {
        taxType: 'Exclude',
        description: 'A',
        lineSubTotal: '10.00',
        taxAmt: '0.70',
        lineTotal: '0',
      },
      {
        taxType: 'Include',
        description: 'B',
        lineSubTotal: '0',
        taxAmt: '0.70',
        lineTotal: '10.70',
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].description).toBe('A')
    expect(rows[1].description).toBe('B')
    expect(rows[1].lineSubTotal).toBe('10.00')
  })
})

// repairDocFigure identifies which printed total the LLM misread (grand ≠ sub + tax) using the
// line-item sums as the tiebreaker, then recomputes it from the identity. Null when consistent.
describe('repairDocFigure', () => {
  it('returns null when the document already adds up', () => {
    expect(
      repairDocFigure({
        tgtSubTotal: 17691.1,
        tgtTax: 1238.38,
        tgtGrand: 18929.48,
        sumSub: 17691.1,
        sumTax: 1238.38,
      })
    ).toBeNull()
  })

  it('reported case: misread VAT (sub matches table, tax does not) → repair tax = grand − sub', () => {
    // Document VAT was read as 1,238.37 but the table sums to 1,238.38; sub & grand are correct.
    const r = repairDocFigure({
      tgtSubTotal: 17691.1,
      tgtTax: 1238.37,
      tgtGrand: 18929.48,
      sumSub: 17691.1,
      sumTax: 1238.38,
    })
    // Unambiguous + 1-satang gap → safe to auto-apply.
    expect(r).toEqual({ field: 'taxAmount', value: 1238.38, confident: true })
  })

  it('misread subtotal (tax matches table, sub does not) → repair sub = grand − tax', () => {
    const r = repairDocFigure({
      tgtSubTotal: 100.0,
      tgtTax: 7.0,
      tgtGrand: 107.01,
      sumSub: 100.01,
      sumTax: 7.0,
    })
    expect(r).toEqual({ field: 'subTotal', value: 100.01, confident: true })
  })

  it('misread grand (sub & tax both match the table) → repair grand = sub + tax', () => {
    const r = repairDocFigure({
      tgtSubTotal: 100.0,
      tgtTax: 7.0,
      tgtGrand: 107.01,
      sumSub: 100.0,
      sumTax: 7.0,
    })
    expect(r).toEqual({ field: 'grandTotal', value: 107.0, confident: true })
  })

  it('unambiguous but LARGE gap → not confident (needs a human look)', () => {
    // VAT misread by a whole 100 baht (1,238 → 1,338). Outlier is clear (sub corroborated), but the
    // gap is too big to silently rewrite a tax that goes to the ERP.
    const r = repairDocFigure({
      tgtSubTotal: 17691.1,
      tgtTax: 1338.38,
      tgtGrand: 18929.48,
      sumSub: 17691.1,
      sumTax: 1238.38,
    })
    expect(r).toEqual({ field: 'taxAmount', value: 1238.38, confident: false })
  })

  it('ambiguous (both disagree, equal error) → fixes tax on a tie, never confident', () => {
    // sub off by 0.01 and tax off by 0.01 vs the table; tie breaks to tax = grand − sub.
    const r = repairDocFigure({
      tgtSubTotal: 100.01,
      tgtTax: 7.01,
      tgtGrand: 107.0,
      sumSub: 100.0,
      sumTax: 7.0,
    })
    expect(r).toEqual({ field: 'taxAmount', value: 6.99, confident: false }) // 107.00 − 100.01
  })

  it('ambiguous (both disagree) → fixes the field with the larger table error, never confident', () => {
    // sub off by 0.50, tax off by 0.01 → sub is the worse outlier.
    const r = repairDocFigure({
      tgtSubTotal: 100.5,
      tgtTax: 7.01,
      tgtGrand: 107.0,
      sumSub: 100.0,
      sumTax: 7.0,
    })
    expect(r).toEqual({ field: 'subTotal', value: 99.99, confident: false }) // 107.00 − 7.01
  })
})

// Mirrors useAPInvoice.adjustField: pin-based plugs (sub then tax) + syncLineTotals. Proves the
// Grand "master reconcile" lands Σsub and Σtax on the document exactly and grand = sub + tax
// follows — without the steps re-breaking each other (the old whack-a-mole).
const header = (over: Partial<APInvoiceHeader>): APInvoiceHeader =>
  ({
    subTotal: '0',
    taxAmount: '0',
    grandTotal: '0',
    totalDiscount: '0',
    taxType: 'Exclude',
    ...over,
  }) as unknown as APInvoiceHeader

const sum = (items: APLineItem[], k: keyof APLineItem) =>
  items.reduce((s, i) => s + Number(i[k] || 0), 0)

const masterReconcile = (items: APLineItem[], docSub: number, docTax: number): APLineItem[] => {
  // useAPValidation is a pure computation (no React hooks inside); calling it here is safe.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const v = useAPValidation({
    headerData: header({ subTotal: String(docSub), taxAmount: String(docTax) }),
    lineItems: items,
    fieldMappings: {},
  })
  let updated = v.adjustField(docSub, v.sumLineSubTotal, 'lineSubTotal', items)
  // sub step writes only lineSubTotal, so Σtax is still v.sumTax for the tax step
  updated = v.adjustField(docTax, v.sumTax, 'taxAmt', updated)
  return syncLineTotals(updated)
}

describe('Grand master reconcile (pin-based, no re-break)', () => {
  it('Exclude rows incl. qty>1: Σsub, Σtax land exactly and grand = sub + tax', () => {
    const items: APLineItem[] = [
      {
        taxType: 'Exclude',
        qty: '1',
        taxPct: '7.00',
        lineSubTotal: '100.00',
        taxAmt: '7.00',
        lineTotal: '107.00',
      },
      {
        taxType: 'Exclude',
        qty: '3',
        taxPct: '7.00',
        lineSubTotal: '200.00',
        taxAmt: '14.00',
        lineTotal: '214.00',
      },
    ]
    const out = masterReconcile(items, 305, 21.35)
    expect(sum(out, 'lineSubTotal')).toBeCloseTo(305, 2)
    expect(sum(out, 'taxAmt')).toBeCloseTo(21.35, 2)
    expect(sum(out, 'lineTotal')).toBeCloseTo(326.35, 2) // = docSub + docTax
    out.forEach(r =>
      expect(Number(r.lineSubTotal) + Number(r.taxAmt)).toBeCloseTo(Number(r.lineTotal), 2)
    )
  })

  it('mixed Include + Exclude: tax step does not re-break the sub sum', () => {
    const items: APLineItem[] = [
      {
        taxType: 'Exclude',
        qty: '1',
        taxPct: '7.00',
        lineSubTotal: '100.00',
        taxAmt: '7.00',
        lineTotal: '107.00',
      },
      {
        taxType: 'Include',
        qty: '1',
        taxPct: '7.00',
        lineSubTotal: '100.00',
        taxAmt: '7.00',
        lineTotal: '107.00',
      },
    ]
    const out = masterReconcile(items, 205, 14.5)
    expect(sum(out, 'lineSubTotal')).toBeCloseTo(205, 2)
    expect(sum(out, 'taxAmt')).toBeCloseTo(14.5, 2)
    expect(sum(out, 'lineTotal')).toBeCloseTo(219.5, 2)
  })
})
