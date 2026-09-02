import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import ReviewDocument from './ReviewDocument'
import type { ReviewDocumentDetail } from '../lib/api/emailReview'

vi.mock('../lib/api/emailReview', () => ({
  getPending: vi.fn(),
  approveDocument: vi.fn(),
  rejectDocument: vi.fn(),
}))
vi.mock('../lib/api/config', () => ({ patchAccountingConfig: vi.fn() }))
vi.mock('../lib/api/mapping', () => ({ suggestPaymentTypes: vi.fn() }))
vi.mock('../lib/api/carmen', () => ({
  fetchAccountCodes: vi.fn(async () => [
    { AccCode: '510300', Description: 'Bank charge' },
    { AccCode: '511200', Description: 'Input tax' },
    { AccCode: '511300', Description: 'Input tax (alt)' },
    { AccCode: '110200', Description: 'Bank - KBANK' },
    { AccCode: '110300', Description: 'Settlement receivable' },
  ]),
  fetchTaxProfiles: vi.fn(async () => [
    { code: 'VAT07', desc: 'VAT 7%', rate: 7 },
    { code: 'VAT00', desc: 'VAT 0%', rate: 0 },
  ]),
  // Carmen's journal books — what the Prefix picker offers.
  fetchGLPrefixes: vi.fn(async () => [
    { PrefixName: 'JV', Description: 'Journal Voucher' },
    { PrefixName: 'AJ', Description: 'Adjustment' },
    { PrefixName: 'CA', Description: 'Cost Allocation' },
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

describe('the screen', () => {
  it('shows the document and the JV it produces at the same time', async () => {
    // The whole reason for the layout: the comparison is the reviewer's only question,
    // and it cannot be made one pane at a time.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    expect(await screen.findByDisplayValue('INV-001')).toBeInTheDocument()
    expect(await screen.findByLabelText('Credit for Visa line 1')).toHaveValue('1,000.00')
    expect(screen.getByRole('region', { name: 'What the document says' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What will post' })).toBeInTheDocument()
  })

  it('shows the four fields that reach Carmen as the JV header, and no others', async () => {
    // Read off build_gljv_payload: JvhDate, Prefix and Description are the only header
    // fields that vary, plus the document number the record is filed under. Company,
    // merchant and the two bank names appear in neither payload — they were things to
    // read past.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    // Scoped: the JV table has a Description column header of its own.
    const header = within(screen.getByRole('region', { name: 'What the document says' }))
    expect(header.getByLabelText('Document no.')).toBeInTheDocument()
    expect(header.getByLabelText('Document date')).toBeInTheDocument()
    expect(header.getByText('Prefix')).toBeInTheDocument()
    expect(header.getByText('Description')).toBeInTheDocument()
    for (const gone of ['Billed to', 'Merchant', 'Merchant ID', 'Bank', 'Document type']) {
      expect(screen.queryByLabelText(gone)).not.toBeInTheDocument()
    }
  })

  it('previews the prefix and description exactly as the JV will carry them', async () => {
    // Resolved through descriptionForBank, the same helper buildGljvPayload uses — a
    // preview that could disagree with what posts is worse than no preview. The field holds
    // the BASE — the JV builder appends " - <doc date>" on post, and that tail is not
    // rendered: it is the document date already on screen two fields along.
    storedConfig = { ...storedConfig, filePrefix: 'JV', description: 'Card settlement' }
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getByLabelText('Prefix')).toHaveValue('JV')
    expect(screen.getByLabelText('Description')).toHaveValue('Card settlement')
    expect(screen.queryByText(/- 15\/01\/2026/)).not.toBeInTheDocument()
  })

  it('offers Carmen’s journal books rather than a free-text prefix', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    const picker = await screen.findByLabelText('Prefix')
    expect(picker.getAttribute('data-options')).toBe('JV,AJ,CA')
  })
})

describe('the input tax record', () => {
  it('states its outcome without being opened', async () => {
    // A disclosure that hides its own answer is the collapsing this screen threw out once
    // already. Commission 30.00, VAT 2.10 — 7%.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getByText('VAT 2.10 at 7%')).toBeInTheDocument()
  })

  it('keeps its own fields behind the dropdown, not in the JV header', async () => {
    // Branch is the one document field this record uses and the JV does not.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.queryByLabelText('Branch')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Show details/ }))
    expect(await screen.findByLabelText('Branch')).toHaveValue('00000')
    expect(screen.getByText('Tax period')).toBeInTheDocument()
    expect(screen.getByText('Vendor')).toBeInTheDocument()
  })

  it('does not repeat the figures the JV above it already shows', async () => {
    // BfTaxAmt is the commission debit row and TaxAmt is the Input Tax row; TotalAmt is
    // their sum. Reading a number twice to check it once is what this screen keeps cutting.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    fireEvent.click(screen.getByRole('button', { name: /Show details/ }))
    await screen.findByLabelText('Branch')
    expect(screen.queryByText('Base')).not.toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  it('says so when the statement charged no VAT, instead of offering a choice', async () => {
    vi.mocked(api.getPending).mockResolvedValue(
      detail({
        extracted: { ...EXTRACTED, details: [{ ...LINE, commis_amt: '0', tax_amt: '0' }] },
      })
    )
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getByText('No VAT on this document')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('sends only the fields the reviewer corrected, so the rest stay derived', async () => {
    // The server builds this record; the panel names the four things it can get wrong.
    // Untouched means absent, which is exactly what the unattended path sends.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    await screen.findByDisplayValue('INV-001')
    fireEvent.click(screen.getByRole('button', { name: /Show details/ }))
    await screen.findByLabelText('Branch')
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'KTC PCL' } })
    fireEvent.change(screen.getByLabelText('Tax ID'), { target: { value: '0107536000315' } })
    await clickApprove()

    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    expect(vi.mocked(api.approveDocument).mock.calls[0][1].input_tax).toEqual({
      vendor_name: 'KTC PCL',
      tax_id: '0107536000315',
    })
  })

  it('omits the overrides entirely when nothing was touched', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    await clickApprove()
    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    expect(vi.mocked(api.approveDocument).mock.calls[0][1].input_tax).toBeUndefined()
  })

  it('states the tax period rather than offering it, because the document names it', async () => {
    // Doc date 15/01/2026. Not a field: a claim filed in a month the statement does not
    // name is the wrong-month error the builder refuses to make, and a misread date is
    // corrected on the document date above.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    fireEvent.click(screen.getByRole('button', { name: /Show details/ }))
    expect(await screen.findByText('01/2026')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tax period')).not.toBeInTheDocument()
  })

  it('follows the profile the reviewer picked, rate and warning included', async () => {
    // Naming a profile answers the question the rate lookup asks — so the summary line
    // has to answer with it, and the mismatch it now creates has to be said out loud.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    await screen.findByDisplayValue('INV-001')
    fireEvent.click(screen.getByRole('button', { name: /Show details/ }))
    await screen.findByLabelText('Branch')
    fireEvent.change(screen.getByLabelText('Tax profile'), { target: { value: 'VAT00' } })

    expect(await screen.findByText('VAT 2.10 at 0%')).toBeInTheDocument()
    await clickApprove()
    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    expect(vi.mocked(api.approveDocument).mock.calls[0][1].input_tax).toEqual({
      profile_code: 'VAT00',
    })
  })

  it('states the totals once, on the journal that produces them', async () => {
    // A summary strip used to sit above: Gross was the JV's credit total and Commission /
    // VAT / Net were three of its debit rows. Four numbers, every one already on screen.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.queryByText('Gross')).not.toBeInTheDocument()
    // The figures it summarised are still there, on the rows that own them.
    expect(screen.getByLabelText('Debit for Credit card commission line 1')).toHaveValue('30.00')
    expect(screen.getByLabelText('Credit for Visa line 1')).toHaveValue('1,000.00')
  })

  it('shows a JV that does not add up on the row where the numbers disagree', async () => {
    // No block header summarises it, and there is no line-items table to hunt through:
    // the TOTAL row carries both figures and the reason.
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: BENT }))
    mount()
    await screen.findByDisplayValue('INV-001')
    expect(screen.getByText('Does not balance')).toBeInTheDocument()
    // Portaled to body, so RTL's `container` never sees it.
    expect(document.querySelector('.jv-total--bad')).toBeInTheDocument()
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

describe('editing amounts on the JV', () => {
  it('writes a credit leg straight back to its own line', async () => {
    // One credit leg, one detail line: exact, no judgement involved. The net moves with it
    // because a JV that no longer balances cannot be approved — which is the point.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    fireEvent.change(await screen.findByLabelText('Credit for Visa line 1'), {
      target: { value: '1200' },
    })
    fireEvent.change(screen.getByLabelText('Debit for Bank Account line 1'), {
      target: { value: '1167.90' },
    })
    await clickApprove()
    await waitFor(() => {
      const body = vi.mocked(api.approveDocument).mock.calls[0][1]
      const lines = (body.extracted as { details: { pay_amt: string }[] }).details
      expect(lines[0].pay_amt).toBe('1200.00')
    })
  })

  it('shares a summed leg across its lines and still totals exactly what was typed', async () => {
    // `details` is not display — the input-tax record is filed from it line by line — so a
    // figure that moved only on the journal would post a VAT record that disagrees.
    // Commission is 30 + 15 = 45 across two lines; 60 splits 40 / 20. The net absorbs the
    // 15 so the JV still balances and can be approved — the correction a reviewer who
    // spotted a misread commission would actually make.
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: TWO_VISA }))
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    fireEvent.change(await screen.findByLabelText('Debit for Credit card commission'), {
      target: { value: '60' },
    })
    fireEvent.change(screen.getByLabelText('Debit for Bank Account'), {
      target: { value: '1436.85' },
    })
    await clickApprove()
    await waitFor(() => {
      const body = vi.mocked(api.approveDocument).mock.calls[0][1]
      const lines = (body.extracted as { details: { commis_amt: string }[] }).details
      expect(lines.map(l => l.commis_amt)).toEqual(['40.00', '20.00'])
    })
  })

  it('marks a leg that is summed from several lines', async () => {
    // Typing into it changes all of them, which is not what a plain figure does.
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: TWO_VISA }))
    mount()
    const shared = await screen.findByLabelText('Debit for Credit card commission')
    expect(shared).toHaveAttribute('data-shared')
    expect(screen.getByLabelText('Credit for Visa line 1')).not.toHaveAttribute('data-shared')
  })
})

