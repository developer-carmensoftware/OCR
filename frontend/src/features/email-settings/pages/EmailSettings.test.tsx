import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import EmailSettings from './EmailSettings'
import {
  seedDraft,
  type Draft,
  type RuleDraft,
} from '@/features/email-settings/hooks/useEmailSettings'
import type { EmailRule } from '@/features/email-settings/api/emailAutomation'

/**
 * This screen's tests, and they exist for one reason.
 *
 * `PUT /api/v1/carmen/settings` is a FULL REPLACE of the rules array. The form holds that
 * array in a draft, so any field the draft does not carry is a field it deletes from every
 * rule the moment someone saves. `auto_post` already had to be given a merge rule after
 * exactly that happened in production (2026-09-08); `doc_type` is the next field with the
 * same exposure, and losing it turns a settlement report back into a commission invoice —
 * read with the wrong layout, posted to the wrong accounts.
 *
 * Since 2026-09-10 the page is a dirty form with one Save, so the dirty-form cases cover that
 * too: nothing may reach the server before Save, and Discard must put back exactly what the
 * server last confirmed. Since 2026-10-01 rules are summary rows edited in place, so a test
 * opens a rule (`openRule`) before reaching its fields.
 */

const save = vi.fn(async () => true)
/** The rule dialog and row switch save the whole rules list at once through this. */
const saveRules = vi.fn(async (_rules: RuleDraft[]) => true)
const removeToken = vi.fn()
let tokenStatus: unknown = null
let tokenError: string | null = null
let fieldErrors: Record<string, string> = {}
let rules: EmailRule[] = []
/** The draft the page is editing, owned here so `patch` behaves like the real hook. */
let draft: Draft

vi.mock('@/features/email-settings/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/features/email-settings/hooks')>()
  return {
    ...actual,
    useEmailSettings: () => {
      const settings = {
        host: 'hotel.carmenwork.com',
        bu: 'hq',
        enabled: true,
        auto_post: false,
        entitled: true,
        ingest_address: 'AIAGENT+abc123@carmensoftware.com',
        owner_emails: ['acct@hotel.com'],
        tax_ids: ['0105536000123'],
        rules,
        status: { ready: true, blockers: [] },
        gmail_confirmed_at: null,
        gmail_confirm: null,
      }
      return {
        settings,
        draft,
        dirty: JSON.stringify(draft) !== JSON.stringify(seedDraft(settings as never)),
        loading: false,
        saving: false,
        error: null,
        fieldErrors,
        host: 'hotel.carmenwork.com',
        bu: 'hq',
        tokenStatus,
        tokenError,
        banks: [
          { code: 'KBANK', name: 'Kasikornbank' },
          { code: 'KTC', name: 'Krungthai Card' },
        ],
        patch: (p: Partial<Draft>) => {
          draft = { ...draft, ...p }
          rerender?.()
        },
        save,
        saveRules,
        reset: () => {
          draft = seedDraft(settings as never)
          rerender?.()
        },
        saveToken: vi.fn(),
        removeToken,
        reload: vi.fn(),
      }
    },
  }
})
vi.mock('@/shared/lib/toast', () => ({ showToast: vi.fn() }))

let rerender: (() => void) | null = null

function mount() {
  const view = render(
    <LanguageProvider>
      <EmailSettings />
    </LanguageProvider>
  )
  rerender = () =>
    view.rerender(
      <LanguageProvider>
        <EmailSettings />
      </LanguageProvider>
    )
  return view
}

/** The rules the last `saveRules` call sent. */
const sentRules = (): RuleDraft[] => {
  const calls = saveRules.mock.calls
  return calls.length ? calls[calls.length - 1][0] : []
}

