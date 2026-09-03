import { render } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useScrollLock, __resetScrollLock } from './useScrollLock'

function Locker({ on = true, children }: { on?: boolean; children?: React.ReactNode }) {
  useScrollLock(on)
  return <>{children}</>
}

const overflow = () => document.body.style.overflow

describe('useScrollLock', () => {
  beforeEach(__resetScrollLock)

  it('locks while mounted and restores on unmount', () => {
    const { unmount } = render(<Locker />)
    expect(overflow()).toBe('hidden')
    unmount()
    expect(overflow()).toBe('')
  })

  it('does nothing while inactive', () => {
    render(<Locker on={false} />)
    expect(overflow()).toBe('')
  })

  // The bug, shape 1: ReviewDocument holds a lock for its whole life and its reject/discard
  // confirmation is a second one — and confirming tears both down in the same commit. The
  // inner lock used to put back the 'hidden' it had seen on the way in, leaving the page
  // unscrollable with nothing on screen to explain it.
  it('restores when a page lock and a dialog inside it go away together', () => {
    const { rerender } = render(
      <Locker on>
        <Locker on={false} />
      </Locker>
    )
    rerender(
      <Locker on>
        <Locker on />
      </Locker>
    )
    rerender(<div />)
    expect(overflow()).toBe('')
  })

  // Shape 2, siblings: a loading overlay and an error dialog overlapping on the same page,
  // released in the order the user happens to dismiss them rather than in LIFO.
  it('stays locked until the last of two overlapping locks lets go', () => {
    const { rerender } = render(
      <>
        <Locker on />
        <Locker on={false} />
      </>
    )
    rerender(
      <>
        <Locker on />
        <Locker on />
      </>
    )
    rerender(
      <>
        <Locker on={false} />
        <Locker on />
      </>
    )
    expect(overflow()).toBe('hidden')
    rerender(
      <>
        <Locker on={false} />
        <Locker on={false} />
      </>
    )
    expect(overflow()).toBe('')
  })
})