describe('editing a line description', () => {
  it('posts the retyped wording and saves no rule for it', async () => {
    // The GL line's own text, not a rule: it reaches Carmen as Detail[].Description and
    // nothing about it belongs in the BU config.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    fireEvent.change(await screen.findByLabelText('Description for Bank Account'), {
      target: { value: 'KBANK settlement 15/01' },
    })
    await clickApprove()

    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    const rows = vi.mocked(api.approveDocument).mock.calls[0][1].rows as { desc: string }[]
    expect(rows.map(r => r.desc)).toContain('KBANK settlement 15/01')
    expect(cfgApi.patchAccountingConfig).not.toHaveBeenCalled()
  })

  it('survives an amount edit that drops a leg', async () => {
    // Keyed by rule + source lines, not by index: zeroing a credit leg removes a row and
    // would shift every index after it, moving the reviewer's text onto another line.
    vi.mocked(api.getPending).mockResolvedValue(detail({ extracted: TWO_VISA }))
    mount()
    fireEvent.change(await screen.findByLabelText('Description for Credit card commission'), {
      target: { value: 'Merchant fee' },
    })
    fireEvent.change(screen.getByLabelText('Credit for Visa line 1'), { target: { value: '0' } })
    expect(await screen.findByLabelText('Description for Merchant fee')).toHaveValue('Merchant fee')
  })
})

