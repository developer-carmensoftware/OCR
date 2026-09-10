import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import ARReconcileSettings from './ARReconcileSettings'
import type { ARPreview, ARSettings } from '../lib/api/arReconcile'

vi.mock('../lib/api/arReconcile', async importOriginal => ({
  // POST_TYPES is data the page iterates, not a call to stub.
  ...(await importOriginal<typeof import('../lib/api/arReconcile')>()),
  getARSettings: vi.fn(),
  saveARSettings: vi.fn(),
  previewARJv: vi.fn(),
  getSamplePaymentTypes: vi.fn(),
}))
vi.mock('../lib/api/mapping', () => ({ suggestPaymentTypes: vi.fn() }))
// Carmen's code lists. Which options a picker holds is not what these tests are about,
// and unstubbed this reaches apiFetch in jsdom.
vi.mock('../lib/api/carmen', () => ({
  fetchAccountCodes: vi.fn().mockResolvedValue([]),
  fetchDepartments: vi.fn().mockResolvedValue([]),
  fetchGLPrefixes: vi.fn().mockResolvedValue([]),
}))

const api = await import('../lib/api/arReconcile')

function settings(over: Partial<ARSettings> = {}): ARSettings {
  return {
    bank_code: 'KBANK',
    enabled: true,
    post_type: 'Detail',
    jv_description_template: 'Credit Card AR Reconcile {Settlement_Date}',
    debit_dept_code: 'GEN',
    debit_account_code: '1021000',
    mappings: {
      Detail: [
        {
          payment_type_code: 'VS INTER PREM',
          credit_dept_code: 'GEN',
          credit_account_code: '1021001',
          is_active: true,
        },
      ],
      Summary: [
        {
          payment_type_code: 'VS',
          credit_dept_code: 'GEN',
          credit_account_code: '1021001',
          is_active: true,
        },
      ],
    },
    blockers: [
      { key: 'bank_supported', ok: true },
      { key: 'feature_enabled', ok: true },
      { key: 'email_rule', ok: false, detail: 'No email rule forwards settlement reports' },
      { key: 'mapping_complete', ok: true, detail: '1 of 1 mapped' },
      { key: 'clearing_account', ok: true },
      { key: 'auto_post', ok: false, detail: 'Documents wait for review' },
    ],
    // FRD §3.1's selector: KBANK readable now, the other three listed as Phase 2.
    banks: [
      { code: 'KBANK', name: 'Kasikornbank', supported: true },
      { code: 'SCB', name: 'Siam Commercial Bank', supported: false },
      { code: 'BBL', name: 'Bangkok Bank', supported: false },
      { code: 'BAY', name: 'Krungsri', supported: false },
    ],
    ...over,
  }
}

function preview(over: Partial<ARPreview> = {}): ARPreview {
  return {
    rows: [
      {
        dept: 'GEN',
        acc: '1021000',
        desc: 'Tax Inv.# X - Credit Card AR Summary',
        debit: 25091,
        credit: 0,
        key: '',
      },
      {
        dept: 'GEN',
        acc: '1021001',
        desc: 'Tax Inv.# X - VS INTER PREM',
        debit: 0,
        credit: 25091,
        key: 'VS INTER PREM',
      },
    ],
    description: 'Credit Card AR Reconcile 21/07/2026',
    doc_no: '210726E00035291',
    doc_date: '21/07/2026',
    total_debit: 25091,
    total_credit: 25091,
    balanced: true,
    unmapped: [],
    post_type: 'Detail',
    ...over,
  }
}

/** The balance verdict, read as one string: it carries an icon, so its text is split. */
function balanceLine() {
  const el = document.querySelector('.ar-balance')
  if (!el) throw new Error('no balance line rendered')
  return el
}

function renderPage() {
  return render(
    <LanguageProvider>
      <ARReconcileSettings />
    </LanguageProvider>
  )
}

beforeEach(() => {
  // Call counts leak between tests without this, so "nothing reached the server" was a
  // claim about the whole file rather than about the test making it.
  vi.clearAllMocks()
  vi.mocked(api.getARSettings).mockResolvedValue(settings())
  vi.mocked(api.previewARJv).mockResolvedValue(preview())
  vi.mocked(api.getSamplePaymentTypes).mockResolvedValue([])
})

