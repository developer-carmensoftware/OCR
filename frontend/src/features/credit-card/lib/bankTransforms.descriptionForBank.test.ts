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
    expect(descriptionForBank('Generic', perBank, 'SCB')).toBe('SCB Credit Card Settlement')
    expect(descriptionForBank('Generic', perBank, 'KTC')).toBe('KTC Merchant Fee')
  })

  it('falls back to the BU-wide description for every other bank', () => {
    expect(descriptionForBank('Generic', perBank, 'BBL')).toBe('Generic')
    expect(descriptionForBank('Generic', perBank, '')).toBe('Generic')
    expect(descriptionForBank('Generic', {}, 'SCB')).toBe('Generic')
    expect(descriptionForBank('Generic', undefined, 'SCB')).toBe('Generic')
  })

  it('does not treat a blank per-bank entry as an override', () => {
    expect(descriptionForBank('Generic', { SCB: '   ' }, 'SCB')).toBe('Generic')
    expect(descriptionForBank('Generic', { SCB: '' }, 'SCB')).toBe('Generic')
  })

  it('is an empty string, not undefined, when nothing is set', () => {
    expect(descriptionForBank(null, null, 'SCB')).toBe('')
    expect(descriptionForBank(undefined, undefined, undefined)).toBe('')
  })
})
