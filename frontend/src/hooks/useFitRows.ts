import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * Height of what sits under a list and must not be covered: its own following siblings,
 * plus its parent's. Two levels because that is what the real shapes need — a pager
 * next to the list (`<ul>` then `<nav>`), and one a level out (`<tbody>` inside
 * `<table>`, pager after the table). Measured, never a guessed pixel reserve.
 */
function spaceBelow(el: HTMLElement): number {
  let h = 0
  for (const start of [el, el.parentElement]) {
    let sib = start?.nextElementSibling
    while (sib) {
      h += (sib as HTMLElement).offsetHeight
      sib = sib.nextElementSibling
    }
  }
  return h
}

/**
 * How many rows fit in the space a list actually has on screen.
 *
 * Nothing here hardcodes a row height or a page size: it measures a rendered row and
 * the list's own gap, so it stays right when the font, the density, or the row's
 * content changes. Re-measures on resize.
 *
 * Returns a **callback ref**, not a plain one — the lists this measures mount and
 * unmount (a dropdown panel, a skeleton swapped for real rows), and a plain ref would
 * not re-run the measurement when the element appeared.
 *
 * Chicken-and-egg: a row must exist before it can be measured, so the first fetch uses
 * `fallback` and the real count lands one render later. Point the ref at the skeleton
 * list too where there is one — skeletons are built to the same geometry, so the
 * measurement is already right by the time the first page arrives.
 *
 * The count only ever GROWS for a given viewport. Where it feeds a fetch, the rows it
 * asks for change the space left below the list, so a smaller measurement is usually
 * this hook reacting to its own output: 8 rows leave room measuring 7, 7 leave room
 * measuring 8, and the caller fetches forever (Order History and the notification bell
 * both hit the API's rate limit this way). A real resize clears the mark and the list
 * re-measures from scratch; a shrink we caused ourselves is ignored, which is what
 * makes the sequence terminate.
 */
export function useFitRows(
  rowSelector: string,
  fallback: number
): [rows: number, ref: (el: HTMLElement | null) => void] {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [rows, setRows] = useState(fallback)
  const mark = useRef({ viewport: '', rows: 0 })

  const measure = useCallback(() => {
    const row = el?.querySelector<HTMLElement>(rowSelector)
    if (!el || !row) return
    const rowH = row.getBoundingClientRect().height
    if (rowH <= 0) return // display:none, or measured before layout

    const style = getComputedStyle(el)
    const gap = parseFloat(style.rowGap) || 0
    // A scroll container is bounded by its own box. A list that grows down the page is
    // bounded by what is left between its top and the bottom of the window, minus
    // whatever sits under it — measured off the next sibling (the pager), not guessed.
    const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll'
    const avail = scrolls
      ? el.clientHeight
      : window.innerHeight - el.getBoundingClientRect().top - spaceBelow(el)

    // +gap on both sides: n rows carry n-1 gaps, so the gap belongs to every row but
    // the last one.
    const fits = Math.max(1, Math.floor((avail + gap) / (rowH + gap)))

    const viewport = `${window.innerWidth}x${window.innerHeight}`
    if (mark.current.viewport !== viewport) mark.current = { viewport, rows: 0 }
    if (fits <= mark.current.rows) return
    mark.current.rows = fits
    setRows(fits)
  }, [el, rowSelector])

  useLayoutEffect(() => {
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [el, measure])

  return [rows, setEl]
}
