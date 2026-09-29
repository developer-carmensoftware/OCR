import type { ComponentProps } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import PaymentTypeModal from './PaymentTypeModal'
import type {
  MasterAccount,
  MasterDepartment,
} from '@/features/credit-card/hooks/mapping/useMappingData'

/**
 * The modal's first tests, written when its two hand-copied row blocks were replaced by
 * the shared `MappingRow`. It maps payment types onto GL accounts for a JV that posts to
 * real books and had no coverage at all, so the refactor was otherwise unverifiable.
 *
 * These pin what the row *is* — badge state, remove affordance, suggestion buttons — and
 * the one rule that stops a save: an account the department does not permit.
 */

const ACCOUNTS: MasterAccount[] = [
  { code: '1130V', name: 'AR Visa' },
  { code: '1130M', name: 'AR MasterCard' },
]

const DEPARTMENTS: MasterDepartment[] = [
  { code: 'GEN', name: 'General' },
  // Restricts to one account, which is what makes an illegal pair possible.
  { code: 'FIN', name: 'Finance', allowedAccounts: ['1130V'] },
]

type ModalProps = ComponentProps<typeof PaymentTypeModal>

function props(over: Partial<ModalProps> = {}): ModalProps {
  return {
    isAmountModalOpen: true,
    // commission/tax/net are the fixed rows the *other* table owns; this modal reads
    // paymentTypes only.
    activeScan: {
      paymentTypes: new Set(['Visa', 'Master']),
      commission: true,
      tax: true,
      net: true,
    },
    amountMappedCount: 1,
    allPaymentTypes: ['Visa', 'Master', 'JCB', 'MYCUSTOM'],
    paymentSuggestions: {},
    paymentSuggestLoading: false,
    autoSuggestPaymentTypes: vi.fn(),
    masterAccounts: ACCOUNTS,
    masterDepartments: DEPARTMENTS,
    loadingOpts: false,
    paymentAmount: {
      Visa: { dept: 'GEN', acc: '1130V' },
      Master: { dept: '', acc: '' },
    },
    handlePaymentMappingChange: vi.fn(),
    confirmPaymentSuggestion: vi.fn(),
    rejectPaymentSuggestion: vi.fn(),
    customPaymentTypes: ['MYCUSTOM'],
    handleRemoveCustomType: vi.fn(),
    saveAmountSelection: vi.fn(),
    cancelAmountSelection: vi.fn(),
    setAcceptAllModal: vi.fn(),
    ...over,
  }
}

function renderModal(over: Partial<ModalProps> = {}) {
  const p = props(over)
  render(
    <LanguageProvider>
      <PaymentTypeModal {...p} />
    </LanguageProvider>
  )
  return p
}

function row(type: string) {
  const el = document.querySelector(`[data-pt="${type}"]`)
  if (!el) throw new Error(`no row for ${type}`)
  return el
}

beforeEach(() => {
  vi.clearAllMocks()
  // The illegal-pair path scrolls the offending row into view and asks the browser
  // whether motion is reduced. jsdom has no matchMedia, and the call lands in a
  // requestAnimationFrame callback where the rejection is invisible.
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})

