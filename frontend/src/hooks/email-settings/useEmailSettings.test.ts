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
  rules: [
    {
      bank_code: 'KBANK',
      bank_sender_email: null,
      filename_patterns: ['KB1P554V2'],
      is_active: true,
      doc_type: 'ar_reconcile',
    },
    { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
  ],
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

/**
 * The same shape of bug one field over. `PUT /settings` replaces the rules array whole, and
 * this hook sends the WHOLE payload on every save — the review switch, a new tax ID,
 * turning ingestion on. So a field `toPayloadRules` forgets is a field that any unrelated
 * save deletes from every rule the BU has.
 *
 * The page's own tests cannot catch this: they mock this hook. That is how `doc_type` came
 * to be dropped in two places with only one of them covered.
 */
describe('every save carries the whole rules array', () => {
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

  const sentRules = () => {
    const calls = vi.mocked(api.saveSettings).mock.calls
    return calls[calls.length - 1][0].rules
  }

  it('flipping the review switch keeps each rule’s document type', async () => {
    const result = await loaded()
    await act(async () => {
      await result.current.setAutoPost(false)
    })
    // Nothing about the rules was being edited, and nothing about them may change.
    expect(sentRules().map(r => r.doc_type)).toEqual(['ar_reconcile', 'fee_invoice'])
  })

  it('adding a tax ID keeps them too', async () => {
    const result = await loaded()
    await act(async () => {
      await result.current.setTaxIds(['0105536000128'])
    })
    expect(sentRules()[0].doc_type).toBe('ar_reconcile')
  })

  it('turning ingestion off keeps them', async () => {
    const result = await loaded()
    await act(async () => {
      await result.current.setEnabled(false)
    })
    expect(sentRules()[0].doc_type).toBe('ar_reconcile')
  })

  it('a rule stored before the field existed is sent as the type it was', async () => {
    const result = await loaded()
    await act(async () => {
      await result.current.setOwnerEmails(['acct@hotel.com'])
    })
    // Explicit rather than absent: on a full-replace payload the two only mean the same
    // thing because the server defaults, and leaving that to chance is what this is about.
    expect(sentRules()[1].doc_type).toBe('fee_invoice')
  })
})
