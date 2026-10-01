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
const removeToken = vi.fn()
let tokenStatus: unknown = null
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
        banks: [
          { code: 'KBANK', name: 'Kasikornbank' },
          { code: 'KTC', name: 'Krungthai Card' },
        ],
        patch: (p: Partial<Draft>) => {
          draft = { ...draft, ...p }
          rerender?.()
        },
        save,
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

/** The rules the form would send. `save()` reads the draft, so this is what it sees. */
const sentRules = (): RuleDraft[] => draft.rules

/** A rule is a summary row until opened; its fields live in the editor that opens under it. */
const openRule = (n: number) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Rule ${n}:`) }))
const ruleCard = (n: number) => within(screen.getByRole('group', { name: `Rule ${n}` }))

beforeEach(() => {
  vi.clearAllMocks()
  tokenStatus = null
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
  it('can tag a rule as a settlement report', async () => {
    // Otherwise there is no way to switch AR reconciliation on at all: the rule's document
    // type is the only switch (decision #31), and this is its only screen (#34).
    mountWith([])
    fireEvent.click(screen.getByRole('button', { name: /ADD RULE/i }))

    const rule = ruleCard(1)
    fireEvent.change(rule.getByLabelText(/Document type/i), { target: { value: 'ar_reconcile' } })
    fireEvent.change(rule.getByLabelText(/^Bank$/i), { target: { value: 'KBANK' } })
    fireEvent.change(rule.getByLabelText(/Filename patterns/i), { target: { value: 'KB1P554V2' } })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(sentRules()).toEqual([
      expect.objectContaining({
        bank_code: 'KBANK',
        doc_type: 'ar_reconcile',
        filename_patterns: 'KB1P554V2',
      }),
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
    fireEvent.change(ruleCard(2).getByLabelText(/Bank sender email/i), {
      target: { value: 'noreply@ktc.co.th' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(sentRules()[0].doc_type).toBe('ar_reconcile')
    expect(sentRules()[1].doc_type).toBe('fee_invoice')
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

    openRule(2)
    fireEvent.click(screen.getByRole('button', { name: /Remove rule 2/i }))
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(sentRules()).toEqual([expect.objectContaining({ doc_type: 'ar_reconcile' })])
  })

  it('a rule stored before the field existed reads as the type it was', () => {
    mountWith([
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
    ])
    // Explicit rather than absent: on a full-replace payload the two only mean the same
    // thing because the server defaults, and leaving that to chance is what this is about.
    expect(sentRules()[0].doc_type).toBe('fee_invoice')
    openRule(1)
    expect((ruleCard(1).getByLabelText(/Document type/i) as HTMLSelectElement).value).toBe(
      'fee_invoice'
    )
  })
})

describe('the dirty form', () => {
  it('saves nothing until Save is pressed', () => {
    mountWith([])
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Company Tax IDs/i), {
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

    fireEvent.change(screen.getByLabelText(/Company Tax IDs/i), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /ADD RULE/i }))
    expect(sentRules()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: /Discard changes/i }))

    expect((screen.getByLabelText(/Company Tax IDs/i) as HTMLTextAreaElement).value).toBe(
      '0105536000123'
    )
    expect(sentRules()).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Save changes/i })).toBeDisabled()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('a refused save', () => {
  it('opens the rule the server refused, with its message under the field', () => {
    // Rules are collapsed summary rows; a 422 about one of them must not stay hidden in a
    // closed row while the save bar says nothing was saved.
    fieldErrors = { 'rules[1].filename_patterns': 'Add at least one filename pattern.' }
    mountWith([
      { bank_code: 'KTC', bank_sender_email: null, filename_patterns: ['.pdf'], is_active: true },
      { bank_code: 'KBANK', bank_sender_email: null, filename_patterns: [], is_active: true },
    ])

    expect(ruleCard(2).getByText('Add at least one filename pattern.')).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    // The rule nothing was said about stays closed.
    expect(screen.queryByRole('group', { name: 'Rule 1' })).not.toBeInTheDocument()
  })
})

describe('the two exits that lose something', () => {
  it('asks before Back to queue drops an unsaved edit', () => {
    // The queue's fix buttons land here in the same tab, so this link is how a reviewer
    // goes home — and a hash change fires no beforeunload to catch an unsaved form.
    mountWith([])
    fireEvent.change(screen.getByLabelText(/Company Tax IDs/i), { target: { value: '999' } })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const followed = fireEvent.click(screen.getByRole('link', { name: /Back to queue/i }))

    expect(confirm).toHaveBeenCalled()
    expect(followed).toBe(false) // default prevented: still on this page
    confirm.mockRestore()
  })

  it('asks before deleting the stored posting token', () => {
    // Our copy is what every JV of this BU posts with; deleting it stops them all.
    tokenStatus = {
      configured: true,
      fingerprint: '9c1f3a2b',
      carmen_uri: 'https://hotel.carmenwork.com',
      verified_at: '2026-10-01T00:00:00Z',
    }
    mountWith([])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    fireEvent.click(screen.getByText('Set a token manually'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(confirm).toHaveBeenCalled()
    expect(removeToken).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
})
