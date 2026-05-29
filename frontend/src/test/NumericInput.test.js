import { describe, it, expect } from 'vitest'
import { sanitizeNumericInput } from '../components/common/NumericInput'

describe('sanitizeNumericInput', () => {
  it('strips letters but keeps digits and decimal point', () => {
    expect(sanitizeNumericInput('12ab.3x4')).toBe('12.34')
  })

  it('removes arbitrary symbols', () => {
    expect(sanitizeNumericInput('$1@2#3')).toBe('123')
  })

  it('preserves thousands-separator commas', () => {
    expect(sanitizeNumericInput('1,234.56')).toBe('1,234.56')
  })

  it('collapses multiple decimal points to the first', () => {
    expect(sanitizeNumericInput('1.2.3.4')).toBe('1.234')
  })

  it('keeps a single leading minus when negatives are allowed', () => {
    expect(sanitizeNumericInput('-12.3')).toBe('-12.3')
  })

  it('drops a non-leading minus', () => {
    expect(sanitizeNumericInput('12-3')).toBe('123')
  })

  it('strips the minus when negatives are disallowed', () => {
    expect(sanitizeNumericInput('-12.3', false)).toBe('12.3')
  })

  it('returns empty string for an all-letters input', () => {
    expect(sanitizeNumericInput('abc')).toBe('')
  })
})
