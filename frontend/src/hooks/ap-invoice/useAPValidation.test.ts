import { describe, it, expect } from 'vitest'
import { reconcileRows } from './useAPValidation'
import type { APLineItem } from './useAPExtraction'

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
