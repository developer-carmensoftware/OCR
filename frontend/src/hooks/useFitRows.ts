import { useCallback, useLayoutEffect, useState } from 'react'

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
 */
export function useFitRows(
  rowSelector: string,
  fallback: number
): [rows: number, ref: (el: HTMLElement | null) => void] {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [rows, setRows] = useState(fallback)

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
    const below = (el.nextElementSibling as HTMLElement | null)?.offsetHeight ?? 0
    const avail = scrolls
      ? el.clientHeight
      : window.innerHeight - el.getBoundingClientRect().top - below

    // +gap on both sides: n rows carry n-1 gaps, so the gap belongs to every row but
    // the last one.
    setRows(Math.max(1, Math.floor((avail + gap) / (rowH + gap))))
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
