import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { useFitRows } from './useFitRows'

/**
 * Regression: a list whose page size is measured, and whose fetch is driven by that
 * size, fetched forever — 8 rows left room measuring 7, 7 left room measuring 8. Order
 * History and the notification bell both walked into the API's rate limit that way.
 *
 * jsdom lays nothing out and its ResizeObserver is a no-op stub, so the oscillation is
 * faked: row height is fixed, the space below the list flips with the number of rows
 * currently rendered, and `resize` stands in for the observer prod fires on every
 * content change.
 */
function List({ onLimit }: { onLimit: (n: number) => void }) {
  const [fits, ref] = useFitRows('li', 4)
  onLimit(fits)
  return (
    <>
      <ul ref={ref}>
        {Array.from({ length: fits }, (_, i) => (
          <li key={i}>row</li>
        ))}
      </ul>
      {/* the pager useFitRows subtracts — its height is what flips below */}
      <nav />
    </>
  )
}

describe('useFitRows', () => {
  it('settles instead of oscillating with its own row count', async () => {
    const ROW_H = 10
    let rendered = 0
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const h = this.tagName === 'LI' ? ROW_H : 0
      return { height: h, top: 0, bottom: h, left: 0, right: 0, width: 0, x: 0, y: 0 } as DOMRect
    })
    // The pager sits 10px lower when 8 rows are on screen than when 7 are — exactly the
    // feedback that made the measurement flip.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return this.tagName === 'NAV' ? (rendered === 8 ? 30 : 20) : 0
    })
    vi.stubGlobal('innerHeight', 100)

    const limits: number[] = []
    render(
      <List
        onLimit={n => {
          rendered = n
          limits.push(n)
        }}
      />
    )

    await waitFor(() => expect(limits.length).toBeGreaterThan(1))
    for (let i = 0; i < 6; i++) {
      window.dispatchEvent(new Event('resize'))
      await new Promise(r => setTimeout(r, 5))
    }
    // fallback, then at most one correction once the real measurement lands — never a
    // second distinct size, which is what a flip-flop would leave behind.
    expect(new Set(limits).size).toBeLessThanOrEqual(2)

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})
