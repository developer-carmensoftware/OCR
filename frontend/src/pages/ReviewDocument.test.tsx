import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import ReviewDocument from './ReviewDocument'
import type { ReviewDocumentDetail } from '../lib/api/emailReview'

vi.mock('../lib/api/emailReview', () => ({
  getPending: vi.fn(),
  approveDocument: vi.fn(),
  rejectDocument: vi.fn(),
}))
vi.mock('../lib/api/config', () => ({ patchAccountingMappings: vi.fn() }))
vi.mock('../lib/api/mapping', () => ({ suggestPaymentTypes: vi.fn() }))
vi.mock('../lib/api/carmen', () => ({
  fetchAccountCodes: vi.fn(async () => [
    { AccCode: '510300', Description: 'Bank charge' },
    { AccCode: '511200', Description: 'Input tax' },
    { AccCode: '511300', Description: 'Input tax (alt)' },
    { AccCode: '110200', Description: 'Bank - KBANK' },
    { AccCode: '110300', Description: 'Settlement receivable' },
  ]),
  fetchDepartments: vi.fn(async () => [
    // OPS restricts to three accounts; GEN restricts nothing.
    {
      DeptCode: 'OPS',
      Description: 'Operations',
      // 110300 is deliberately absent: it is the pair OPS forbids.
      DefaultAccount: JSON.stringify([
        { AccCode: '510300' },
        { AccCode: '511200' },
        { AccCode: '511300' },
        { AccCode: '110200' },
      ]),
    },
    { DeptCode: 'GEN', Description: 'General', DefaultAccount: '[]' },
  ]),
}))

// The BU's stored rules. Every payment type is mapped, which is the state a parked
// document actually arrives in — ingest fills and saves before it parks.
let storedConfig: Record<string, unknown> | null = null
vi.mock('../hooks/credit-card', () => ({
  useAccountingConfig: () => ({ config: storedConfig, loading: false }),
}))

