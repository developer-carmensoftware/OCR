import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import QueueRow from './QueueRow'
import type { InputTaxPreview, ReviewDocument } from '@/features/credit-card/api/emailReview'

vi.mock('@/features/credit-card/api/emailReview', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/credit-card/api/emailReview')>()),
  recordInputTax: vi.fn(),
  markInputTaxKeyed: vi.fn(),
  inputTaxPreview: vi.fn(),
}))
vi.mock('@/shared/api/carmen', async importOriginal => ({
  ...(await importOriginal<typeof import('@/shared/api/carmen')>()),
  fetchTaxProfiles: vi.fn().mockResolvedValue([{ code: 'VAT07', desc: 'VAT 7%', rate: 7 }]),
}))

const api = await import('@/features/credit-card/api/emailReview')

/** A manual scan whose JV posted and whose step 4 never happened. */
function owed(over: Partial<ReviewDocument> = {}): ReviewDocument {
  return {
    id: 'card-1',
    source: 'manual',
    created_at: '2026-09-15T02:00:00Z',
    attachment: 'sept.pdf',
    bank_code: 'KBANK',
    doc_no: 'STMT-0915',
    status: 'posted',
    doc_date: null,
    total: 0,
    line_count: 0,
    flags: [],
    unmapped: [],
    guessed: [],
    jv_no: 'JV-0042',
    reason_code: null,
    error_message: null,
    reviewed_by_name: null,
    reviewed_at: null,
    posted_by_name: null,
    input_tax_owed: true,
    card_id: 'card-1',
    ...over,
  } as ReviewDocument
}

/** What the server answers for it: the sums stamped with the JV, the bank's registry
 *  identity, and a claim window of September and October. */
function preview(over: Partial<InputTaxPreview> = {}): InputTaxPreview {
  return {
    owed: true,
    doc_no: 'STMT-0915',
    doc_date: '15/09/2026',
    bank_code: 'KBANK',
    branch_no: '00009',
    commis_amt: 1000,
    tax_amt: 70,
    vendor_name: 'KASIKORNBANK PCL',
    tax_id: '0107536000315',
    periods: ['2026-09', '2026-10'],
    expired: false,
    ...over,
  }
}

function mount(row: ReviewDocument, onChanged = vi.fn()) {
  render(
    <LanguageProvider>
      <table>
        <tbody>
          <QueueRow row={row} onOpen={vi.fn()} onChanged={onChanged} />
        </tbody>
      </table>
    </LanguageProvider>
  )
  return onChanged
}

async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Record input tax' }))
  return screen.findByRole('dialog')
}

