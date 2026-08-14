import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShoppingCart } from 'lucide-react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import TutorialModal, { boldify } from './TutorialModal'
import { Spot } from './Spot'
import type { TutorialStep } from './types'

/** A figure with two spottable elements, so "which one is lit" is a real question. */
function Figure() {
  return (
    <>
      <Spot id="one">
        <span>first thing</span>
      </Spot>
      <Spot id="two">
        <span>second thing</span>
      </Spot>
    </>
  )
}

const STEPS: TutorialStep[] = [
  {
    spot: 'one',
    icon: ShoppingCart,
    figure: <Figure />,
    en: { title: 'One', heading: 'Head one', body: ['Body **one**'] },
    th: { title: 'หนึ่ง', heading: 'หัวข้อหนึ่ง', body: ['เนื้อหาหนึ่ง'] },
  },
  {
    spot: 'two',
    icon: ShoppingCart,
    figure: <Figure />,
    en: { title: 'Two', heading: 'Head two', body: ['• Body two'] },
    th: { title: 'สอง', heading: 'หัวข้อสอง', body: ['• เนื้อหาสอง'] },
  },
]

const noop = () => {}

beforeEach(() => {
  localStorage.clear()
})

describe('TutorialModal', () => {
  it('opens on the first step', () => {
    render(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    expect(screen.getByText('Head one')).toBeInTheDocument()
    expect(screen.getByText('Step 1 / 2')).toBeInTheDocument()
  })

  it('walks forward and back', () => {
    render(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Head two')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByText('Head one')).toBeInTheDocument()
  })

  it('cannot step off either end', () => {
    render(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    expect(screen.getByRole('button', { name: /^back$/i })).toBeDisabled()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Head one')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Head two')).toBeInTheDocument()
  })

  it('lights only the element the current step names', () => {
    const { container } = render(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    // The visible ring is a measured overlay, and jsdom has no layout to measure;
    // `data-lit` is the semantic half, and the half a figure author can rely on.
    const lit = () => container.querySelectorAll('[data-spot][data-lit]')
    expect(lit()).toHaveLength(1)
    expect(lit()[0].getAttribute('data-spot')).toBe('one')
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(lit()).toHaveLength(1)
    expect(lit()[0].getAttribute('data-spot')).toBe('two')
  })

  it('keeps a shared figure mounted across the steps that share it', () => {
    const shared = <Figure />
    const steps: TutorialStep[] = [
      { ...STEPS[0], figure: shared },
      { ...STEPS[1], figure: shared },
    ]
    const { container } = render(<TutorialModal open onClose={noop} title="Guide" steps={steps} />)
    const canvas = () => container.querySelector('.tut-canvas')
    const before = canvas()
    expect(before).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    // Same DOM node: the screen does not blink, the camera moves across it.
    expect(canvas()).toBe(before)
  })

  it('frames the whole figure on a step with no spot', () => {
    const overview: TutorialStep[] = [{ ...STEPS[0], spot: undefined }, STEPS[1]]
    const { container } = render(
      <TutorialModal open onClose={noop} title="Guide" steps={overview} />
    )
    expect(container.querySelectorAll('[data-spot][data-lit]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(container.querySelectorAll('[data-spot][data-lit]')).toHaveLength(1)
  })

  it('jumps to any step from its pip', () => {
    render(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Two' }))
    expect(screen.getByText('Head two')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('aria-current', 'step')
  })

  it('fades out before it unmounts, from the close button and from the last step', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <TutorialModal open onClose={onClose} title="Guide" steps={STEPS} />
    )
    fireEvent.click(screen.getByRole('button', { name: /close tutorial/i }))
    // The exit plays while the dialog is still mounted; unmounting it first
    // (which `onClose` does) would cut the animation off.
    expect(container.querySelector('.tut')).toHaveClass('is-closing')
    expect(onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))

    // Last step: Next becomes Done, which closes rather than advancing.
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2))
  })

  it('closes at once when the animation is off', () => {
    localStorage.setItem('tutorial:calm', '1')
    const onClose = vi.fn()
    render(<TutorialModal open onClose={onClose} title="Guide" steps={STEPS} />)
    fireEvent.click(screen.getByRole('button', { name: /close tutorial/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the finish action only on the last step', () => {
    const onClick = vi.fn()
    render(
      <TutorialModal
        open
        onClose={noop}
        title="Guide"
        steps={STEPS}
        finish={{ label: 'Buy a package', onClick }}
      />
    )
    expect(screen.queryByRole('button', { name: 'Buy a package' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Buy a package' }))
    expect(onClick).toHaveBeenCalled()
  })

  it('restarts at step 1 the next time it is opened', () => {
    const { rerender } = render(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Head two')).toBeInTheDocument()
    rerender(<TutorialModal open={false} onClose={noop} title="Guide" steps={STEPS} />)
    rerender(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    expect(screen.getByText('Head one')).toBeInTheDocument()
  })

  it('turns the animation off from its own header, and remembers it', () => {
    const { container, unmount } = render(
      <TutorialModal open onClose={noop} title="Guide" steps={STEPS} />
    )
    const toggle = () => screen.getByRole('button', { name: /calm/i })
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('.tut')).toHaveClass('is-calm')

    // The person who needed it should not have to find it twice.
    unmount()
    render(<TutorialModal open onClose={noop} title="Guide" steps={STEPS} />)
    expect(screen.getByRole('button', { name: /calm/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders Thai copy for the same steps', () => {
    localStorage.setItem('lang', 'th')
    render(
      <LanguageProvider>
        <TutorialModal open onClose={noop} title="คู่มือ" steps={STEPS} />
      </LanguageProvider>
    )
    expect(screen.getByText('หัวข้อหนึ่ง')).toBeInTheDocument()
    expect(screen.queryByText('Head one')).not.toBeInTheDocument()
  })
})

describe('boldify', () => {
  it('turns **text** into a strong run and leaves the rest alone', () => {
    const parts = boldify('a **b** c')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('a ')
    expect(parts[2]).toBe(' c')
    render(<p>{parts}</p>)
    expect(screen.getByText('b').tagName).toBe('STRONG')
  })

  it('leaves a line with no markers as one plain run', () => {
    expect(boldify('plain line')).toEqual(['plain line'])
  })
})
