import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEmailSettings } from './useEmailSettings'

vi.mock('../../lib/api/emailAutomation', async importOriginal => ({
  // EmailApiError is thrown and instanceof-checked by the hook, not stubbed.
  ...(await importOriginal<typeof import('../../lib/api/emailAutomation')>()),
  getSettings: vi.fn(),
  getBankCodes: vi.fn(),
  getToken: vi.fn(),
  saveSettings: vi.fn(),
}))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uri: 'https://hotel.carmenwork.com', bu: 'hq' } }),
}))

import * as api from '../../lib/api/emailAutomation'

const SETTINGS = {
  host: 'hotel.carmenwork.com',
  bu: 'hq',
  enabled: true,
  auto_post: true,
  ingest_address: 'AIAGENT+a1b2c3d4@carmensoftware.com',
  owner_emails: [],
  tax_ids: ['0105536000127'],
  rules: [],
  gmail_confirmed_at: null,
  gmail_confirm: null,
  status: { ready: true, blockers: [] },
} as unknown as api.EmailSettings

/** `PUT /settings` is a full replace with exactly one exception: `auto_post` is kept when
 *  the payload omits it. That exception only buys anything if this hook actually omits it —
 *  which is the bug it was written for. A BU on auto-post that corrected a filename pattern
 *  used to go back to approving every document, silently. */
describe('useEmailSettings and the one field that must not ride along', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.getSettings).mockResolvedValue(SETTINGS)
    vi.mocked(api.getBankCodes).mockResolvedValue([])
    vi.mocked(api.getToken).mockResolvedValue(null as never)
    vi.mocked(api.saveSettings).mockResolvedValue(SETTINGS)
  })

  const loaded = async () => {
    const { result } = renderHook(() => useEmailSettings())
    await waitFor(() => expect(result.current.loading).toBe(false))
    return result
  }

  it('sends no auto_post on an unrelated save', async () => {
    const result = await loaded()
    await act(async () => {
      await result.current.setTaxIds(['0105536000128'])
    })
    const body = vi.mocked(api.saveSettings).mock.calls[0][0]
    expect(body.tax_ids).toEqual(['0105536000128'])
    // Absent, not `false` and not a re-send of what we happen to hold — the server keeps
    // whatever is stored, which is the only reading that survives a stale copy.
    expect('auto_post' in body).toBe(false)
  })

  it('sends it, and only it, when the switch is what moved', async () => {
    const result = await loaded()
    await act(async () => {
      await result.current.setAutoPost(false)
    })
    expect(vi.mocked(api.saveSettings).mock.calls[0][0].auto_post).toBe(false)
  })
})
