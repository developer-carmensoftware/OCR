import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ssoLink, useCarmenSSO } from './useCarmenSSO'
import { CARMEN_POSTING_TOKEN_KEY } from '@/shared/api/client'
import { exchangeSSOToken } from '@/shared/api/auth'

vi.mock('@/shared/contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }))
vi.mock('@/shared/api/auth', () => ({
  exchangeSSOToken: vi.fn().mockResolvedValue({ access_token: 'a', user: {} }),
}))

const open = (hash: string) => {
  window.location.hash = hash
  return renderHook(() => useCarmenSSO())
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

  it('uses `token` on the #/pms link too (one credential, decision #42)', () => {
    open('#/pms?token=T2&bu=b&uri=https://h')
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBe('T2')
  })

  it("leaves the stored credential alone on the queue's link", () => {
    open('#/CreditCardOCR?token=T1&bu=b')
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBeNull()
  })
})

describe('the SSO link itself (CA-121)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.mocked(exchangeSSOToken).mockClear()
  })

  it('parses only a hash that carries a token', () => {
    expect(ssoLink('#/pms?token=T1&bu=b&user=u&uri=https://h')).toMatchObject({
      token: 'T1',
      bu: 'b',
      user: 'u',
      uri: 'https://h',
    })
    expect(ssoLink('#/pms?token=T1')?.bu).toBe('')
    expect(ssoLink('#/pms?bu=b')).toBeNull()
    expect(ssoLink('#/pms')).toBeNull()
  })

  it('is exchanging from the first render, so no page shows as the previous session', () => {
    window.location.hash = '#/pms?token=T1&bu=b'
    const renders: boolean[] = []
    renderHook(() => {
      const state = useCarmenSSO()
      renders.push(state.exchanging)
      return state
    })
    expect(renders[0]).toBe(true)
    expect(window.location.hash).toBe('#/pms')
    expect(exchangeSSOToken).toHaveBeenCalledWith('T1', 'b', '', '')
  })

  it('strips a token that came without a business unit and says so', () => {
    const { result } = open('#/pms?token=T1')
    expect(window.location.hash).toBe('#/pms')
    expect(result.current.error).toMatch(/missing its business unit/)
    expect(result.current.exchanging).toBe(false)
    expect(exchangeSSOToken).not.toHaveBeenCalled()
  })
})