describe('AR reconciliation settings', () => {
  it('renders the saved configuration and its JV preview', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('PAYMENT TYPE MAPPING')).toBeInTheDocument())
    expect(screen.getByLabelText(/Reconcile settlement reports/i)).toBeChecked()
    expect(screen.getByText('VS INTER PREM')).toBeInTheDocument()
    // The balance line carries an icon, so its text is split across nodes. It also
    // arrives on the preview's own request, one tick after the settings render.
    await waitFor(() => expect(balanceLine()).toHaveTextContent('Debit = Credit'))
    expect(screen.getByText('Credit Card AR Reconcile 21/07/2026')).toBeInTheDocument()
  })

  it('lists the Phase 2 banks and refuses to let one be picked', async () => {
    // FRD Out-of-Scope: SCB, BBL and BAY arrive in Phase 2. Listing them is how the
    // customer learns that; disabling them is how they do not configure a bank whose
    // report nothing can parse. Both come from the server — the screen holds no bank
    // list, and no copy of which release reads what.
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Merchant bank')).toBeInTheDocument())

    const options = screen.getAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual([
      'KBANK — Kasikornbank',
      'SCB — Siam Commercial Bank — Phase 2',
      'BBL — Bangkok Bank — Phase 2',
      'BAY — Krungsri — Phase 2',
    ])
    expect(options[0]).toBeEnabled()
    expect(options[1]).toBeDisabled()
  })

  it('states the whole readiness chain, not just what is wrong', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('READINESS')).toBeInTheDocument())
    // Six links, and the two that are not met are the ones a person can act on.
    expect(screen.getByText('Email rule tagged for settlement reports')).toBeInTheDocument()
    expect(screen.getByText('Posts without review')).toBeInTheDocument()
    expect(screen.getByText('Bank is readable')).toBeInTheDocument()
  })

  it('shows what switching post type would cost before it is switched', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('radiogroup')).toBeInTheDocument())
    const [detail, summary] = screen.getAllByRole('radio')
    expect(detail).toHaveAttribute('aria-checked', 'true')
    // Each option carries its own mapped/total, so the other set's state is visible
    // without switching to it.
    expect(detail).toHaveTextContent('1/1 mapped')
    expect(summary).toHaveTextContent('1/1 mapped')
  })

  it('switching post type shows that set’s rows', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('VS INTER PREM')).toBeInTheDocument())

    fireEvent.click(screen.getAllByRole('radio')[1])

    await waitFor(() => expect(screen.getByText('VS')).toBeInTheDocument())
    expect(screen.queryByText('VS INTER PREM')).not.toBeInTheDocument()
  })

  it('names the unmapped types rather than only refusing to post', async () => {
    vi.mocked(api.previewARJv).mockResolvedValue(preview({ unmapped: ['JCB PREM', 'AMEX PREM'] }))
    renderPage()

    await waitFor(() => expect(screen.getByText(/JCB PREM, AMEX PREM/)).toBeInTheDocument())
  })

  it('says by how much an unbalanced JV is out', async () => {
    vi.mocked(api.previewARJv).mockResolvedValue(preview({ balanced: false, total_credit: 25000 }))
    renderPage()

    // 25,091.00 debit against 25,000.00 credit — the reader is told the gap, not just
    // that there is one.
    await waitFor(() => expect(balanceLine()).toHaveTextContent('Out by 91.00'))
    expect(balanceLine()).toHaveTextContent('cannot post')
  })

  it('warns when the clearing account is moved away from the credit-card mapping', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('BANK PROFILE')).toBeInTheDocument())
    // Nothing has been changed yet, so the neutral explanation stands.
    expect(screen.getByText(/Taken from the credit-card mapping/)).toBeInTheDocument()
  })

  it('sends both mapping sets on save, so one view cannot delete the other', async () => {
    vi.mocked(api.saveARSettings).mockResolvedValue(undefined)
    renderPage()
    await waitFor(() => expect(screen.getByText('PAYMENT TYPE MAPPING')).toBeInTheDocument())

    // Save only opens once something differs from what the server confirmed.
    fireEvent.click(screen.getByLabelText(/Reconcile settlement reports/i))
    fireEvent.click(screen.getByRole('button', { name: /Save settings/i }))

    await waitFor(() => expect(api.saveARSettings).toHaveBeenCalled())
    const body = vi.mocked(api.saveARSettings).mock.calls[0][0]
    expect(Object.keys(body.mappings).sort()).toEqual(['Detail', 'Summary'])
    expect(body.mappings.Detail).toHaveLength(1)
    expect(body.mappings.Summary).toHaveLength(1)
  })

  it('seeds the printed payment types for a BU that has none yet', async () => {
    vi.mocked(api.getARSettings).mockResolvedValue(
      settings({ mappings: { Detail: [], Summary: [] } })
    )
    vi.mocked(api.getSamplePaymentTypes).mockResolvedValue([
      { payment_type_code: 'VS INTER UP PREM', is_active: true },
      { payment_type_code: 'JCB PREM', is_active: true },
    ])
    renderPage()

    // Otherwise the only way to get a row is to be charged for a document that then parks.
    await waitFor(() => expect(screen.getByText('VS INTER UP PREM')).toBeInTheDocument())
    // The count is split across <strong> nodes, so read the status line as a whole.
    expect(document.querySelector('.cc-mapping-status')).toHaveTextContent('2 of 2 still to map')
  })

  // ── Unsaved work ────────────────────────────────────────────────────────────
  //
  // One Save at the foot of a long form, and the Back link sits at the very top of it.
  // Everything below is about the gap between those two facts.

  it('will not save an untouched form, and says which state it is in', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('PAYMENT TYPE MAPPING')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /Save settings/i })).toBeDisabled()
    expect(screen.getByText('Everything here is saved')).toBeInTheDocument()
    expect(api.saveARSettings).not.toHaveBeenCalled()
  })

  it('seeded rows are not the reviewer’s work, so they do not count as unsaved', async () => {
    // Arriving on a fresh BU and leaving again must not ask about discarding a vocabulary
    // the machine put there.
    vi.mocked(api.getARSettings).mockResolvedValue(
      settings({ mappings: { Detail: [], Summary: [] } })
    )
    vi.mocked(api.getSamplePaymentTypes).mockResolvedValue([
      { payment_type_code: 'VS INTER UP PREM', is_active: true },
    ])
    renderPage()

    await waitFor(() => expect(screen.getByText('VS INTER UP PREM')).toBeInTheDocument())
    expect(screen.getByText('Everything here is saved')).toBeInTheDocument()
  })

  it('asks before the Back link throws away unsaved mappings', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('PAYMENT TYPE MAPPING')).toBeInTheDocument())

    fireEvent.click(screen.getByLabelText(/Reconcile settlement reports/i))
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /Back to the queue/i }))

    // The link is a hash navigation, which never fires `beforeunload` — so this dialog is
    // the only thing standing between a filled-in mapping table and one convenient click.
    expect(await screen.findByText('Leave without saving?')).toBeInTheDocument()
  })

  it('does not ask when there is nothing to lose', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('PAYMENT TYPE MAPPING')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('link', { name: /Back to the queue/i }))

    expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument()
  })
})
