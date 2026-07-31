import { describe, it, expect } from 'vitest'
import { bahtToEnglishWords, formatThb, whtDeduction } from './money'

describe('whtDeduction', () => {
  it('is 3% of the ex-VAT subtotal, not of the gross', () => {
    // 990 net → 1,059.30 gross. 3% of the gross would be 31.78 — that is the classic error.
    expect(whtDeduction(990)).toBe(29.7)
    expect(whtDeduction(2490)).toBe(74.7)
    expect(whtDeduction(26892)).toBe(806.76) // sub_pro annual: 2490 × 12 × 0.9
  })

  it('rounds to satang', () => {
    expect(whtDeduction(925.23)).toBe(27.76) // 27.7569 → 27.76
  })

  it('yields the payment amount printed on the proforma', () => {
    expect(formatThb(1059.3 - whtDeduction(990), true)).toBe('1,029.60')
  })
})

describe('bahtToEnglishWords', () => {
  it('spells whole baht', () => {
    expect(bahtToEnglishWords(0)).toBe('Zero Baht Only')
    expect(bahtToEnglishWords(490)).toBe('Four Hundred Ninety Baht Only')
    expect(bahtToEnglishWords(133750)).toBe(
      'One Hundred Thirty Three Thousand Seven Hundred Fifty Baht Only'
    )
  })

  it('spells satang', () => {
    expect(bahtToEnglishWords(457.94)).toBe('Four Hundred Fifty Seven Baht and Ninety Four Satang')
  })
})
