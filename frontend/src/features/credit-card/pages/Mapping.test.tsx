import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import Mapping from './Mapping'

/**
 * The page as a whole: the hooks each have their own tests, and every defect found on
 * 2026-09-30 lived between them — in what the page did with a failed save, a bank switch,
 * a retry. Only the network and the portaled picker are stood in for.
 */

vi.mock('@/shared/api/config', () => ({
  getAccountingConfig: vi.fn(),
  saveAccountingConfig: vi.fn(),
}))
vi.mock('@/features/credit-card/api/arReconcile', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/credit-card/api/arReconcile')>()),
  getARSettings: vi.fn(),
  getSamplePaymentTypes: vi.fn(async () => []),
  previewARJv: vi.fn(async () => ({
    rows: [],
    description: '',
    doc_no: '',
    doc_date: '',
    total_debit: 0,
    total_credit: 0,
    balanced: true,
    unmapped: [],
    post_type: 'Detail',
  })),
  saveARSettings: vi.fn(async () => undefined),
}))
vi.mock('@/shared/api/carmen', () => ({
  fetchAccountCodes: vi.fn(async () => [
    { AccCode: '6080008', Description: 'Commission' },
    { AccCode: '6080009', Description: 'Commission (SCB)' },
  ]),
  fetchDepartments: vi.fn(async () => [
    { DeptCode: 'GEN', Description: 'General', DefaultAccount: '[]' },
  ]),
  fetchGLPrefixes: vi.fn(async () => [{ PrefixName: 'IC', Description: 'Invoice credit' }]),
}))
vi.mock('@/features/credit-card/api/mapping', () => ({
  suggestMapping: vi.fn(),
  suggestPaymentTypes: vi.fn(),
}))
vi.mock('@/shared/lib/toast', () => ({ showToast: vi.fn() }))

// The picker is portaled and search-driven; a plain select carries the same value, options
// and name, which is all this page puts on top of it.
vi.mock('@/shared/components/common/CustomSearchSelect', () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
    'aria-label': label,
  }: {
    value: string | null
    onChange: (v: string) => void
    options: { code: string }[]
    placeholder?: string
    'aria-label'?: string
  }) => (
    <select
      aria-label={label || placeholder}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      <option value="" />
      {options.map(o => (
        <option key={o.code} value={o.code}>
          {o.code}
        </option>
      ))}
    </select>
  ),
}))

const cfg = await import('@/shared/api/config')
const ar = await import('@/features/credit-card/api/arReconcile')

/** What `GET /config/accounting` answers. `bank_code` is the BU's saved bank whichever
 *  bank was asked for — the mappings are what the scope changes. */
function config(bank: string, commissionAcc: string) {
  return {
    bank_code: bank,
    file_prefix: 'IC',
    branch: '00000',
    mappings: { commission: { dept: 'GEN', acc: commissionAcc } },
    custom_types: [],
    bank_descriptions: {},
  }
}
const KTC = config('KTC', '6080008')
const SCB = config('KTC', '6080009')

const commissionAcc = () =>
  screen.getByLabelText('Account Code — Credit card commission') as HTMLSelectElement
const bankPicker = () => screen.getByLabelText('Bank')
const saveButton = () => screen.getByRole('button', { name: 'Save & Close' })
const toSCB = () =>
  fireEvent.change(bankPicker(), { target: { value: 'Siam Commercial Bank (SCB)' } })

async function mounted() {
  render(
    <LanguageProvider>
      <Mapping />
    </LanguageProvider>
  )
  await waitFor(() => expect(commissionAcc().value).toBe('6080008'))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  window.location.hash = '#/CreditCardOCR/mapping'
  vi.mocked(cfg.getAccountingConfig).mockImplementation(
    async bank => (bank === 'SCB' ? SCB : KTC) as never
  )
  vi.mocked(cfg.saveAccountingConfig).mockResolvedValue({} as never)
  vi.mocked(ar.getARSettings).mockImplementation(async code => ({
    bank_code: code,
    post_type: 'Detail',
    enabled: true,
    has_settlement_layout: code === 'KBANK',
  }))
})

describe('the mapping page — loading a bank', () => {
  it("opens on the BU's bank, with that bank's own accounts", async () => {
    await mounted()

    expect(bankPicker()).toHaveValue('Krungthai Card (KTC)')
  })

  it("keeps Save off, and the last bank's accounts off screen, until the next has loaded", async () => {
    await mounted()
    let land: (v: unknown) => void = () => {}
    vi.mocked(cfg.getAccountingConfig).mockImplementationOnce(
      () => new Promise(resolve => (land = resolve)) as never
    )

    toSCB()

    expect(await screen.findByText('Loading SCB mappings...')).toBeInTheDocument()
    expect(screen.queryByLabelText('Account Code — Credit card commission')).toBeNull()
    expect(saveButton()).toBeDisabled()

    await act(async () => land(SCB))
    await waitFor(() => expect(commissionAcc().value).toBe('6080009'))
    expect(saveButton()).toBeEnabled()
  })

  it('offers Try again when a bank fails to load, and Try again recovers', async () => {
    await mounted()
    vi.mocked(cfg.getAccountingConfig).mockRejectedValueOnce(new Error('offline'))

    toSCB()

    expect(await screen.findByText("Couldn't load SCB's mappings.")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(commissionAcc().value).toBe('6080009'))
  })
})

