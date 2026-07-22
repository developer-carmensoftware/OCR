import { describe, it, expect } from 'vitest'
import {
  parseDefaultAccount,
  allowedAccountsForDept,
  isAccountAllowed,
  mergeSuggestion,
} from './deptAccounts'

const ACCOUNTS = [{ code: '4010001' }, { code: '4010002' }, { code: '9999999' }]
const DEPTS = [
  { code: '101', allowedAccounts: [] }, // wildcard
  { code: '103', allowedAccounts: ['4010001', '4010002'] }, // restricted
  { code: '104' }, // no field = wildcard
]

describe('parseDefaultAccount', () => {
  it('parses the stringified JSON array Carmen sends', () => {
    const raw = '[{"AccCode":"4010001","Description":"Room Revenue"},{"AccCode":"4010002"}]'
    expect(parseDefaultAccount(raw)).toEqual(['4010001', '4010002'])
  })

  it('treats "[]", garbage, and non-strings as wildcard', () => {
    expect(parseDefaultAccount('[]')).toEqual([])
    expect(parseDefaultAccount('not json')).toEqual([])
    expect(parseDefaultAccount(undefined)).toEqual([])
    expect(parseDefaultAccount(42)).toEqual([])
  })

  it('accepts a native array too', () => {
    expect(parseDefaultAccount([{ AccCode: '1' }, { nope: true }])).toEqual(['1'])
  })
})

describe('allowedAccountsForDept', () => {
  it('returns all accounts when no dept chosen', () => {
    expect(allowedAccountsForDept('', DEPTS, ACCOUNTS)).toEqual(ACCOUNTS)
  })

  it('returns all accounts for wildcard depts', () => {
    expect(allowedAccountsForDept('101', DEPTS, ACCOUNTS)).toEqual(ACCOUNTS)
    expect(allowedAccountsForDept('104', DEPTS, ACCOUNTS)).toEqual(ACCOUNTS)
  })

  it('filters to the restricted list', () => {
    expect(allowedAccountsForDept('103', DEPTS, ACCOUNTS).map(a => a.code)).toEqual([
      '4010001',
      '4010002',
    ])
  })

  it('unknown dept = all accounts', () => {
    expect(allowedAccountsForDept('XXX', DEPTS, ACCOUNTS)).toEqual(ACCOUNTS)
  })
})

describe('mergeSuggestion', () => {
  it('drops a suggested acc the user-kept dept forbids (mixed pair)', () => {
    // user picked restricted dept 103; suggestion pair was (GEN, 9999999)
    const out = mergeSuggestion({ dept: '103', acc: '' }, { dept: 'GEN', acc: '9999999' }, DEPTS)
    expect(out).toEqual({ dept: '103', acc: '' })
  })

  it('applies a suggested acc the kept dept allows', () => {
    const out = mergeSuggestion({ dept: '103', acc: '' }, { dept: 'GEN', acc: '4010001' }, DEPTS)
    expect(out).toEqual({ dept: '103', acc: '4010001' })
  })

  it('applies the full pair when user picked nothing', () => {
    const out = mergeSuggestion({ dept: '', acc: '' }, { dept: '103', acc: '4010002' }, DEPTS)
    expect(out).toEqual({ dept: '103', acc: '4010002' })
  })

  it('never overrides user-picked values', () => {
    const out = mergeSuggestion(
      { dept: '101', acc: '9999999' },
      { dept: '103', acc: '4010001' },
      DEPTS
    )
    expect(out).toEqual({ dept: '101', acc: '9999999' })
  })
})

describe('isAccountAllowed', () => {
  it('restricted dept rejects unlisted account', () => {
    expect(isAccountAllowed('103', '9999999', DEPTS)).toBe(false)
  })

  it('restricted dept allows listed account', () => {
    expect(isAccountAllowed('103', '4010001', DEPTS)).toBe(true)
  })

  it('wildcard / missing dept / missing acc are allowed', () => {
    expect(isAccountAllowed('101', '9999999', DEPTS)).toBe(true)
    expect(isAccountAllowed('', '9999999', DEPTS)).toBe(true)
    expect(isAccountAllowed('103', '', DEPTS)).toBe(true)
  })
})
