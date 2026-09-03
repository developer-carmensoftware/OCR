import { useCallback, useState } from 'react'

/**
 * How many rows a table shows per page — the reader's choice, remembered.
 *
 * This replaced `useFitRows`, which measured the viewport instead. Measuring read well
 * on paper and behaved badly in practice: where the count fed a server fetch, the rows
 * it asked for changed the space left below the table, so 15 rows left room measuring
 * 17 and 17 left room measuring 15 — a fetch loop that needed a monotonic high-water
 * guard to terminate. A number the reader picked cannot oscillate.
 *
 * One global key, not one per table and NOT `appKey()`. `lib/storage.ts` draws the line
 * this side of: a density preference is a UI setting like `theme` and `lang`, not
 * tenant-scoped business data, so it must survive logout and never needs wiping. And
 * somebody who wants 50 rows wants 50 rows everywhere.
 */

export const ROWS_PER_PAGE = [10, 15, 25, 50, 100] as const

const KEY = 'rowsPerPage'
const DEFAULT = 15

/**
 * The stored size, or `fallback` (15). Exported because it must be readable
 * **synchronously**, before the first render: `useTableQuery` seeds its default from it so
 * the very first fetch already carries the right limit instead of asking for 25 and
 * immediately asking again. `fallback` is for a list that should start smaller than the
 * app-wide default — the review queue, which must fit the first screen without scrolling.
 */
export function readRowsPerPage(fallback: number = DEFAULT): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    // Anything not on the list — a hand-edited value, an option we have since dropped —
    // falls back rather than being sent to an endpoint that would 422 it.
    return (ROWS_PER_PAGE as readonly number[]).includes(n) ? n : fallback
  } catch {
    return fallback // storage unavailable (private window, blocked site data)
  }
}

/**
 * Remember a choice made somewhere that already owns the limit as state — `useTableQuery`
 * keeps it in the URL, so it needs the write without the `useState` this hook would add.
 */
export function writeRowsPerPage(n: number): void {
  try {
    localStorage.setItem(KEY, String(n))
  } catch {
    /* storage unavailable — the choice still applies to this session */
  }
}

/** The choice as state, for a list that has nowhere else to keep it. */
export function useRowsPerPage(fallback?: number): [number, (n: number) => void] {
  const [rows, setRows] = useState(() => readRowsPerPage(fallback))

  const choose = useCallback((n: number) => {
    writeRowsPerPage(n)
    setRows(n)
  }, [])

  return [rows, choose]
}
