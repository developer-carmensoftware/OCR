import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUserConsent } from './useUserConsent'
import type { AuthUser } from '../contexts/AuthContext'
import * as consentApi from '../lib/api/consent'

const user = { tenant_id: 't-1' } as AuthUser

describe('useUserConsent', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('never shows the modal while the server check is in flight', async () => {
    let resolve!: (v: boolean) => void
    vi.spyOn(consentApi, 'getConsentStatus').mockReturnValue(
      new Promise<boolean>(r => {
        resolve = r
      })
    )

    const { result } = renderHook(() => useUserConsent(user))
    expect(result.current.showConsent).toBe(false) // <- the bug: used to be true

    resolve(true)
    await waitFor(() => expect(result.current.showConsent).toBe(false))
  })

  it('shows the modal once the server says no record exists', async () => {
    vi.spyOn(consentApi, 'getConsentStatus').mockResolvedValue(false)
    const { result } = renderHook(() => useUserConsent(user))
    await waitFor(() => expect(result.current.showConsent).toBe(true))
  })

  it('skips the network entirely when locally cached', () => {
    localStorage.setItem('ocr_consent_v2_t-1', '1')
    const spy = vi.spyOn(consentApi, 'getConsentStatus')
    const { result } = renderHook(() => useUserConsent(user))
    expect(result.current.showConsent).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })
})
