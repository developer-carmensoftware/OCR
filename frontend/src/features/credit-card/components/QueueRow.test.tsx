import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import QueueRow from './QueueRow'
import type { ReviewDocument } from '@/features/credit-card/api/emailReview'

vi.mock('@/features/credit-card/api/emailReview', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/credit-card/api/emailReview')>()),
  recordInputTax: vi.fn(),
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
    ...over,
  } as ReviewDocument
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

describe('QueueRow — input tax still owed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('says so, and offers to record it instead of opening the JV', () => {
    mount(owed())
    expect(screen.getByText(/input tax not recorded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record input tax' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open JV/ })).not.toBeInTheDocument()
  })

  it('files it only after the confirm, then refreshes the table', async () => {
    vi.mocked(api.recordInputTax).mockResolvedValue()
    const onChanged = mount(owed())

    fireEvent.click(screen.getByRole('button', { name: 'Record input tax' }))
    expect(api.recordInputTax).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record input tax' }))

    await waitFor(() => expect(api.recordInputTax).toHaveBeenCalledWith('card-1'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('a row that owes nothing keeps its JV link', () => {
    mount(owed({ input_tax_owed: false }))
    expect(screen.queryByRole('button', { name: 'Record input tax' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open JV/ })).toBeInTheDocument()
  })
})
