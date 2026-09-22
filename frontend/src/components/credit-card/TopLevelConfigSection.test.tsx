import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import TopLevelConfigSection from './TopLevelConfigSection'
import type { BankDisplayName } from '../../types/api'

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
    fileSource: 'ACSC',
    description: 'Generic settlement',
    setDescription,
    bankDescriptions: {} as Record<string, string>,
    setBankDescriptions,
    masterGLPrefixes: [],
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
      fileSource="ACSC"
      description={description}
      setDescription={setDescription}
      bankDescriptions={bankDescriptions}
      setBankDescriptions={setBankDescriptions}
      masterGLPrefixes={[]}
    />
  )
}

// Ticket D (2026-09-22): a settlement JV's wording is this same field now, so a bank
// with a settlement layout grows tag-insert buttons and a live preview beneath it —
// every other bank sees exactly the box the tests above already pin.
describe('TopLevelConfigSection — settlement tag extras', () => {
  it('is absent for a bank with no settlement layout', () => {
    setup({ hasSettlementLayout: false })
    expect(screen.queryByText('+ {Settlement_Date}')).not.toBeInTheDocument()
  })

  it('offers all three tags and shows the live preview for a settlement-capable bank', () => {
    setup({ hasSettlementLayout: true, settlementPreview: 'AR Recon 21/07/2026' })
    expect(screen.getByText('+ {Settlement_Date}')).toBeInTheDocument()
    expect(screen.getByText('+ {Tax_Invoice_No}')).toBeInTheDocument()
    expect(screen.getByText('+ {Bank_Name}')).toBeInTheDocument()
    expect(screen.getByText('AR Recon 21/07/2026')).toBeInTheDocument()
  })

  it('appends a tag to the bank-scoped description, not the BU-wide fallback', () => {
    const { setBankDescriptions } = setup({
      hasSettlementLayout: true,
      bankDescriptions: { SCB: 'AR Recon' },
    })
    fireEvent.click(screen.getByText('+ {Settlement_Date}'))
    expect(setBankDescriptions).toHaveBeenCalledWith({ SCB: 'AR Recon {Settlement_Date}' })
  })

  it('appends a tag to the BU-wide fallback when no bank is selected', () => {
    const { setDescription } = setup({ hasSettlementLayout: true, bank: '', fileSource: '' })
    fireEvent.click(screen.getByText('+ {Bank_Name}'))
    expect(setDescription).toHaveBeenCalledWith('Generic settlement {Bank_Name}')
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
