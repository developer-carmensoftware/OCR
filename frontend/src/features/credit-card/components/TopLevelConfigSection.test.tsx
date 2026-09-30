import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import TopLevelConfigSection from './TopLevelConfigSection'
import type { BankDisplayName } from '@/shared/types/api'

/** Description is one field scoped to the selected bank.
 *
 * It was briefly two — a BU-wide box and a per-bank box below it — which put the
 * storage layout on screen and left the user to work out which one won. The single
 * box shows the wording a document would actually carry; the BU-wide value stays
 * behind it as the fallback for banks nobody has configured yet. */
function setup(over: Partial<React.ComponentProps<typeof TopLevelConfigSection>> = {}) {
  const setBankDescriptions = vi.fn()
  const setDescription = vi.fn()
  const props = {
    bank: 'Siam Commercial Bank (SCB)' as BankDisplayName,
    handleBankChange: vi.fn(),
    filePrefix: 'IC',
    setFilePrefix: vi.fn(),
    prefixes: [] as { code: string; name: string }[],
    fileSource: 'ACSC',
    description: 'Generic settlement',
    setDescription,
    bankDescriptions: {} as Record<string, string>,
    setBankDescriptions,
    ...over,
  }
  render(<TopLevelConfigSection {...props} />)
  return { setBankDescriptions, setDescription, field: screen.getByLabelText('Description') }
}

describe('TopLevelConfigSection — Description', () => {
  it('is one field, not two', () => {
    setup({ bankDescriptions: { SCB: 'SCB Credit Card Settlement' } })
    expect(screen.getAllByLabelText(/^Description/)).toHaveLength(1)
    expect(screen.queryByLabelText(/Description for/)).not.toBeInTheDocument()
  })

  it("shows the bank's own wording when it has one", () => {
    const { field } = setup({ bankDescriptions: { SCB: 'SCB Credit Card Settlement' } })
    expect(field).toHaveValue('SCB Credit Card Settlement')
    expect(screen.getByText('Applies to SCB documents')).toBeInTheDocument()
  })

  it('is empty when the bank has none, and names the fallback instead of pretending', () => {
    const { field } = setup({ bankDescriptions: { KTC: 'KTC Merchant Fee' } })
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('placeholder', 'Generic settlement')
    expect(screen.getByText('Empty — SCB documents use "Generic settlement"')).toBeInTheDocument()
  })

  it('writes against the selected bank, leaving other banks alone', () => {
    const { setBankDescriptions, setDescription, field } = setup({
      bankDescriptions: { KTC: 'KTC Merchant Fee' },
    })
    fireEvent.change(field, { target: { value: 'SCB Credit Card Settlement' } })
    expect(setBankDescriptions).toHaveBeenCalledWith({
      KTC: 'KTC Merchant Fee',
      SCB: 'SCB Credit Card Settlement',
    })
    expect(setDescription).not.toHaveBeenCalled() // the BU-wide fallback is untouched
  })

  it('leaves the fallback alone when the field is merely displayed, never typed in', () => {
    const { setBankDescriptions } = setup()
    expect(setBankDescriptions).not.toHaveBeenCalled()
  })

  it('edits the BU-wide value while no bank is selected — the only sensible target', () => {
    const { setDescription, setBankDescriptions, field } = setup({ bank: '', fileSource: '' })
    expect(screen.getByText('Select a bank to set this per bank')).toBeInTheDocument()
    fireEvent.change(field, { target: { value: 'Generic' } })
    expect(setDescription).toHaveBeenCalledWith('Generic')
    expect(setBankDescriptions).not.toHaveBeenCalled()
  })
})

describe('TopLevelConfigSection — Bank', () => {
  it('hands the display name to handleBankChange, as the old <select> did', () => {
    const handleBankChange = vi.fn()
    setup({ bank: '', fileSource: '', handleBankChange })
    fireEvent.focus(screen.getByLabelText('Bank'))
    fireEvent.mouseDown(screen.getByText('Krungthai Card (KTC)'))
    expect(handleBankChange).toHaveBeenCalledWith('Krungthai Card (KTC)')
  })
})