describe('PaymentTypeModal', () => {
  it('marks a payment type from this scan that is still unmapped', () => {
    renderModal()

    // Mapped and unmapped rows have to be told apart at a glance — that is the whole
    // reason this modal opens with a red "Required for this scan" count.
    expect(row('Visa').className).toContain('pm-row--required-ok')
    expect(row('Master').className).toContain('pm-row--required-pending')
    expect(screen.getByText(/Required for this scan: 2 items/)).toBeInTheDocument()
  })

  it('keeps types not on this scan behind the accordion', () => {
    renderModal()

    expect(document.querySelector('[data-pt="JCB"]')).toBeNull()
    fireEvent.click(screen.getByText(/Show additional mappings/))
    expect(row('JCB').className).toContain('pm-row--custom')
  })

  it('offers Remove only for a type the BU typed itself', () => {
    const p = renderModal()
    fireEvent.click(screen.getByText(/Show additional mappings/))

    // JCB came from a document; MYCUSTOM was added by hand and is the only one that can
    // be taken away again.
    expect(row('JCB').querySelector('.pm-remove-btn')).toBeNull()
    const remove = row('MYCUSTOM').querySelector('.pm-remove-btn')
    expect(remove).not.toBeNull()

    fireEvent.click(remove as Element)
    expect(p.handleRemoveCustomType).toHaveBeenCalledWith('MYCUSTOM')
  })

  it('shows accept and reject only where the AI actually proposed something', () => {
    const p = renderModal({
      paymentSuggestions: { Master: { dept: 'GEN', acc: '1130M', source: 'ai' } },
    })

    expect(row('Visa').querySelector('.pm-accept-btn')).toBeNull()
    fireEvent.click(row('Master').querySelector('.pm-accept-btn') as Element)
    expect(p.confirmPaymentSuggestion).toHaveBeenCalledWith('Master')

    fireEvent.click(row('Master').querySelector('.pm-reject-btn') as Element)
    expect(p.rejectPaymentSuggestion).toHaveBeenCalledWith('Master')
  })

  it('refuses to save an account the department does not permit, and says which row', () => {
    const p = renderModal({
      paymentAmount: {
        // FIN allows 1130V only.
        Visa: { dept: 'FIN', acc: '1130M' },
        Master: { dept: 'GEN', acc: '1130M' },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(p.saveAmountSelection).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Account not allowed for department')
    expect(screen.getByRole('alert')).toHaveTextContent('Visa')
  })

  it('saves when every pair is legal', () => {
    const p = renderModal({
      paymentAmount: {
        Visa: { dept: 'FIN', acc: '1130V' },
        Master: { dept: 'GEN', acc: '1130M' },
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(p.saveAmountSelection).toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders nothing when closed', () => {
    renderModal({ isAmountModalOpen: false })
    expect(document.querySelector('.pm-dialog')).toBeNull()
  })
})

// A settlement-capable bank's own payment types (VS/MC/JCB and friends) fold into this
// same modal (decision, 2026-09-22) rather than a second "map a payment type to
// dept/account" surface on the page. `settlement` is omitted entirely for every other
// bank — the tests above already prove that path is untouched.
describe('PaymentTypeModal — settlement section', () => {
  function settlementProps(over: Partial<NonNullable<ModalProps['settlement']>> = {}) {
    return {
      postTypeLabel: 'Detail',
      rows: [
        { code: 'VS', mapping: { dept: 'GEN', acc: '1021004' } },
        { code: 'MC', mapping: { dept: '', acc: '' } },
      ],
      setRowMapping: vi.fn(),
      addCustomType: vi.fn(),
      removeType: vi.fn(),
      suggestions: {},
      suggestLoading: false,
      runSuggest: vi.fn(),
      acceptSuggestion: vi.fn(),
      rejectSuggestion: vi.fn(),
      ...over,
    }
  }

  it('is absent for a bank with no settlement layout', () => {
    renderModal({ settlement: undefined })
    expect(document.querySelector('[data-pt="VS"]')).toBeNull()
  })

  it("renders the active post type's rows alongside the fee-invoice ones", () => {
    renderModal({ settlement: settlementProps() })

    expect(row('VS').className).toContain('pm-row--required-ok')
    expect(row('MC').className).toContain('pm-row--required-pending')
    expect(screen.getByText('2 in Detail')).toBeInTheDocument()
  })

  it('accepts a settlement suggestion through the settlement callback, not the fee-invoice one', () => {
    const settlement = settlementProps({
      suggestions: { MC: { dept: 'GEN', acc: '1021005', source: 'ai' } },
    })
    const p = renderModal({ settlement })

    fireEvent.click(row('MC').querySelector('.pm-accept-btn') as Element)

    expect(settlement.acceptSuggestion).toHaveBeenCalledWith('MC')
    expect(p.confirmPaymentSuggestion).not.toHaveBeenCalled()
  })

  it('removes a settlement type via its own remove button', () => {
    const settlement = settlementProps()
    renderModal({ settlement })

    fireEvent.click(row('VS').querySelector('.pm-remove-btn') as Element)
    expect(settlement.removeType).toHaveBeenCalledWith('VS')
  })

  it('adds a settlement type from its own add-row input and clears it after', () => {
    const settlement = settlementProps()
    renderModal({ settlement })

    const input = screen.getByPlaceholderText(/Add a payment type/i)
    fireEvent.change(input, { target: { value: 'JCB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add type' }))

    expect(settlement.addCustomType).toHaveBeenCalledWith('JCB')
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('runs the settlement suggestion engine independently of the fee-invoice one', () => {
    const settlement = settlementProps()
    const p = renderModal({ settlement })

    const suggestButtons = screen.getAllByText('AI Suggest')
    fireEvent.click(suggestButtons[1])

    expect(settlement.runSuggest).toHaveBeenCalled()
    expect(p.autoSuggestPaymentTypes).not.toHaveBeenCalled()
  })
})
