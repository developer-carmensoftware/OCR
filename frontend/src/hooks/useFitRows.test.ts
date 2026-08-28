import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFitRows } from './useFitRows'

/**
 * jsdom lays nothing out — every box is 0×0 — so the geometry is stubbed and what is
 * under test is the arithmetic: available space ÷ row height, with the list's gap
 * counted for every row but the last.
 */
function buildList({
  rowHeight,
  gap,
  overflowY,
  clientHeight,
  top,
  siblingHeight,
}: {
  rowHeight: number
  gap: string
  overflowY: string
  clientHeight: number
  top: number
  siblingHeight?: number
}) {
  const ul = document.createElement('ul')
  const row = document.createElement('li')
  ul.appendChild(row)
  document.body.appendChild(ul)

  row.getBoundingClientRect = () => ({ height: rowHeight }) as DOMRect
  ul.getBoundingClientRect = () => ({ top }) as DOMRect
  Object.defineProperty(ul, 'clientHeight', { value: clientHeight, configurable: true })

  if (siblingHeight !== undefined) {
    const pager = document.createElement('nav')
    document.body.appendChild(pager)
    Object.defineProperty(pager, 'offsetHeight', { value: siblingHeight, configurable: true })
  }

  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    rowGap: gap,
    overflowY,
  } as CSSStyleDeclaration)

  return ul
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useFitRows', () => {
  it('starts at the fallback until an element with a row exists', () => {
    const { result } = renderHook(() => useFitRows('li', 4))
    expect(result.current[0]).toBe(4)
  })

  it('a scroll container is bounded by its own box', () => {
    // 208 of usable space (200 + one gap) over 48 per row (40 + gap) → 4 rows.
    const ul = buildList({
      rowHeight: 40,
      gap: '8px',
      overflowY: 'auto',
      clientHeight: 200,
      top: 0,
    })
    const { result } = renderHook(() => useFitRows('li', 4))
    act(() => result.current[1](ul))
    expect(result.current[0]).toBe(4)
  })

  it('counts the gap for every row but the last', () => {
    // Without the +gap on the numerator this floors to 3, losing a row that does fit.
    const ul = buildList({
      rowHeight: 40,
      gap: '8px',
      overflowY: 'auto',
      clientHeight: 184,
      top: 0,
    })
    const { result } = renderHook(() => useFitRows('li', 1))
    act(() => result.current[1](ul))
    expect(result.current[0]).toBe(4) // 4 rows = 160px + 3 gaps = 184px exactly
  })

  it('a list that grows down the page is bounded by the window, minus what sits under it', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    // 800 − 100 top − 40 pager = 660 available; (660 + 0) / 60 → 11 rows.
    const ul = buildList({
      rowHeight: 60,
      gap: '0px',
      overflowY: 'visible',
      clientHeight: 9999, // the list's own height is irrelevant here — that is the point
      top: 100,
      siblingHeight: 40,
    })
    const { result } = renderHook(() => useFitRows('li', 4))
    act(() => result.current[1](ul))
    expect(result.current[0]).toBe(11)
  })

  it('never asks for zero rows, however little room there is', () => {
    const ul = buildList({ rowHeight: 90, gap: '0px', overflowY: 'auto', clientHeight: 10, top: 0 })
    const { result } = renderHook(() => useFitRows('li', 4))
    act(() => result.current[1](ul))
    expect(result.current[0]).toBe(1)
  })
})