describe('the mapping page — saving', () => {
  it("saves a settlement bank's grouping after its rules", async () => {
    vi.mocked(cfg.getAccountingConfig).mockResolvedValue(config('KBANK', '6080008') as never)
    await mounted()
    await screen.findByRole('radiogroup') // the Detail / Summary switch

    fireEvent.click(saveButton())

    await waitFor(() =>
      expect(ar.saveARSettings).toHaveBeenCalledWith({ bank_code: 'KBANK', post_type: 'Detail' })
    )
    expect(cfg.saveAccountingConfig).toHaveBeenCalledWith(
      expect.objectContaining({ bank_code: 'KBANK', branch: '00000' })
    )
  })

  it('saves no grouping for a bank without a settlement report', async () => {
    await mounted()

    fireEvent.click(saveButton())

    await waitFor(() => expect(window.location.hash).toBe('#/CreditCardOCR'))
    expect(cfg.saveAccountingConfig).toHaveBeenCalledWith(
      expect.objectContaining({ bank_code: 'KTC' })
    )
    expect(ar.saveARSettings).not.toHaveBeenCalled()
  })

  it('stays on the page, and says so, when the save fails', async () => {
    vi.mocked(cfg.saveAccountingConfig).mockRejectedValue(new Error('Config save failed (500)'))
    await mounted()

    fireEvent.click(saveButton())

    expect(await screen.findByText('Account mapping not saved')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/CreditCardOCR/mapping')
    expect(ar.saveARSettings).not.toHaveBeenCalled()
  })

  it("shows the bank's registered identity read-only, and Branch No for editing", async () => {
    await mounted()

    expect(screen.getByLabelText('Company Name')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Tax ID')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Address')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Branch No')).not.toHaveAttribute('readonly')
  })

  it('says where it is typed that a branch must be five digits', async () => {
    await mounted()

    fireEvent.change(screen.getByLabelText('Branch No'), { target: { value: '0000' } })

    expect(
      screen.getByText('Branch No must be 5 digits — 00000 for the head office')
    ).toBeInTheDocument()
  })
})

describe('the mapping page — someone else saved first', () => {
  it('asks, and Reload latest brings in what they saved', async () => {
    vi.mocked(cfg.saveAccountingConfig).mockRejectedValueOnce(
      Object.assign(new Error('changed'), { status: 409 })
    )
    await mounted()
    fireEvent.change(commissionAcc(), { target: { value: '6080009' } })
    fireEvent.click(saveButton())

    const ask = await screen.findByRole('dialog')
    expect(within(ask).getByText(/changed after you opened it/i)).toBeInTheDocument()
    expect(window.location.hash).toBe('#/CreditCardOCR/mapping')

    vi.mocked(cfg.getAccountingConfig).mockResolvedValue(
      config('KTC', '6080008') as never // what the other person left
    )
    fireEvent.click(within(ask).getByRole('button', { name: 'Reload latest' }))

    await waitFor(() => expect(commissionAcc().value).toBe('6080008'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Keep editing leaves the form as it was', async () => {
    vi.mocked(cfg.saveAccountingConfig).mockRejectedValueOnce(
      Object.assign(new Error('changed'), { status: 409 })
    )
    await mounted()
    fireEvent.change(commissionAcc(), { target: { value: '6080009' } })
    fireEvent.click(saveButton())

    fireEvent.click(await screen.findByRole('button', { name: 'Keep editing' }))

    expect(commissionAcc().value).toBe('6080009')
  })
})

describe('the mapping page — unsaved changes', () => {
  it('asks before a bank switch throws them away', async () => {
    await mounted()
    fireEvent.change(commissionAcc(), { target: { value: '6080009' } })

    toSCB()
    const ask = await screen.findByRole('dialog')
    expect(within(ask).getByText(/Discard unsaved changes to KTC/)).toBeInTheDocument()

    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    expect(bankPicker()).toHaveValue('Krungthai Card (KTC)')
    expect(commissionAcc().value).toBe('6080009')
    expect(cfg.getAccountingConfig).not.toHaveBeenCalledWith('SCB')

    toSCB()
    fireEvent.click(await screen.findByRole('button', { name: 'Discard and switch' }))
    await waitFor(() => expect(cfg.getAccountingConfig).toHaveBeenCalledWith('SCB'))
    expect(bankPicker()).toHaveValue('Siam Commercial Bank (SCB)')
  })

  it('switches straight away when nothing is unsaved', async () => {
    await mounted()

    toSCB()

    await waitFor(() => expect(cfg.getAccountingConfig).toHaveBeenCalledWith('SCB'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('arms the browser\'s "leave page?" only while something is unsaved', async () => {
    await mounted()
    const leave = () => {
      const e = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(e)
      return e.defaultPrevented
    }

    expect(leave()).toBe(false)
    fireEvent.change(screen.getByLabelText('Branch No'), { target: { value: '00001' } })
    expect(leave()).toBe(true)
  })
})
