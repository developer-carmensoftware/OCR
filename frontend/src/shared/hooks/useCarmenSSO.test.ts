import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCarmenSSO } from './useCarmenSSO'
import { CARMEN_POSTING_TOKEN_KEY } from '@/shared/api/client'

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }))
vi.mock('@/shared/api/auth', () => ({
  exchangeSSOToken: vi.fn().mockResolvedValue({ access_token: 'a', user: {} }),
}))

const open = (hash: string) => {
  window.location.hash = hash
  renderHook(() => useCarmenSSO())
}

describe('posting token from the SSO link', () => {
  beforeEach(() => sessionStorage.clear())

  it('uses `token` itself on the settings link (one token with Carmen)', () => {
    open('#/CreditCardOCR/email-settings?token=T1&bu=b&uri=https://h')
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBe('T1')
  })

  it('prefers an explicit posting_token', () => {
    open('#/CreditCardOCR/email-settings?token=T1&posting_token=P1&bu=b')
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBe('P1')
  })

  it("leaves the stored credential alone on the queue's link", () => {
    open('#/CreditCardOCR?token=T1&bu=b')
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBeNull()
  })
})
