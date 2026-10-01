import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { seedDraft, splitList, useEmailSettings } from './useEmailSettings'

vi.mock('@/features/email-settings/api/emailAutomation', async importOriginal => ({
  // EmailApiError is thrown and instanceof-checked by the hook, not stubbed.
  ...(await importOriginal<typeof import('@/features/email-settings/api/emailAutomation')>()),
  getSettings: vi.fn(),
  getBankCodes: vi.fn(),
  getToken: vi.fn(),
  putToken: vi.fn(),
  saveSettings: vi.fn(),
}))
vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uri: 'https://hotel.carmenwork.com', bu: 'hq' } }),
}))

import * as api from '@/features/email-settings/api/emailAutomation'
import { CARMEN_POSTING_TOKEN_KEY } from '@/shared/api/client'

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

const sentBody = () => {
  const calls = vi.mocked(api.saveSettings).mock.calls
  return calls[calls.length - 1][0]
}

/** `PUT /settings` is a full replace with exactly one exception: `auto_post` is kept when
 *  the payload omits it. That exception only buys anything if this hook actually omits it —
 *  which is the bug it was written for. A BU on auto-post that corrected a filename pattern
 *  used to go back to approving every document, silently. A Save button does not remove
 *  that race (a colleague flipping the switch on Carmen's screen while this tab sat open),
 *  it lengthens it. */
describe('the one field that must not ride along', () => {
  it('sends no auto_post when the switch was not touched', async () => {
    const result = await loaded()
    act(() => result.current.patch({ tax_ids: '0105536000128' }))
    await act(async () => {
      await result.current.save()
    })

    expect(sentBody().tax_ids).toEqual(['0105536000128'])
    // Absent, not `false` and not a re-send of what we happen to hold — the server keeps
    // whatever is stored, which is the only reading that survives a stale copy.
    expect('auto_post' in sentBody()).toBe(false)
  })

  it('sends it when the switch is what moved', async () => {
    const result = await loaded()
    act(() => result.current.patch({ auto_post: false }))
    await act(async () => {
      await result.current.save()
    })
    expect(sentBody().auto_post).toBe(false)
  })
})

/**
 * A rule saved from its dialog (or its row switch) goes out on its own, but `PUT /settings`
 * is a full replace — so the other fields still travel, and they must travel as the server
 * last confirmed them. A tax ID the user is halfway through typing must neither be sent with
 * a rule nor lost by it.
 */
describe('a rule saved on its own', () => {
  it('sends the other fields as last saved, omits auto_post, and keeps unsaved edits', async () => {
    const result = await loaded()
    act(() => result.current.patch({ tax_ids: '0105536000999', auto_post: false }))

    const rules = [
      ...result.current.draft.rules,
      { ...result.current.draft.rules[1], bank_code: 'SCB' },
    ]
    await act(async () => {
      await result.current.saveRules(rules)
    })

    expect(sentBody().tax_ids).toEqual(['0105536000127']) // the saved value, not the draft's
    expect(sentBody().enabled).toBe(true)
    expect('auto_post' in sentBody()).toBe(false)
    expect(sentBody().rules.map(r => r.bank_code)).toEqual(['KBANK', 'KTC', 'SCB'])
    // The half-typed edits are still the user's to save or discard.
    expect(result.current.draft.tax_ids).toBe('0105536000999')
    expect(result.current.draft.auto_post).toBe(false)
    expect(result.current.dirty).toBe(true)
  })
})

/**
 * The same shape of bug one field over. `PUT /settings` replaces the rules array whole, and
 * Save sends the WHOLE draft — the review switch, a new tax ID, turning ingestion on. So a
 * field `seedDraft` forgets is a field that any unrelated save deletes from every rule the
 * BU has.
 *
 * The page's own tests cannot catch this: they mock this hook. That is how `doc_type` came
 * to be dropped in two places with only one of them covered.
 */
describe('every save carries the whole rules array', () => {
  const sentRules = () => sentBody().rules

  it('flipping the review switch keeps each rule’s document type', async () => {
    const result = await loaded()
    act(() => result.current.patch({ auto_post: false }))
    await act(async () => {
      await result.current.save()
    })
    // Nothing about the rules was being edited, and nothing about them may change.
    expect(sentRules().map(r => r.doc_type)).toEqual(['ar_reconcile', 'fee_invoice'])
  })

  it('a rule stored before the field existed is sent as the type it was', async () => {
    const result = await loaded()
    act(() => result.current.patch({ owner_emails: 'acct@hotel.com' }))
    await act(async () => {
      await result.current.save()
    })
    // Explicit rather than absent: on a full-replace payload the two only mean the same
    // thing because the server defaults, and leaving that to chance is what this is about.
    expect(sentRules()[1].doc_type).toBe('fee_invoice')
  })

  it('keeps a stored PDF password by sending null, not an empty string', async () => {
    const result = await loaded()
    await act(async () => {
      await result.current.save()
    })
    // '' would clear it (`_merge_rule`); untouched must mean untouched.
    expect(sentRules().every(r => r.pdf_password === null)).toBe(true)
  })
})