describe('QueueRow — input tax still owed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.inputTaxPreview).mockResolvedValue(preview())
  })

  it('says so, and offers to record it instead of opening the JV', () => {
    mount(owed())
    expect(screen.getByText(/input tax not recorded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record input tax' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open JV/ })).not.toBeInTheDocument()
  })

  it('shows the record with the amounts posted on the JV, which nobody can type into', async () => {
    mount(owed())
    const dialog = await openDialog()
    expect(within(dialog).getByText('1,000.00')).toBeInTheDocument()
    expect(within(dialog).getByText('70.00')).toBeInTheDocument()
    expect(within(dialog).getByText('1,070.00')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('KASIKORNBANK PCL')).toBeInTheDocument()
  })

  it('files it only after the confirm, with what the dialog holds, then refreshes', async () => {
    vi.mocked(api.recordInputTax).mockResolvedValue()
    const onChanged = mount(owed())

    const dialog = await openDialog()
    expect(api.recordInputTax).not.toHaveBeenCalled()
    fireEvent.change(within(dialog).getByLabelText('Branch'), { target: { value: '00012' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record input tax' }))

    await waitFor(() =>
      expect(api.recordInputTax).toHaveBeenCalledWith('card-1', {
        vendor_name: 'KASIKORNBANK PCL',
        tax_id: '0107536000315',
        branch_no: '00012',
        period: '2026-09',
      })
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('files a later month of the claim window when one is picked', async () => {
    vi.mocked(api.recordInputTax).mockResolvedValue()
    mount(owed())

    const dialog = await openDialog()
    fireEvent.click(within(dialog).getByLabelText('Tax period'))
    fireEvent.mouseDown(await screen.findByText('10/2026'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record input tax' }))

    await waitFor(() =>
      expect(vi.mocked(api.recordInputTax).mock.calls[0][1]).toMatchObject({ period: '2026-10' })
    )
  })

  it('an email row files against its card, not its ledger row', async () => {
    vi.mocked(api.recordInputTax).mockResolvedValue()
    mount(owed({ id: 'ledger-7', source: 'email', card_id: 'card-9' }))

    const dialog = await openDialog()
    expect(api.inputTaxPreview).toHaveBeenCalledWith('card-9')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record input tax' }))
    await waitFor(() => expect(vi.mocked(api.recordInputTax).mock.calls[0][0]).toBe('card-9'))
  })

  it('past the claim window it can only be marked keyed in Carmen', async () => {
    vi.mocked(api.inputTaxPreview).mockResolvedValue(preview({ periods: [], expired: true }))
    vi.mocked(api.markInputTaxKeyed).mockResolvedValue()
    const onChanged = mount(owed())

    const dialog = await openDialog()
    expect(within(dialog).getByText(/Past the 6-month input-tax claim window/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Record input tax' })).toBeDisabled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keyed in Carmen already' }))
    await waitFor(() => expect(api.markInputTaxKeyed).toHaveBeenCalledWith('card-1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(api.recordInputTax).not.toHaveBeenCalled()
  })

  it('a bank with no registered identity cannot be filed until someone supplies one', async () => {
    vi.mocked(api.inputTaxPreview).mockResolvedValue(preview({ vendor_name: null, tax_id: null }))
    mount(owed())

    const dialog = await openDialog()
    const record = within(dialog).getByRole('button', { name: 'Record input tax' })
    await waitFor(() => expect(record).toBeDisabled())

    fireEvent.change(within(dialog).getByLabelText('Vendor'), { target: { value: 'KBank' } })
    fireEvent.change(within(dialog).getByLabelText('Tax ID'), {
      target: { value: '0107536000315' },
    })
    await waitFor(() => expect(record).toBeEnabled())
  })

  it('one settled elsewhere since the table loaded opens nothing and refreshes', async () => {
    vi.mocked(api.inputTaxPreview).mockResolvedValue({ owed: false })
    const onChanged = mount(owed())

    fireEvent.click(screen.getByRole('button', { name: 'Record input tax' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says why once: the server reason when there is one, else the plain fact', () => {
    const reason = 'Input tax not recorded: bank KBANK has no registered tax ID on file'
    mount(owed({ source: 'email', error_message: reason }))
    expect(screen.getByText(new RegExp(reason))).toBeInTheDocument()
    expect(screen.queryByText(/· input tax not recorded$/)).not.toBeInTheDocument()
  })

  it('a row that owes nothing keeps its JV link', () => {
    mount(owed({ input_tax_owed: false }))
    expect(screen.queryByRole('button', { name: 'Record input tax' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open JV/ })).toBeInTheDocument()
  })
})

describe('QueueRow — a PMS day Carmen had already posted', () => {
  it('names the reviewer without claiming the post', () => {
    mount(
      owed({
        source: 'pms',
        jv_no: null,
        input_tax_owed: false,
        reason_code: 'already_posted',
        reviewed_by_name: 'Noi',
      } as Partial<ReviewDocument>)
    )
    expect(screen.getByText('Reviewed by Noi · Carmen had already posted it')).toBeInTheDocument()
    expect(screen.queryByText(/posted by/)).not.toBeInTheDocument()
  })
})
