import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('shows the value actually in effect when the bank has none — not an empty box', () => {
    const { field } = setup({ bankDescriptions: { KTC: 'KTC Merchant Fee' } })
    expect(field).toHaveValue('Generic settlement')
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
