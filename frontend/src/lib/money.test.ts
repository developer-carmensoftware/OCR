import { describe, it, expect } from 'vitest'
import { bahtToEnglishWords, bahtToThaiWords } from './money'

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

describe('bahtToThaiWords', () => {
  it('spells whole baht with ถ้วน', () => {
    expect(bahtToThaiWords(0)).toBe('ศูนย์บาทถ้วน')
    expect(bahtToThaiWords(490)).toBe('สี่ร้อยเก้าสิบบาทถ้วน')
    expect(bahtToThaiWords(1_000_000)).toBe('หนึ่งล้านบาทถ้วน')
  })

  it('applies ยี่สิบ and เอ็ด', () => {
    expect(bahtToThaiWords(21)).toBe('ยี่สิบเอ็ดบาทถ้วน')
    expect(bahtToThaiWords(11)).toBe('สิบเอ็ดบาทถ้วน')
  })

  it('spells satang', () => {
    expect(bahtToThaiWords(2664.3)).toBe('สองพันหกร้อยหกสิบสี่บาทสามสิบสตางค์')
  })
})