// The picker is portaled and search-driven; its internals are not what this screen adds.
// Standing in for it with a plain select keeps the real JvEditor under test — the shared
// rule, the recompute, the undo — and still exposes the option list it was handed.
vi.mock('../components/common/CustomSearchSelect', () => ({
  default: ({
    value,
    onChange,
    options,
    'aria-label': label,
  }: {
    value: string | null
    onChange: (v: string) => void
    options: { code: string }[]
    'aria-label'?: string
  }) => (
    <select
      aria-label={label}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      data-options={options.map(o => o.code).join(',')}
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

const api = await import('../lib/api/emailReview')
const cfgApi = await import('../lib/api/config')

const LINE = {
  transaction: 'Visa',
  pay_amt: '1000.00',
  commis_amt: '30.00',
  tax_amt: '2.10',
  total: '967.90',
}

const EXTRACTED = {
  id: 'card-1',
  bank_name: 'KTC',
  doc_no: 'INV-001',
  doc_date: '15/01/2026',
  company_name: 'Test Hotel',
  branch_no: '00000',
  warnings: [],
  details: [LINE],
}

/** A line whose columns do not reconcile: gross ≠ commission + tax + net. */
const BENT = { ...EXTRACTED, details: [{ ...LINE, total: '900.00' }] }

/** Two lines of the SAME payment type — the case that proves a picker edits a rule. */
const TWO_VISA = {
  ...EXTRACTED,
  details: [
    LINE,
    {
      transaction: 'Visa',
      pay_amt: '500.00',
      commis_amt: '15.00',
      tax_amt: '1.05',
      total: '483.95',
    },
  ],
}

function detail(over: Partial<ReviewDocumentDetail> = {}): ReviewDocumentDetail {
  return {
    id: 'd1',
    source: 'email',
    created_at: null,
    attachment: 'july.pdf',
    status: 'pending_review',
    bank_code: 'KTC',
    doc_no: 'INV-001',
    doc_date: '15/01/2026',
    total: 1000,
    line_count: 1,
    flags: [],
    unmapped: [],
    guessed: [],
    jv_no: null,
    reason_code: null,
    error_message: null,
    reviewed_by_name: null,
    reviewed_at: null,
    extracted: EXTRACTED,
    ...over,
  }
}

async function clickApprove() {
  const btn = await screen.findByRole('button', { name: /Approve/ })
  await waitFor(() => expect(btn).toBeEnabled())
  fireEvent.click(btn)
}

const onClose = vi.fn()
const onDone = vi.fn()

function mount() {
  return render(
    <LanguageProvider>
      <ReviewDocument id="d1" onClose={onClose} onDone={onDone} />
    </LanguageProvider>
  )
}

const mapApi = await import('../lib/api/mapping')

beforeEach(() => {
  vi.clearAllMocks()
  // JvEditor asks for a suggestion whenever a payment type has no account. Most tests
  // never reach that branch, but an unresolved mock throws inside the effect.
  vi.mocked(mapApi.suggestPaymentTypes).mockResolvedValue({})
  storedConfig = {
    filePrefix: 'JV',
    mappings: {
      commission: { dept: 'OPS', acc: '510300' },
      tax: { dept: 'OPS', acc: '511200' },
      net: { dept: 'OPS', acc: '110200' },
    },
    paymentAmount: { Visa: { dept: 'GEN', acc: '110300' } },
  }
})

describe('the two panes', () => {
  it('shows the document and the JV it produces at the same time', async () => {
    // The whole reason for the layout: the comparison is the reviewer's only question,
    // and it cannot be made one pane at a time.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    expect(await screen.findByDisplayValue('INV-001')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1,000.00')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What the document says' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What will post' })).toBeInTheDocument()
  })

  it('puts the four decisive numbers above both panes', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    for (const label of ['Gross', 'Commission', 'VAT', 'Net']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('marks the line that does not reconcile, not a header above the table', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: BENT }))
    mount()
    await screen.findByDisplayValue('INV-001')
    // Portaled to body, so RTL's `container` never sees it.
    expect(document.querySelector('.detail-row--bad')).toBeInTheDocument()
  })
})

describe('mapping in place', () => {
  it('offers a picker per JV row so nobody has to leave for the mapping page', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    expect(await screen.findByLabelText('Account for Visa')).toBeInTheDocument()
    expect(screen.getByLabelText('Account for Credit card commission')).toBeInTheDocument()
    expect(screen.getByLabelText('Department for Input Tax')).toBeInTheDocument()
  })

  it('marks only the rules the AI actually invented', async () => {
    // `flags: ['mapping_guessed']` says one rule was guessed, not which. Marking every
    // rule off that flag says the same thing as marking none — the badge exists to point
    // somewhere, and the payload records where.
    vi.mocked(api.getPending).mockResolvedValue(
      detail({ flags: ['mapping_guessed'], guessed: ['tax'] })
    )
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getAllByText('AI')).toHaveLength(1)
  })

  it('limits the account list to what the department allows', async () => {
    // Carmen's DefaultAccount is the rule; offering a pair Carmen forbids just moves the
    // refusal to the post, where it is slower and worse explained.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    const acc = await screen.findByLabelText('Account for Credit card commission')
    expect(acc.getAttribute('data-options')).toBe('510300,511200,511300,110200')
  })

  it('drops an account the newly chosen department forbids', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    // Visa is stored under GEN as 110300, which OPS does not permit.
    const dept = await screen.findByLabelText('Department for Visa')
    fireEvent.change(dept, { target: { value: 'OPS' } })
    await waitFor(() =>
      expect((screen.getByLabelText('Account for Visa') as HTMLSelectElement).value).toBe('')
    )
  })

  it('changes every row that shares the rule, because that is what will be saved', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: TWO_VISA }))
    mount()
    const acc = await screen.findByLabelText('Account for Visa')
    fireEvent.change(acc, { target: { value: '511300' } })
    // One picker, two rows: the second echoes the value rather than asking again.
    await waitFor(() => expect(screen.getAllByText('511300').length).toBeGreaterThan(1))
  })

  it('says the rule will change before the button that changes it', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    fireEvent.change(await screen.findByLabelText('Account for Input Tax'), {
      target: { value: '511300' },
    })
    expect(await screen.findByText('1 GL rule changes when you approve')).toBeInTheDocument()
  })

  it('undoes a correction and stops promising to save it', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    fireEvent.change(await screen.findByLabelText('Account for Input Tax'), {
      target: { value: '511300' },
    })
    fireEvent.click(await screen.findByRole('button', { name: /Undo/ }))
    await waitFor(() =>
      expect(screen.queryByText('1 GL rule changes when you approve')).not.toBeInTheDocument()
    )
  })
})

