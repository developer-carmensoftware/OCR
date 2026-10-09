import { describe, expect, it } from 'vitest'
import { fmtAmount, fmtCents, jvLines, keyOf, signedCents } from './pmsDay'
import type { PmsRow } from '@/features/credit-card/api/pmsReview'

// The same synthetic day as backend tests/unit/test_pms_day.py: 1,127 of revenue = 500 paid
// + 627 left on guests' folios. Browser and server must agree on the JV it makes.
const ROWS: PmsRow[] = [
  { type: 'Revenue', code: '100', desc: 'Room Charge', amount: '1000.00' },
  { type: 'Revenue', code: '100', desc: 'Room Charge - SERVICE', amount: '100.00' },
  { type: 'Revenue', code: '100', desc: 'Room Charge - VAT', amount: '77.00' },
  { type: 'Revenue', code: '729', desc: 'Rebate - Misc. (VAT)', amount: '-50.00' },
  { type: 'Payment', code: '900', desc: 'Cash', amount: '-500.00' },
  { type: 'Guest Ledger', code: 'Guest Ledger', desc: 'Guest Ledger', amount: '627.00' },
]
const RULES = {
  'Revenue|100': { dept: '101', acc: '4010001' },
  'VAT|*': { dept: 'GEN', acc: '2012002' },
  'SVC|*': { dept: 'GEN', acc: '2013002' },
  'Revenue|729': { dept: '304', acc: '4240011' },
  'Payment|900': { dept: '101', acc: '1010001' },
  'Ledger|Guest Ledger': { dept: '101', acc: '1021001' },
}

describe('a PMS day in the browser', () => {
  it('keys rows the way the server does', () => {
    expect(ROWS.map(keyOf)).toEqual([
      'Revenue|100',
      'SVC|*',
      'VAT|*',
      'Revenue|729',
      'Payment|900',
      'Ledger|Guest Ledger',
    ])
  })

  it('reverses the guest ledger and balances to zero', () => {
    expect(signedCents(ROWS[5])).toBe(-62700)
    expect(ROWS.reduce((s, r) => s + signedCents(r), 0)).toBe(0)
  })

  it('builds the JV debits first, by account, and leaves out an unmapped key', () => {
    expect(jvLines(ROWS, RULES).map(l => [l.acc, l.cents])).toEqual([
      ['1010001', -50000],
      ['1021001', -62700],
      ['4240011', -5000],
      ['2012002', 7700],
      ['2013002', 10000],
      ['4010001', 100000],
    ])
    const partial = { ...RULES, 'Revenue|729': { dept: '304', acc: '' } }
    expect(jvLines(ROWS, partial).map(l => l.acc)).not.toContain('4240011')
  })

  it('formats without a sign', () => {
    expect(fmtCents(-254294)).toBe('2,542.94')
    expect(fmtAmount('-849.62')).toBe('849.62')
  })
})
