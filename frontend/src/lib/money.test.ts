import { describe, it, expect } from 'vitest'
import { bahtToEnglishWords } from './money'

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
