import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePaymentTypes } from './usePaymentTypes'
import { appKey } from '../../lib/storage'

// initFromData is the seam useMapping restores saved config through — it had no call
// site (and no test) until the mappings-never-restore bug, so pin its semantics here.
describe('usePaymentTypes — initFromData', () => {
  beforeEach(() => localStorage.clear())

  it('merges saved mappings into paymentAmount', () => {
    const { result } = renderHook(() => usePaymentTypes())

    act(() => {
      result.current.initFromData({ 'Account Receivable': { dept: 'GEN', acc: '1021009' } }, [])
    })

    expect(result.current.paymentAmount['Account Receivable']).toEqual({
      dept: 'GEN',
      acc: '1021009',
    })
  })

  it('seeds custom types as blank rows so they render and can be mapped', () => {
    const { result } = renderHook(() => usePaymentTypes())

    act(() => {
      result.current.initFromData({}, ['VISA'])
    })

    expect(result.current.customPaymentTypes).toEqual(['VISA'])
    expect(result.current.paymentAmount.VISA).toEqual({ dept: '', acc: '' })
  })

  it('does not blank a custom type that already carries a saved mapping', () => {
    const { result } = renderHook(() => usePaymentTypes())

    act(() => {
      result.current.initFromData({ VISA: { dept: 'GEN', acc: '1021009' } }, ['VISA'])
    })

    expect(result.current.paymentAmount.VISA).toEqual({ dept: 'GEN', acc: '1021009' })
  })

  it('keeps entries the user already edited that the saved config does not mention', () => {
    const { result } = renderHook(() => usePaymentTypes())

    act(() => {
      result.current.handlePaymentMappingChange('CASH', 'acc', '1011001')
    })
    act(() => {
      result.current.initFromData({ VISA: { dept: 'GEN', acc: '1021009' } }, [])
    })

    expect(result.current.paymentAmount.CASH.acc).toBe('1011001')
    expect(result.current.paymentAmount.VISA.acc).toBe('1021009')
  })
})

describe('usePaymentTypes — modal save/cancel', () => {
  beforeEach(() => localStorage.clear())

  it('cancel restores the mappings as they were when the modal opened', () => {
    const { result } = renderHook(() => usePaymentTypes())

    act(() => {
      result.current.initFromData({ VISA: { dept: 'GEN', acc: '1021009' } }, [])
    })
    act(() => result.current.openAmountModal())
    act(() => result.current.handlePaymentMappingChange('VISA', 'acc', '9999999'))
    act(() => result.current.cancelAmountSelection())

    expect(result.current.paymentAmount.VISA.acc).toBe('1021009')
    expect(result.current.isAmountModalOpen).toBe(false)
  })

  it('save keeps the edit and persists it', () => {
    const { result } = renderHook(() => usePaymentTypes())

    act(() => result.current.openAmountModal())
    act(() => result.current.handlePaymentMappingChange('VISA', 'acc', '1021009'))
    act(() => result.current.saveAmountSelection())

    expect(result.current.paymentAmount.VISA.acc).toBe('1021009')
    const stored = JSON.parse(localStorage.getItem(appKey('accountMappingAmount')) || '{}') as {
      VISA?: { acc?: string }
    }
    expect(stored.VISA?.acc).toBe('1021009')
  })

  it('removing a custom type drops both the type and its mapping', () => {
    const { result } = renderHook(() => usePaymentTypes())

    act(() => {
      result.current.initFromData({ VISA: { dept: 'GEN', acc: '1021009' } }, ['VISA'])
    })
    act(() => result.current.handleRemoveCustomType('VISA'))

    expect(result.current.customPaymentTypes).toEqual([])
    expect(result.current.paymentAmount.VISA).toBeUndefined()
  })
})