describe('the dirty form', () => {
  it('is clean on load and after a save', async () => {
    const result = await loaded()
    expect(result.current.dirty).toBe(false)

    act(() => result.current.patch({ tax_ids: '0105536000128' }))
    expect(result.current.dirty).toBe(true)

    // The response reseeds the draft, so the form shows what the server actually stored.
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.dirty).toBe(false)
    expect(result.current.draft.tax_ids).toBe('0105536000127')
  })

  it('reset restores the last confirmed state without a request', async () => {
    const result = await loaded()
    act(() => result.current.patch({ enabled: false, rules: [] }))
    act(() => result.current.reset())

    expect(result.current.dirty).toBe(false)
    expect(result.current.draft.enabled).toBe(true)
    expect(result.current.draft.rules).toHaveLength(2)
    expect(api.saveSettings).not.toHaveBeenCalled()
  })

  it('keeps what was typed when the server rejects it', async () => {
    const result = await loaded()
    vi.mocked(api.saveSettings).mockRejectedValueOnce(
      new api.EmailApiError(422, 'Invalid', [
        { field: 'tax_ids[0]', code: 'invalid_checksum', message: 'Not a valid tax ID' },
      ])
    )
    act(() => result.current.patch({ tax_ids: '123' }))
    await act(async () => {
      expect(await result.current.save()).toBe(false)
    })

    expect(result.current.draft.tax_ids).toBe('123')
    expect(result.current.fieldErrors['tax_ids[0]']).toBe('Not a valid tax ID')
  })
})

describe('splitList', () => {
  it('takes commas or new lines, and drops the gaps', () => {
    expect(splitList('a@x.com, b@x.com\nc@x.com')).toEqual(['a@x.com', 'b@x.com', 'c@x.com'])
    // A trailing separator is what someone mid-typing leaves behind — never an empty entry.
    expect(splitList('0105536000127, ')).toEqual(['0105536000127'])
    expect(splitList('   ')).toEqual([])
  })
})

describe('seedDraft', () => {
  it('renders a rule’s lists as text and never leaks the password', () => {
    const draft = seedDraft({
      ...SETTINGS,
      rules: [
        {
          bank_code: 'KBANK',
          bank_sender_email: null,
          filename_patterns: ['MDR', 'Commission'],
          is_active: true,
          has_password: true,
          doc_type: 'ar_reconcile',
        },
      ],
    } as unknown as api.EmailSettings)

    expect(draft.rules[0]).toEqual({
      bank_code: 'KBANK',
      bank_sender_email: '',
      filename_patterns: 'MDR, Commission',
      pdf_password: '',
      is_active: true,
      doc_type: 'ar_reconcile',
      has_password: true,
    })
  })
})

/** Carmen's menu mints a fresh posting token on every open and passes it in the link, which
 *  kills the one we hold (decision #35). So it is stored before anything is read, and a
 *  failure is kept where Reload can retry it rather than dropped. */
describe('the posting token Carmen sends with the link', () => {
  beforeEach(() => {
    sessionStorage.removeItem(CARMEN_POSTING_TOKEN_KEY)
    vi.mocked(api.putToken).mockResolvedValue({
      configured: true,
      fingerprint: 'abcd1234',
      carmen_uri: 'https://hotel.carmenwork.com',
      verified_at: '2026-10-01T07:00:00Z',
    })
  })

  it('is stored before the settings are read, then forgotten', async () => {
    sessionStorage.setItem(CARMEN_POSTING_TOKEN_KEY, 'fresh')
    const result = await loaded()

    expect(api.putToken).toHaveBeenCalledWith('https://hotel.carmenwork.com', 'hq', 'fresh')
    expect(vi.mocked(api.putToken).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.getSettings).mock.invocationCallOrder[0]
    )
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBeNull()
    expect(result.current.tokenError).toBeNull()
  })

  it('says so when it cannot be stored, and keeps it until a token is set', async () => {
    sessionStorage.setItem(CARMEN_POSTING_TOKEN_KEY, 'fresh')
    vi.mocked(api.putToken).mockRejectedValueOnce(new Error('Carmen rejected this token'))
    const result = await loaded()

    expect(result.current.tokenError).toBe('Carmen rejected this token')
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBe('fresh')
    expect(result.current.settings).not.toBeNull()

    // A hand-set token wins: Reload must not write the unstored one back over it.
    await act(async () => {
      await result.current.saveToken('hand-set')
    })
    expect(sessionStorage.getItem(CARMEN_POSTING_TOKEN_KEY)).toBeNull()
    expect(result.current.tokenError).toBeNull()
  })

  it('stores nothing when the link carried none', async () => {
    await loaded()
    expect(api.putToken).not.toHaveBeenCalled()
  })
})
