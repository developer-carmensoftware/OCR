import { describe, it, expect } from 'vitest'
import { descriptionForBank } from './bankTransforms'

/** Twin of test_accounting_config_service.py's description_for cases.
 *
 * These two implementations resolve the same field for the same statement — the
 * wizard here, the email-ingest job in Python. If they drift, one statement posts
 * under two different descriptions depending on which route it arrived by. */
describe('descriptionForBank', () => {
  const perBank = { SCB: 'SCB Credit Card Settlement', KTC: 'KTC Merchant Fee' }

  it('gives a bank its own wording when it has one', () => {
    expect(descriptionForBank(perBank, 'SCB')).toBe('SCB Credit Card Settlement')
    expect(descriptionForBank(perBank, 'KTC')).toBe('KTC Merchant Fee')
  })

  // 2026-09-30: no BU-wide fallback — it was read everywhere and editable nowhere.
  it('gives every other bank nothing', () => {
    expect(descriptionForBank(perBank, 'BBL')).toBe('')
    expect(descriptionForBank(perBank, '')).toBe('')
    expect(descriptionForBank({}, 'SCB')).toBe('')
  })

  it('treats a blank entry as no description', () => {
    expect(descriptionForBank({ SCB: '   ' }, 'SCB')).toBe('')
  })

  it('is an empty string, not undefined, when nothing is set', () => {
    expect(descriptionForBank(null, 'SCB')).toBe('')
    expect(descriptionForBank(undefined, undefined)).toBe('')
  })
})
