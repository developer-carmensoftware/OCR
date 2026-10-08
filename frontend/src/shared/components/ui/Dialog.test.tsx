import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Dialog from './Dialog'

function Harness({ onDismiss }: { onDismiss: (() => void) | null }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Dialog
          title="Create API key"
          onDismiss={onDismiss}
          footer={<button onClick={() => setOpen(false)}>Done</button>}
        >
          <input aria-label="Name" />
        </Dialog>
      )}
    </>
  )
}

describe('Dialog', () => {
  it('is a labelled modal that takes focus and gives it back on close', () => {
    render(<Harness onDismiss={vi.fn()} />)
    const opener = screen.getByText('Open')
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Create API key' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Name')).toHaveFocus()

    fireEvent.click(screen.getByText('Done'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('calls onDismiss on Escape, from anywhere on the page', () => {
    const onDismiss = vi.fn()
    render(<Harness onDismiss={onDismiss} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('ignores Escape and the backdrop when it must be closed on purpose', () => {
    render(<Harness onDismiss={null} />)
    fireEvent.click(screen.getByText('Open'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.click(document.querySelector('.ui-dialog-backdrop')!)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('keeps Tab inside the box', () => {
    render(<Harness onDismiss={vi.fn()} />)
    fireEvent.click(screen.getByText('Open'))
    const done = screen.getByText('Done')
    done.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByLabelText('Name')).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(done).toHaveFocus()
  })
})

describe('Dialog returnFocus', () => {
  it('sends focus where the caller says when the opener is about to disappear', () => {
    function RowHarness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <div data-testid="table" tabIndex={-1} />
          <button onClick={() => setOpen(true)}>Revoke</button>
          {open && (
            <Dialog
              title="Revoke API key"
              onDismiss={vi.fn()}
              returnFocus={() => screen.getByTestId('table')}
              footer={<button onClick={() => setOpen(false)}>Confirm</button>}
            >
              <p>Sure?</p>
            </Dialog>
          )}
        </>
      )
    }
    render(<RowHarness />)
    fireEvent.click(screen.getByText('Revoke'))
    fireEvent.click(screen.getByText('Confirm'))
    expect(screen.getByTestId('table')).toHaveFocus()
  })
})