/** A rule is a summary row; it is edited in the dialog the row opens. */
const openRule = (n: number) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Rule ${n}:`) }))
const dialog = () => within(screen.getByRole('dialog'))

beforeEach(() => {
  vi.clearAllMocks()
  tokenStatus = null
  tokenError = null
  fieldErrors = {}
  rules = []
  draft = seedDraft(null)
  rerender = null
})

/** Seed the draft the way a real load would, then mount. */
function mountWith(loaded: EmailRule[]) {
  rules = loaded
  draft = seedDraft({
    enabled: true,
    auto_post: false,
    owner_emails: ['acct@hotel.com'],
    tax_ids: ['0105536000123'],
    rules: loaded,
  } as never)
  return mount()
}

describe('bank rules', () => {
  it('switches AR reconciliation on for KBANK, and asks for its merchant', async () => {
    // The rule's document type is the only switch (decision #31) and this is its only
    // screen (#34). On KBANK it is a toggle that names the files itself (#37): no
    // patterns, and a merchant ID once it is on.
    mountWith([])
    fireEvent.click(screen.getByRole('button', { name: /Add rule/i }))

    const rule = dialog()
    const toggle = () =>
      rule.queryByRole('switch', { name: 'Detailed Credit Card AR Reconciliation' })
    expect(toggle()).not.toBeInTheDocument()
    expect(rule.getByLabelText(/^Filename patterns/i)).toBeInTheDocument()

    fireEvent.change(rule.getByLabelText(/^Bank$/i), { target: { value: 'KBANK' } })
    expect(rule.queryByLabelText(/^Filename patterns/i)).not.toBeInTheDocument()
    expect(rule.getByText('E-TAX_INVOICE_CARD')).toBeInTheDocument()
    // Off reads the commission tax invoice and needs nothing more.
    expect(rule.getByRole('button', { name: 'Add rule' })).toBeEnabled()

    fireEvent.click(toggle()!)
    expect(rule.getByRole('button', { name: 'Add rule' })).toBeDisabled()
    fireEvent.change(rule.getByLabelText(/^Merchant ID/i), {
      target: { value: '451005282039001' },
    })
    expect(rule.getByText('SUM_451005282039001')).toBeInTheDocument()
    fireEvent.click(rule.getByRole('button', { name: 'Add rule' }))

    // Saved by the dialog itself; the page's own Save is not involved.
    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(1))
    expect(save).not.toHaveBeenCalled()
    expect(sentRules()).toEqual([
      expect.objectContaining({
        bank_code: 'KBANK',
        doc_type: 'ar_reconcile',
        merchant_id: '451005282039001',
      }),
    ])
  })

  it('a bank other than KBANK cannot be left reconciling', async () => {
    mountWith([
      {
        bank_code: 'KBANK',
        bank_sender_email: null,
        filename_patterns: [],
        is_active: true,
        doc_type: 'ar_reconcile',
        merchant_id: '451005282039001',
      },
    ])
    openRule(1)
    const rule = dialog()
    fireEvent.change(rule.getByLabelText(/^Bank$/i), { target: { value: 'KTC' } })
    fireEvent.change(rule.getByLabelText(/^Filename patterns/i), { target: { value: 'MDR' } })
    fireEvent.click(rule.getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(1))
    expect(sentRules()).toEqual([
      expect.objectContaining({ bank_code: 'KTC', doc_type: 'fee_invoice' }),
    ])
  })

  it('editing one rule does not downgrade another rule’s document type', async () => {
    mountWith([
      {
        bank_code: 'KBANK',
        bank_sender_email: null,
        filename_patterns: ['KB1P554V2'],
        is_active: true,
        doc_type: 'ar_reconcile',
      },
      {
        bank_code: 'KTC',
        bank_sender_email: null,
        filename_patterns: ['.pdf'],
        is_active: true,
        doc_type: 'fee_invoice',
      },
    ])

    // Touch the KTC rule only.
    openRule(2)
    fireEvent.change(dialog().getByLabelText(/^Bank sender email/i), {
      target: { value: 'noreply@ktc.co.th' },
    })
    fireEvent.click(dialog().getByRole('button', { name: 'Save rule' }))

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    expect(sentRules()[0].doc_type).toBe('ar_reconcile')
    expect(sentRules()[1]).toEqual(
      expect.objectContaining({ doc_type: 'fee_invoice', bank_sender_email: 'noreply@ktc.co.th' })
    )
  })

  it('deleting a rule leaves the others’ document types alone', async () => {
    mountWith([
      {
        bank_code: 'KBANK',
        bank_sender_email: null,
        filename_patterns: ['KB1P554V2'],
        is_active: true,
        doc_type: 'ar_reconcile',
      },
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
    ])

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    openRule(2)
    fireEvent.click(dialog().getByRole('button', { name: /Remove rule/i }))

    await waitFor(() => expect(saveRules).toHaveBeenCalled())
    expect(sentRules()).toEqual([expect.objectContaining({ doc_type: 'ar_reconcile' })])
    confirm.mockRestore()
  })

  it('a rule stored before the field existed reads as the type it was', () => {
    mountWith([
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
    ])
    // Explicit rather than absent: on a full-replace payload the two only mean the same
    // thing because the server defaults, and leaving that to chance is what this is about.
    expect(draft.rules[0].doc_type).toBe('fee_invoice')
    openRule(1)
    // Only KBANK reconciles, so another bank's rule offers no switch at all.
    expect(dialog().queryByRole('switch', { name: /AR Reconciliation/i })).not.toBeInTheDocument()
  })

  it('switching a rule off in its row saves it at once', async () => {
    mountWith([
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
    ])
    fireEvent.click(screen.getByRole('switch', { name: 'Rule 1 active' }))

    await waitFor(() => expect(saveRules).toHaveBeenCalledTimes(1))
    expect(sentRules()[0].is_active).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })
})

describe('the dirty form', () => {
  it('saves nothing until Save is pressed', () => {
    mountWith([])
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^Company tax IDs/i), {
      target: { value: '0105536000123, 0105536000127' },
    })

    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeEnabled()
  })

  it('the two switches are reachable by name, and only edit the draft', () => {
    // Their captions sit on the far side of the card, so the control itself has to carry
    // the name — the review switch especially, being the one that lets a document post
    // unseen.
    mountWith([])
    fireEvent.click(screen.getByRole('switch', { name: /Post without review/i }))

    expect(draft.auto_post).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('switch', { name: /Process incoming documents/i })).toBeChecked()
  })

  it('Reset puts back what the server last confirmed', () => {
    mountWith([
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
    ])

    fireEvent.change(screen.getByLabelText(/^Company tax IDs/i), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('switch', { name: /Post without review/i }))

    fireEvent.click(screen.getByRole('button', { name: /Discard changes/i }))

    expect((screen.getByLabelText(/^Company tax IDs/i) as HTMLTextAreaElement).value).toBe(
      '0105536000123'
    )
    expect(draft.auto_post).toBe(false)
    expect(draft.rules).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeDisabled()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('a refused save', () => {
  it('flags the rule the server refused, and its dialog shows the message under the field', () => {
    // Rules are summary rows; a 422 about one of them must not stay invisible in the list.
    fieldErrors = { 'rules[1].filename_patterns': 'Add at least one filename pattern.' }
    mountWith([
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
      { bank_code: 'KBANK', bank_sender_email: null, filename_patterns: [], is_active: true },
    ])

    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    // Nothing pops open on its own; the reader opens the flagged rule.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    openRule(2)
    expect(dialog().getByText('Add at least one filename pattern.')).toBeInTheDocument()
  })

  it('keeps every explanation reachable behind its (i)', () => {
    // The page shows state and controls only; the help text moved, it did not go away.
    mountWith([])
    expect(
      screen.getByRole('button', { name: 'About company tax IDs' })
    ).toHaveAccessibleDescription(/13 digits each/)
  })
})

describe('the two exits that lose something', () => {
  it('asks before Back to queue drops an unsaved edit', () => {
    // The queue's fix buttons land here in the same tab, so this link is how a reviewer
    // goes home — and a hash change fires no beforeunload to catch an unsaved form.
    mountWith([])
    fireEvent.change(screen.getByLabelText(/^Company tax IDs/i), { target: { value: '999' } })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const followed = fireEvent.click(screen.getByRole('link', { name: /Back to queue/i }))

    expect(confirm).toHaveBeenCalled()
    expect(followed).toBe(false) // default prevented: still on this page
    confirm.mockRestore()
  })

  it('says at the top when the token Carmen sent could not be stored', () => {
    // Minting it killed the stored one, so the card's "Connected" would be a lie.
    tokenStatus = {
      configured: true,
      fingerprint: '9c1f3a2b',
      carmen_uri: 'https://hotel.carmenwork.com',
      verified_at: '2026-10-01T00:00:00Z',
    }
    tokenError = 'Carmen rejected this token'
    mountWith([])

    expect(screen.getByRole('alert')).toHaveTextContent(/Carmen rejected this token/)
    expect(screen.getByText('New token from Carmen not stored')).toBeInTheDocument()
    expect(screen.queryByText('Connected')).not.toBeInTheDocument()
  })
})
