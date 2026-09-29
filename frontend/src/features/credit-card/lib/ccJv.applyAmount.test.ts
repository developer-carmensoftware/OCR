import { describe, it, expect } from 'vitest'
import { applyJvAmount, buildJvRows, type JvRow } from './ccJv'

/**
 * `applyJvAmount` puts a figure typed on the JV back into the detail lines it was summed
 * from. That matters beyond the journal: `build_input_tax_payload` files the VAT record
 * from `details`, line by line, so a figure that moved only on the JV would post a tax
 * record that disagrees with it.
 */

const CONFIG = {
  mappings: {
    commission: { dept: 'OPS', acc: '510300' },
    tax: { dept: 'OPS', acc: '511200' },
    net: { dept: 'OPS', acc: '110200' },
  },
  paymentAmount: { Visa: { dept: 'OPS', acc: '110300' } },
}

const TWO_LINES = [
  { Transaction: 'Visa', PayAmt: '1000.00', CommisAmt: '30.00', TaxAmt: '2.10', Total: '967.90' },
  { Transaction: 'Visa', PayAmt: '500.00', CommisAmt: '15.00', TaxAmt: '1.05', Total: '483.95' },
]

const rows = (details: typeof TWO_LINES) => buildJvRows(details, CONFIG, { consolidateDebit: true })
const leg = (details: typeof TWO_LINES, key: string): JvRow =>
  rows(details).find(r => r.key === key)!

describe('a leg that came from one line', () => {
  it('is written straight through, no judgement involved', () => {
    const one = [TWO_LINES[0]]
    const out = applyJvAmount(one, leg(one, 'Visa'), 1200)
    expect(out[0].PayAmt).toBe('1200.00')
  })

  it('leaves the other lines untouched', () => {
    // A credit leg is 1:1 with its own line even when the document has several.
    const out = applyJvAmount(TWO_LINES, rows(TWO_LINES)[1], 600)
    expect(out.map(d => d.PayAmt)).toEqual(['1000.00', '600.00'])
  })
})

describe('a leg summed from several lines', () => {
  it('shares the new figure out in proportion to what each line carries', () => {
    // Commission is 30 + 15 = 45, so 60 splits two-to-one.
    const out = applyJvAmount(TWO_LINES, leg(TWO_LINES, 'commission'), 60)
    expect(out.map(d => d.CommisAmt)).toEqual(['40.00', '20.00'])
  })

  it('totals exactly what was typed, rounding and all', () => {
    // The parts must add to the figure on screen. One satang out and the JV refuses to
    // balance, over an edit the reviewer made correctly.
    const out = applyJvAmount(TWO_LINES, leg(TWO_LINES, 'tax'), 10)
    const total = out.reduce((s, d) => s + parseFloat(d.TaxAmt), 0)
    expect(Number(total.toFixed(2))).toBe(10)
  })

  it('splits evenly when there is nothing to be proportional to', () => {
    // An all-zero column has no ratio to preserve; even is the only neutral answer.
    const zeroed = TWO_LINES.map(d => ({ ...d, Total: '0.00' }))
    const out = applyJvAmount(zeroed, leg(zeroed, 'net'), 100)
    expect(out.map(d => d.Total)).toEqual(['50.00', '50.00'])
  })

  it('does not touch a column it was not editing', () => {
    const out = applyJvAmount(TWO_LINES, leg(TWO_LINES, 'commission'), 60)
    expect(out.map(d => d.PayAmt)).toEqual(['1000.00', '500.00'])
    expect(out.map(d => d.TaxAmt)).toEqual(['2.10', '1.05'])
  })
})

describe('the JV that comes back out', () => {
  it('shows the edited figure, so what was typed is what will post', () => {
    // The round trip is the whole contract: type on the JV, land in the lines, rebuild the
    // JV from those lines, read the same number back.
    const out = applyJvAmount(TWO_LINES, leg(TWO_LINES, 'commission'), 60)
    expect(leg(out, 'commission').debit).toBe(60)
  })

  it('ignores a line index the details no longer have', () => {
    // Deleting a line while a stale row is in hand must not write past the end.
    const stale: JvRow = { ...leg(TWO_LINES, 'commission'), lines: [7] }
    expect(applyJvAmount(TWO_LINES, stale, 99)).toEqual(TWO_LINES)
  })
})