describe('approving', () => {
  it('saves the corrected rule before posting, never after', async () => {
    // The other order can leave a rule silently unsaved behind a JV that already posted.
    // This one leaves a corrected rule standing even if Carmen refuses, which is right on
    // its own terms — the rule was wrong before and is right now.
    const order: string[] = []
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(cfgApi.patchAccountingConfig).mockImplementation(async () => {
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
    expect(vi.mocked(cfgApi.patchAccountingConfig).mock.calls[0][0]).toMatchObject({
      mappings: { tax: { dept: 'OPS', acc: '511300' } },
    })
  })

  it('saves an edited prefix and description as config, with the bank they belong to', async () => {
    // They are BU config, not per-document: approve_document reads them off the config
    // server-side, so a browser edit reaches Carmen only once it is written. `bank_code`
    // travels because the server prefers a per-bank description over the BU-wide one.
    storedConfig = { ...storedConfig, filePrefix: 'JV', description: 'Card settlement' }
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    fireEvent.change(await screen.findByLabelText('Prefix'), { target: { value: 'AJ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Settlement' } })
    await clickApprove()

    await waitFor(() => expect(cfgApi.patchAccountingConfig).toHaveBeenCalled())
    expect(vi.mocked(cfgApi.patchAccountingConfig).mock.calls[0][0]).toMatchObject({
      file_prefix: 'AJ',
      // The base only. The " - 15/01/2026" tail is appended per document by the JV
      // builder, and saving it would bake one document's date into the BU's rule.
      description: 'Settlement',
      bank_code: 'KTC',
    })
  })

  it('counts a header change alongside the mapping changes', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    fireEvent.change(await screen.findByLabelText('Prefix'), { target: { value: 'AJ' } })
    expect(await screen.findByText('1 GL rule changes when you approve')).toBeInTheDocument()
  })

  it('touches no rules when nothing was corrected', async () => {
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(api.approveDocument).mockResolvedValue({ jv_no: 'JV-1', tax_note: null })
    mount()
    await clickApprove()
    await waitFor(() => expect(api.approveDocument).toHaveBeenCalled())
    expect(cfgApi.patchAccountingConfig).not.toHaveBeenCalled()
  })

  it('posts nothing when the rule could not be saved', async () => {
    // A JV built on a rule the server rejected would put the wrong account into the books
    // and leave no record of why.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    vi.mocked(cfgApi.patchAccountingConfig).mockRejectedValue(
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
    // And says so at the button, by how much. A disabled control with no sentence beside
    // it sends the reviewer hunting the dialog for a tinted row.
    expect(await screen.findByText(/Debit and credit differ by/)).toBeInTheDocument()
  })

  it('cannot be approved while a line carrying money has no account', async () => {
    // The state a `mapping_missing` document parks in. Posting it would hand Carmen a GL
    // line it cannot file.
    storedConfig = { ...storedConfig, paymentAmount: {} }
    vi.mocked(api.getPending).mockResolvedValue(detail({ unmapped: ['Visa'] }))
    mount()
    await screen.findByDisplayValue('INV-001')
    const approve = screen.getByRole('button', { name: /Approve/ })
    expect(approve).toBeDisabled()
    // The reason names the fix and is what a screen reader is given for the disabled
    // control, not just something rendered nearby.
    expect(await screen.findByText(/Choose an account for every line/)).toBeInTheDocument()
    expect(approve).toHaveAttribute('aria-describedby', 'rd-blocked')
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

describe('the dialog does not swallow events its children need', () => {
  it('lets a document-level mousedown listener see a click inside the modal', async () => {
    // The regression: the modal used to carry `onMouseDown={e => e.stopPropagation()}` so a
    // click inside it would not reach the overlay's close. React's stopPropagation stops the
    // NATIVE event too, so `document` listeners never fired — and CustomSearchSelect and
    // DateInput both close themselves from one. Every picker in this dialog stayed open once
    // you clicked away from it.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    const inside = await screen.findByDisplayValue('INV-001')

    const seen = vi.fn()
    document.addEventListener('mousedown', seen)
    fireEvent.mouseDown(inside)
    document.removeEventListener('mousedown', seen)

    expect(seen).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled() // and the dialog still does not close
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

  it('asks before throwing away work the reviewer has done', async () => {
    // Escape and a click on the page behind are the two cheapest gestures on the screen,
    // and both used to discard corrected amounts and re-mapped accounts without a word.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    fireEvent.change(await screen.findByDisplayValue('INV-001'), { target: { value: 'INV-999' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(await screen.findByText('Leave without posting?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not ask when nothing has been touched', async () => {
    // A reviewer who opened a document, read it and moved on is not owed a dialog.
    vi.mocked(api.getPending).mockResolvedValue(detail())
    mount()
    await screen.findByDisplayValue('INV-001')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(screen.queryByText('Leave without posting?')).not.toBeInTheDocument()
  })
})