describe('TopLevelConfigSection — File Prefix', () => {
  it("picks from Carmen's GL prefixes instead of free text", () => {
    const setFilePrefix = vi.fn()
    setup({
      filePrefix: '',
      setFilePrefix,
      prefixes: [
        { code: 'JV', name: 'General Journal' },
        { code: 'AR', name: 'Receivables' },
      ],
    })
    fireEvent.focus(screen.getByLabelText('File Prefix'))
    fireEvent.mouseDown(screen.getByText('AR'))
    expect(setFilePrefix).toHaveBeenCalledWith('AR')
  })
})

/** A real parent, because the bug only shows on re-render.
 *
 * The field once took the *resolved* value, so deleting the last character emptied
 * the per-bank entry, the BU-wide fallback resolved in its place, and the old text
 * reappeared under the cursor — the box could not be cleared. */
function Harness({ initial = {} as Record<string, string> }) {
  const [description, setDescription] = useState('test')
  const [bankDescriptions, setBankDescriptions] = useState(initial)
  return (
    <TopLevelConfigSection
      bank={'Siam Commercial Bank (SCB)' as BankDisplayName}
      handleBankChange={() => {}}
      filePrefix="IC"
      setFilePrefix={() => {}}
      prefixes={[]}
      fileSource="ACSC"
      description={description}
      setDescription={setDescription}
      bankDescriptions={bankDescriptions}
      setBankDescriptions={setBankDescriptions}
    />
  )
}

