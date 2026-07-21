import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBankConfig } from './useBankConfig'

vi.mock('../../lib/api/config', () => ({ getAccountingConfig: vi.fn() }))

import { getAccountingConfig as realGetAccountingConfig } from '../../lib/api/config'
import { appKey } from '../../lib/storage'

const getAccountingConfig = vi.mocked(realGetAccountingConfig)

// The GHL fee invoice prints the issuer's head-office code; useOcrExtraction parks it here.
function seedOcrBranch(branch: string) {
  localStorage.setItem(
    appKey('accountingConfig'),
    JSON.stringify({ company: { name: 'NTT DATA Digital Payment (Thailand) Co., Ltd.', branch } })
  )
}

// Saved config for a bank, in the API shape — note it has no branch of its own.
function apiConfig(extra: Record<string, unknown> = {}) {
  return { bank_code: 'GHL', file_prefix: 'IC', mappings: {}, custom_types: [], ...extra }
}

describe('useBankConfig — branch', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('falls back to the OCR-extracted branch when the saved config carries none', async () => {
    seedOcrBranch('00000')
    getAccountingConfig.mockResolvedValue(apiConfig() as never)

    const { result } = renderHook(() => useBankConfig())
    await waitFor(() => expect(result.current.configLoading).toBe(false))

    expect(result.current.company.branch).toBe('00000')
  })

  it('prefers the saved config branch over the OCR one', async () => {
    seedOcrBranch('00000')
    getAccountingConfig.mockResolvedValue(apiConfig({ branch: '00123' }) as never)

    const { result } = renderHook(() => useBankConfig())
    await waitFor(() => expect(result.current.configLoading).toBe(false))

    expect(result.current.company.branch).toBe('00123')
  })

  it('keeps the OCR branch when the API has no config at all', async () => {
    seedOcrBranch('00000')
    getAccountingConfig.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useBankConfig())
    await waitFor(() => expect(result.current.configLoading).toBe(false))

    expect(result.current.company.branch).toBe('00000')
  })
})
