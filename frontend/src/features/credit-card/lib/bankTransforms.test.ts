import { describe, it, expect } from 'vitest'
import { codeToSource } from './bankTransforms'

// Money path: JvhSource must be 1:1 with the bank code. If this drifts, JVs post
// to the wrong Carmen source and GL-history lookups break.
describe('codeToSource', () => {
  it('maps known bank codes to their GL source code', () => {
    expect(codeToSource('KBANK')).toBe('ACKB')
    expect(codeToSource('BBL')).toBe('ACBB')
    expect(codeToSource('SCB')).toBe('ACSC')
    expect(codeToSource('BAY')).toBe('ACBY')
    expect(codeToSource('KTC')).toBe('ACKC')
  })

  it('returns "" for empty/unknown/nullish input (safe fallback)', () => {
    expect(codeToSource('')).toBe('')
    expect(codeToSource('NOPE')).toBe('')
    expect(codeToSource(null)).toBe('')
    expect(codeToSource(undefined)).toBe('')
  })
})