describe('approving', () => {
  it('saves the corrected rule before posting, never after', async () => {
    // The other order can leave a rule silently unsaved behind a JV that already posted.
    // This one leaves a corrected rule standing even if Carmen refuses, which is right on
    // its own terms — the rule was wrong before and is right now.
    const order: string[] = []
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(cfgApi.patchAccountingMappings).mockImplementation(async () => {
      order.push('rules')
    })
    vi.mocked(api.approveDocument).mockImplementation(async () => {
      order.push('post')
      return { jv_no: 'JV-1', tax_note: null }
    })
    mount()
    fireEvent.change(await screen.findByLabelText('Account for Input Tax'), {
      target: { value: '511300' },
    })
    await clickApprove()

    await waitFor(() => expect(order).toEqual(['rules', 'post']))
    expect(cfgApi.patchAccountingMappings).toHaveBeenCalledWith({
      tax: { dept: 'OPS', acc: '511300' },
    })
  })

  it('touches no rules when nothing was corrected', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    await clickApprove()
    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    expect(cfgApi.patchAccountingMappings).not.toHaveBeenCalled()
  })

  it('posts nothing when the rule could not be saved', async () => {
    // A JV built on a rule the server rejected would put the wrong account into the books
    // and leave no record of why.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(cfgApi.patchAccountingMappings).mockRejectedValue(
      new Error('Account 511300 is not allowed for department OPS')
    )
    mount()
    fireEvent.change(await screen.findByLabelText('Account for Input Tax'), {
      target: { value: '511300' },
    })
    await clickApprove()
    expect(await screen.findByRole('alert')).toHaveTextContent('not allowed for department OPS')
    expect(api.approveDocument).not.toHaveBeenCalled()
  })

  it('posts the edited values, not the ones that arrived', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    fireEvent.change(await screen.findByDisplayValue('INV-001'), { target: { value: 'INV-999' } })
    await clickApprove()
    await waitFor(() => {
      const body = vi.mocked(api.approveDocument).mock.calls[0][1]
      expect((body.extracted as { doc_no: string }).doc_no).toBe('INV-999')
    })
  })

  it('cannot be approved while the JV would not balance', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: BENT }))
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getByRole('button', { name: /Approve/ })).toBeDisabled()
    expect(screen.getByText('Does not balance')).toBeInTheDocument()
  })

  it('cannot be approved while a line carrying money has no account', async () => {
    // The state a `mapping_missing` document parks in. Posting it would hand Carmen a GL
    // line it cannot file.
    storedConfig = { ...storedConfig, paymentAmount: {} }
    vi.mocked(api.getPending).mockResolvedValue(detail({ unmapped: ['Visa'] }))
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getByRole('button', { name: /Approve/ })).toBeDisabled()
  })

  it('becomes approvable once the missing account is filled in place', async () => {
    // This is the whole point of parking `mapping_incomplete` instead of failing it.
    storedConfig = { ...storedConfig, paymentAmount: {} }
    vi.mocked(api.getPending).mockResolvedValue(detail({ unmapped: ['Visa'] }))
    mount()
    fireEvent.change(await screen.findByLabelText('Department for Visa'), {
      target: { value: 'GEN' },
    })
    fireEvent.change(screen.getByLabelText('Account for Visa'), { target: { value: '110300' } })
    await waitFor(() => expect(screen.getByRole('button', { name: /Approve/ })).toBeEnabled())
  })

  it('keeps the document on screen when Carmen refuses it', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockRejectedValue(new Error('Period 01/2026 is closed'))
    mount()
    await clickApprove()
    expect(await screen.findByRole('alert')).toHaveTextContent('Period 01/2026 is closed')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('sends the reviewer back to the queue when someone else got there first', async () => {
    const err = Object.assign(new Error('gone'), { status: 409 })
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockRejectedValue(err)
    mount()
    await clickApprove()
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('can decline the input-tax record without blocking the JV', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    fireEvent.click(await screen.findByRole('checkbox'))
    await clickApprove()
    await waitFor(() =>
      expect(vi.mocked(api.approveDocument).mock.calls[0][1].post_input_tax).toBe(false)
    )
  })
})

describe('leaving', () => {
  it('closes on Escape, and the document stays waiting', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(api.rejectDocument).not.toHaveBeenCalled()
  })

  it('tells the reviewer when the document is no longer theirs to handle', async () => {
    vi.mocked(api.getPending).mockRejectedValue(new Error('404'))
    mount()
    expect(await screen.findByText('This document is not waiting for review')).toBeInTheDocument()
  })

  it('asks before rejecting, since it is terminal and not refunded', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Reject/ }))
    await screen.findByRole('button', { name: 'Reject document' })
    expect(api.rejectDocument).not.toHaveBeenCalled()
  })
})