// Ticket D (2026-09-22): a settlement JV's wording is this same field now, so a bank
// with a settlement layout grows tag-insert buttons and a live preview beneath it —
// every other bank sees exactly the box the tests above already pin.
// Ticket E (2026-09-23): the buttons read in plain language (not literal `{Tag}`
// syntax) and each one disables itself once its tag is already in the description —
// inserting the same tag five times was never a real state to allow.
// 2026-09-30: "disables itself" became a toggle (aria-pressed). Same day, nothing is
// appended on post any more (no auto date), so every bank gets the tags — a tag is the
// only way a date reaches the description — and the tags left the text box.
describe('TopLevelConfigSection — tag extras', () => {
  it('offers the tags to a bank with no settlement layout too, previewed locally', () => {
    setup({
      hasSettlementLayout: false,
      bankDescriptions: { SCB: 'Fee {Bank_Name} {Tax_Invoice_No}' },
    })
    expect(screen.getByText('Document date')).toBeInTheDocument()
    expect(screen.getByText('Fee SCB INV-0001')).toBeInTheDocument()
  })

  it('previews a description with no tag exactly as saved — no date appended', () => {
    setup({ bankDescriptions: { SCB: 'Commission' } })
    expect(screen.getByText('Commission')).toHaveClass('ar-preview-value')
  })

  it('offers all three tags and shows the live preview for a settlement-capable bank', () => {
    setup({ hasSettlementLayout: true, settlementPreview: 'AR Recon 21/07/2026' })
    expect(screen.getByText('Document date')).toBeInTheDocument()
    expect(screen.getByText('Tax invoice no.')).toBeInTheDocument()
    expect(screen.getByText('Bank name')).toBeInTheDocument()
    expect(screen.getByText('AR Recon 21/07/2026')).toBeInTheDocument()
  })

  it('appends a tag to the bank-scoped description, not the BU-wide fallback', () => {
    const { setBankDescriptions } = setup({
      hasSettlementLayout: true,
      bankDescriptions: { SCB: 'AR Recon' },
    })
    fireEvent.click(screen.getByText('Document date'))
    expect(setBankDescriptions).toHaveBeenCalledWith({ SCB: 'AR Recon {Settlement_Date}' })
  })

  it('appends a tag to the BU-wide fallback when no bank is selected', () => {
    const { setDescription } = setup({ hasSettlementLayout: true, bank: '', fileSource: '' })
    fireEvent.click(screen.getByText('Bank name'))
    expect(setDescription).toHaveBeenCalledWith('Generic settlement {Bank_Name}')
  })

  // 2026-09-30: a toggle, not a disabled button — disabled dropped the tooltip and focus,
  // and left no way to take a tag back out short of editing the raw `{Tag}` text.
  it('marks a present tag pressed, and pressing it again takes the tag out', () => {
    const { setBankDescriptions } = setup({
      hasSettlementLayout: true,
      bankDescriptions: { SCB: 'AR {Settlement_Date} Recon' },
    })
    const addedButton = screen.getByText('Document date').closest('button') as HTMLElement
    expect(addedButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Bank name').closest('button')).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(addedButton)
    expect(setBankDescriptions).toHaveBeenCalledWith({ SCB: 'AR Recon' })
  })

  // Same day, later: the tokens left the box — one backspace used to leave
  // `{Settlement_Dat`, which posts to Carmen verbatim. The box is text; fields ride after it.
  it('never shows a token in the box, and typing keeps the attached fields', () => {
    const { setBankDescriptions, field } = setup({
      bankDescriptions: { SCB: 'AR {Settlement_Date}' },
    })
    expect(field).toHaveValue('AR')
    fireEvent.change(field, { target: { value: 'AR Recon' } })
    expect(setBankDescriptions).toHaveBeenCalledWith({ SCB: 'AR Recon {Settlement_Date}' })
  })

  it('attaches fields after the text in the order they are picked', () => {
    const { setBankDescriptions } = setup({ bankDescriptions: { SCB: 'Fee {Bank_Name}' } })
    fireEvent.click(screen.getByText('Document date'))
    expect(setBankDescriptions).toHaveBeenCalledWith({ SCB: 'Fee {Bank_Name} {Settlement_Date}' })
  })

  it('keeps a space as it is typed, with a field attached', () => {
    // The box is controlled from the saved string, so the split must not trim — a real
    // stateful parent proves the round trip a mock setter cannot.
    function StatefulHarness() {
      const [bankDescriptions, setBankDescriptions] = useState<Record<string, string>>({
        SCB: 'AR Recon',
      })
      return (
        <TopLevelConfigSection
          bank={'Siam Commercial Bank (SCB)' as BankDisplayName}
          handleBankChange={() => {}}
          filePrefix="IC"
          setFilePrefix={() => {}}
          fileSource="ACSC"
          description=""
          setDescription={() => {}}
          bankDescriptions={bankDescriptions}
          setBankDescriptions={setBankDescriptions}
          prefixes={[]}
          hasSettlementLayout
        />
      )
    }
    render(<StatefulHarness />)

    const field = screen.getByLabelText('Description')
    fireEvent.click(screen.getByText('Document date'))
    fireEvent.change(field, { target: { value: 'AR Recon ' } })
    expect(field).toHaveValue('AR Recon ')
    fireEvent.change(field, { target: { value: 'AR Recon K' } })
    expect(field).toHaveValue('AR Recon K')
    expect(screen.getByText('Document date').closest('button')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})

describe('TopLevelConfigSection — Description survives re-render', () => {
  it('can be cleared all the way, with a fallback sitting behind it', () => {
    render(<Harness initial={{ SCB: 'SCB Credit Card Settlement' }} />)
    const field = screen.getByLabelText('Description')
    fireEvent.change(field, { target: { value: '' } })
    expect(field).toHaveValue('')
  })

  it('keeps what was typed instead of snapping back to the fallback', () => {
    render(<Harness />)
    const field = screen.getByLabelText('Description')
    fireEvent.change(field, { target: { value: 'SCB only' } })
    expect(field).toHaveValue('SCB only')
    fireEvent.change(field, { target: { value: 'SCB onl' } })
    expect(field).toHaveValue('SCB onl') // not 'test'
  })
})
