import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TopLevelConfigSection from './TopLevelConfigSection'
import type { BankDisplayName } from '../../types/api'

/** The per-bank Description field: what a BU sets so its SCB documents do not read
 * like its KTC ones. `description` stays the fallback, and the placeholder is what
 * makes that visible rather than something to discover later. */
function setup(over: Partial<React.ComponentProps<typeof TopLevelConfigSection>> = {}) {
  const setBankDescriptions = vi.fn()
  const props = {
    bank: 'Siam Commercial Bank (SCB)' as BankDisplayName,
    handleBankChange: vi.fn(),
    filePrefix: 'IC',
    setFilePrefix: vi.fn(),
    fileSource: 'ACSC',
    description: 'Generic settlement',
    setDescription: vi.fn(),
    bankDescriptions: {} as Record<string, string>,
    setBankDescriptions,
    ...over,
  }
  render(<TopLevelConfigSection {...props} />)
  return { setBankDescriptions }
}

describe('TopLevelConfigSection — per-bank description', () => {
  it('shows the field for the selected bank, keyed by its code', () => {
    setup()
    expect(screen.getByLabelText('Description for SCB')).toBeInTheDocument()
  })

  it('is hidden until a bank is chosen — there is nothing to key it on', () => {
    setup({ bank: '', fileSource: '' })
    expect(screen.queryByLabelText(/Description for/)).not.toBeInTheDocument()
  })

  it('shows the BU-wide description as the placeholder, so the fallback is visible', () => {
    setup()
    const field = screen.getByLabelText('Description for SCB')
    expect(field).toHaveValue('')
    expect(field).toHaveAttribute('placeholder', 'Generic settlement')
    expect(screen.getByText('Empty — falls back to Description')).toBeInTheDocument()
  })

  it('shows the bank its own wording once set', () => {
    setup({ bankDescriptions: { SCB: 'SCB Credit Card Settlement' } })
    expect(screen.getByLabelText('Description for SCB')).toHaveValue('SCB Credit Card Settlement')
    expect(screen.getByText('Only SCB documents use this')).toBeInTheDocument()
  })

  it('writes under the bank code and leaves other banks alone', () => {
    const { setBankDescriptions } = setup({ bankDescriptions: { KTC: 'KTC Merchant Fee' } })
    fireEvent.change(screen.getByLabelText('Description for SCB'), {
      target: { value: 'SCB Credit Card Settlement' },
    })
    expect(setBankDescriptions).toHaveBeenCalledWith({
      KTC: 'KTC Merchant Fee',
      SCB: 'SCB Credit Card Settlement',
    })
  })

  it('keeps the BU-wide Description editable — it is still the fallback for every other bank', () => {
    const setDescription = vi.fn()
    render(
      <TopLevelConfigSection
        bank={'Siam Commercial Bank (SCB)' as BankDisplayName}
        handleBankChange={vi.fn()}
        filePrefix="IC"
        setFilePrefix={vi.fn()}
        fileSource="ACSC"
        description=""
        setDescription={setDescription}
        bankDescriptions={{}}
        setBankDescriptions={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Generic' } })
    expect(setDescription).toHaveBeenCalledWith('Generic')
  })
})
