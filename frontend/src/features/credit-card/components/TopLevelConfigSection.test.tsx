import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import TopLevelConfigSection from './TopLevelConfigSection'
import type { BankDisplayName } from '@/shared/types/api'

/** Description is one field scoped to the selected bank — and, since 2026-09-30, that
 * bank's entry is all there is. The BU-wide fallback that used to sit behind it was
 * read everywhere and editable nowhere (dev `carmen` showed "TEST ACC" on every bank),
 * so it was retired and copied into each bank the BU used (decision-log #33). */
function setup(over: Partial<React.ComponentProps<typeof TopLevelConfigSection>> = {}) {
  const setBankDescriptions = vi.fn()
  const props = {
    bank: 'Siam Commercial Bank (SCB)' as BankDisplayName,
    handleBankChange: vi.fn(),
    filePrefix: 'IC',
    setFilePrefix: vi.fn(),
    prefixes: [] as { code: string; name: string }[],
    fileSource: 'ACSC',
    bankDescriptions: {} as Record<string, string>,
    setBankDescriptions,
    ...over,
  }
  render(<TopLevelConfigSection {...props} />)
  return { setBankDescriptions, field: screen.getByLabelText('Description') }
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

  it('is empty when the bank has none, and says the JV will carry no description', () => {
    const { field } = setup({ bankDescriptions: { KTC: 'KTC Merchant Fee' } })
    expect(field).toHaveValue('')
    // Not another bank's wording, and not a BU-wide one: there is nothing behind it.
    expect(field).toHaveAttribute('placeholder', 'Additional details')
    expect(screen.getByText('Empty — SCB documents post no description')).toBeInTheDocument()
  })

  it('writes against the selected bank, leaving other banks alone', () => {
    const { setBankDescriptions, field } = setup({
      bankDescriptions: { KTC: 'KTC Merchant Fee' },
    })
    fireEvent.change(field, { target: { value: 'SCB Credit Card Settlement' } })
    expect(setBankDescriptions).toHaveBeenCalledWith({
      KTC: 'KTC Merchant Fee',
      SCB: 'SCB Credit Card Settlement',
    })
  })

  it('writes nothing when the field is merely displayed, never typed in', () => {
    const { setBankDescriptions } = setup()
    expect(setBankDescriptions).not.toHaveBeenCalled()
  })

  it('cannot be edited with no bank selected — a Description belongs to a bank', () => {
    const { setBankDescriptions, field } = setup({ bank: '', fileSource: '' })
    expect(screen.getByText('Select a bank to set its description')).toBeInTheDocument()
    expect(field).toBeDisabled()
    expect(screen.getByText('Document date').closest('button')).toBeDisabled()
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
 * reappeared under the cursor — the box could not be cleared. The fallback is gone
 * (2026-09-30), but the round trip is still worth pinning. */
function Harness({ initial = {} as Record<string, string> }) {
  const [bankDescriptions, setBankDescriptions] = useState(initial)
  return (
    <TopLevelConfigSection
      bank={'Siam Commercial Bank (SCB)' as BankDisplayName}
      handleBankChange={() => {}}
      filePrefix="IC"
      setFilePrefix={() => {}}
      prefixes={[]}
      fileSource="ACSC"
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

  it("appends a tag to the selected bank's own description", () => {
    const { setBankDescriptions } = setup({
      hasSettlementLayout: true,
      bankDescriptions: { SCB: 'AR Recon' },
    })
    fireEvent.click(screen.getByText('Document date'))
    expect(setBankDescriptions).toHaveBeenCalledWith({ SCB: 'AR Recon {Settlement_Date}' })
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
  it('can be cleared all the way, and then says so', () => {
    render(<Harness initial={{ SCB: 'SCB Credit Card Settlement' }} />)
    const field = screen.getByLabelText('Description')
    fireEvent.change(field, { target: { value: '' } })
    expect(field).toHaveValue('')
    expect(screen.getByText('Empty — SCB documents post no description')).toBeInTheDocument()
  })

  it('keeps what was typed, character by character', () => {
    render(<Harness />)
    const field = screen.getByLabelText('Description')
    fireEvent.change(field, { target: { value: 'SCB only' } })
    expect(field).toHaveValue('SCB only')
    fireEvent.change(field, { target: { value: 'SCB onl' } })
    expect(field).toHaveValue('SCB onl')
  })
})
