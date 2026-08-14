import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PDFPageSelector from './PDFPageSelector'

// framer-motion reads window.matchMedia, which jsdom lacks.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }
})

const PAGES = ['a', 'b', 'c', 'd', 'e']

function setup(props: Partial<React.ComponentProps<typeof PDFPageSelector>> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <PDFPageSelector thumbnails={PAGES} onConfirm={onConfirm} onCancel={onCancel} {...props} />
  )
  return { onConfirm, onCancel }
}

const continueBtn = () => screen.getByRole('button', { name: /Continue/ }) as HTMLButtonElement

/**
 * Every selected page costs a document, so this dialog is the last place the user can be
 * told the price — and the only place a scan they can't afford can be stopped before the
 * backend charges anything.
 */
describe('PDFPageSelector — per-page cost', () => {
  it('states the rule so the price is visible before choosing', () => {
    setup()
    expect(screen.getByText(/Each page uses 1 document/)).toBeTruthy()
  })

  it('blocks a selection that costs more documents than the tenant has left', () => {
    setup({ remaining: 3 }) // defaults to all 5 pages selected
    expect(screen.getByText(/this scan needs 5, you have 3 left/)).toBeTruthy()
    expect(continueBtn().disabled).toBe(true)
  })

  it('allows the scan once the selection fits what is left', () => {
    const { onConfirm } = setup({ remaining: 3 })
    fireEvent.click(screen.getByLabelText('Page 5'))
    fireEvent.click(screen.getByLabelText('Page 4'))
    expect(continueBtn().disabled).toBe(false)
    fireEvent.click(continueBtn())
    expect(onConfirm).toHaveBeenCalledWith([0, 1, 2])
  })

  it('does not gate when the remaining count is unknown — the backend 402 is the guard', () => {
    setup()
    expect(screen.queryByText(/Not enough documents/)).toBeNull()
    expect(continueBtn().disabled).toBe(false)
  })

  it('still blocks an empty selection', () => {
    setup({ remaining: 99 })
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(continueBtn().disabled).toBe(true)
  })
})
