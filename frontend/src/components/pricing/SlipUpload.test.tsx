// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import SlipUpload from './SlipUpload'

// framer-motion's useReducedMotion reads window.matchMedia, which jsdom lacks.
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

const SLIP = new File(['x'], 'slip.png', { type: 'image/png' })
const WARNING = 'Your monthly quota changes from 1,000 to 100 documents.'

function renderUpload(props: Partial<Parameters<typeof SlipUpload>[0]> = {}) {
  const onUpload = vi.fn().mockResolvedValue(undefined)
  render(
    <LanguageProvider>
      <SlipUpload onUpload={onUpload} uploading={false} initialFile={SLIP} {...props} />
    </LanguageProvider>
  )
  // `initialFile` starts the component in its chosen-file state, so the Confirm
  // button is on screen without needing a file-picker interaction jsdom can't do.
  return { onUpload, confirm: () => screen.getByRole('button', { name: 'Confirm payment' }) }
}

/**
 * The guard lives in this component rather than in its two callers, because the
 * pending-order banner reaches this same button without passing through checkout.
 * These tests pin that it actually gates the upload, not just renders a message.
 */
describe('SlipUpload plan-change confirmation', () => {
  it('uploads straight away when there is nothing to warn about', async () => {
    const { onUpload, confirm } = renderUpload()

    fireEvent.click(confirm())

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(SLIP))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('holds the upload behind a dialog when a warning is set', async () => {
    const { onUpload } = renderUpload({ warning: WARNING })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }))

    expect(await screen.findByRole('dialog')).toBeTruthy()
    // The point of the whole change: the slip has NOT gone anywhere yet.
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('cancelling the dialog leaves the slip unsent', async () => {
    const { onUpload } = renderUpload({ warning: WARNING })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // The dialog closes, but the warning stays up as a standing banner — it isn't only
    // a one-shot confirm gate, so cancelling doesn't hide the fact that this is a
    // downgrade.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText(WARNING)).toBeTruthy()
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('shows the warning as a standing banner even before the dialog opens', () => {
    renderUpload({ warning: WARNING })

    expect(screen.getByText(WARNING)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('confirming in the dialog uploads exactly once', async () => {
    const { onUpload } = renderUpload({ warning: WARNING })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }))
    await screen.findByRole('dialog')

    // Two Confirm buttons exist now — the card's and the dialog's. The dialog's is
    // the last in document order, and it is the one wired to the real upload.
    const buttons = screen.getAllByRole('button', { name: 'Confirm payment' })
    fireEvent.click(buttons[buttons.length - 1])

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1))
    expect(onUpload).toHaveBeenCalledWith(SLIP)
  })
})
