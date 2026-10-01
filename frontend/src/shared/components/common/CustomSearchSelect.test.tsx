import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CustomSearchSelect from './CustomSearchSelect'

const OPTIONS = [
  { code: 'GEN', name: 'General' },
  { code: 'FIN', name: 'Finance' },
  { code: 'OPS', name: 'Operations' },
]

/** The picker inside something that also listens for Escape — a dialog, as it is on the
 *  mapping page, where an Escape that got through cancelled every edit. */
function Picker({ onEscapeBehind = () => {} }: { onEscapeBehind?: () => void }) {
  const [value, setValue] = useState('')
  return (
    <div
      onKeyDown={e => {
        if (e.key === 'Escape') onEscapeBehind()
      }}
    >
      <CustomSearchSelect
        value={value}
        onChange={setValue}
        options={OPTIONS}
        aria-label="Department"
      />
      <output data-testid="value">{value}</output>
    </div>
  )
}

function openPicker() {
  const input = screen.getByLabelText('Department')
  input.focus()
  fireEvent.click(input)
  return input
}

const listShown = () => screen.queryByText(/General/) !== null

describe('CustomSearchSelect — by keyboard', () => {
  it('reaches the options with ArrowDown, moves through them, and picks with Enter', () => {
    render(<Picker />)
    const input = openPicker()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement).toHaveTextContent('GEN')
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
    expect(document.activeElement).toHaveTextContent('FIN')
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowUp' })
    expect(document.activeElement).toHaveTextContent('GEN')
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' })

    expect(screen.getByTestId('value')).toHaveTextContent('FIN')
    // Back on the field, list closed: the option that had focus is gone, and focus left on
    // <body> puts a keyboard user back at the top of the page.
    expect(document.activeElement).toBe(input)
    expect(listShown()).toBe(false)
  })

  it('closes its list when Tab moves on, instead of leaving it open behind', () => {
    render(<Picker />)
    const input = openPicker()
    expect(listShown()).toBe(true)

    fireEvent.keyDown(input, { key: 'Tab' })

    expect(listShown()).toBe(false)
  })

  it('keeps Escape on an option to itself: closes the list, not the dialog behind it', () => {
    // The list is portaled to <body>, but React events still bubble through the component
    // tree — so an Escape on an option reached the payment-type dialog and cancelled it.
    const behind = vi.fn()
    render(<Picker onEscapeBehind={behind} />)
    const input = openPicker()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement).toHaveTextContent('GEN') // on an option, in the portal

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

    expect(behind).not.toHaveBeenCalled()
    expect(listShown()).toBe(false)
    expect(document.activeElement).toBe(input)
  })

  // The app scrolls smoothly (`html { scroll-behavior: smooth }`), so focusing a field that
  // is off screen opens its list and *then* scrolls the field into view — and the list
  // closed on the first frame of that scroll. Measured on the mapping page 2026-09-30: open
  // at 15 ms, closed at 32 ms, never seen.
  it('stays open while the page scrolls its field into view, following the field', () => {
    render(<Picker />)
    openPicker()
    const panel = () => document.querySelector('.css-select-panel') as HTMLElement | null
    const field = screen.getByLabelText('Department').parentElement as HTMLElement
    field.getBoundingClientRect = () =>
      ({ top: 300, bottom: 338, left: 40, width: 200, height: 38, right: 240 }) as DOMRect

    fireEvent.scroll(document)

    expect(panel()).not.toBeNull()
    expect(panel()?.style.top).toBe('342px') // 4px under the field where it is now
  })

  it('goes off screen with its field, rather than floating free', () => {
    // No closing on scroll at all: a field on its way *into* view is off screen on the
    // first frames of the scroll that reveals it, exactly like one on its way out.
    render(<Picker />)
    openPicker()
    const field = screen.getByLabelText('Department').parentElement as HTMLElement
    field.getBoundingClientRect = () =>
      ({ top: -120, bottom: -82, left: 40, width: 200, height: 38, right: 240 }) as DOMRect

    fireEvent.scroll(document)

    const panel = document.querySelector('.css-select-panel') as HTMLElement
    expect(panel.style.top).toBe('-78px')
  })

  // Inside a scrolling box (the payment-type dialog's body) the field can leave the box
  // while still being on screen, and a list that follows it would float over the header.
  it('closes when a scrolling container takes its field out of the container', () => {
    const { container } = render(
      <div data-testid="box">
        <Picker />
      </div>
    )
    const box = container.querySelector('[data-testid="box"]') as HTMLElement
    openPicker()
    const field = screen.getByLabelText('Department').parentElement as HTMLElement
    box.getBoundingClientRect = () => ({ top: 100, bottom: 400 }) as DOMRect
    field.getBoundingClientRect = () =>
      ({ top: 420, bottom: 458, left: 40, width: 200, height: 38, right: 240 }) as DOMRect

    fireEvent.scroll(box)

    expect(listShown()).toBe(false)
  })

  it('keeps following its field while it is still inside the scrolling container', () => {
    const { container } = render(
      <div data-testid="box">
        <Picker />
      </div>
    )
    const box = container.querySelector('[data-testid="box"]') as HTMLElement
    openPicker()
    const field = screen.getByLabelText('Department').parentElement as HTMLElement
    box.getBoundingClientRect = () => ({ top: 100, bottom: 400 }) as DOMRect
    field.getBoundingClientRect = () =>
      ({ top: 200, bottom: 238, left: 40, width: 200, height: 38, right: 240 }) as DOMRect

    fireEvent.scroll(box)

    expect((document.querySelector('.css-select-panel') as HTMLElement).style.top).toBe('242px')
  })

  it('keeps Tab out of the options, which sit at the end of <body>', () => {
    render(<Picker />)
    openPicker()

    const options = [...document.querySelectorAll('.css-select-panel [role="button"]')]
    expect(options.length).toBe(3)
    options.forEach(o => expect(o).toHaveAttribute('tabindex', '-1'))
  })
})
