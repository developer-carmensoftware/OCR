import { useCallback, useEffect, useState } from 'react'
import {
  getReviewStatus,
  listActivity,
  type ActivityFilter,
  type ReviewDocument,
  type ReviewStatus,
} from '../../lib/api/emailReview'

export interface ReviewQueueController {
  status: ReviewStatus | null
  filter: ActivityFilter
  setFilter: (f: ActivityFilter) => void
  rows: ReviewDocument[]
  total: number
  /** Keyed by filter name. Every chip is present even at zero — one that appears only
   *  when it has rows makes the strip jump around as documents resolve. */
  counts: Record<string, number>
  offset: number
  setOffset: (n: number) => void
  loading: boolean
  /** A failed fetch is not an empty queue. The page renders a retry for this, never the
   *  empty state — "nothing is waiting" and "we could not ask" must never look alike. */
  error: boolean
  reload: () => void
}

/**
 * The automation page's data, in one hook.
 *
 * Two calls, one `loading` flag, because they decide the same thing: which of the page's
 * states to paint. Resolving them separately makes the page flip through a wrong state on
 * the way — the "not set up" screen appearing for a moment on a BU that has twenty
 * documents waiting.
 *
 * `listActivity` is the list AND the chip counts (it is the only source that knows about
 * manual scans); `getReviewStatus` is purely the configuration behind the not-set-up
 * screen — enabled / entitled / ingest_address / blockers.
 */
export function useReviewQueue(limit: number): ReviewQueueController {
  const [status, setStatus] = useState<ReviewStatus | null>(null)
  const [filter, setFilterState] = useState<ActivityFilter>('all')
  const [rows, setRows] = useState<ReviewDocument[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([getReviewStatus(), listActivity(filter, limit, offset)])
      .then(([s, page]) => {
        if (!alive) return
        setStatus(s)
        setRows(page.data)
        setTotal(page.total)
        setCounts(page.counts)
        setError(false)
      })
      .catch(() => {
        if (!alive) return
        setError(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [filter, limit, offset, nonce])

  // Switching filter always starts at the top. Keeping the offset would land someone on
  // page 3 of a filter that has two rows, which reads as an empty list.
  const setFilter = useCallback((next: ActivityFilter) => {
    setFilterState(next)
    setOffset(0)
  }, [])

  // Coming back to the tab is the moment a stale list is most obvious — someone else in
  // the BU may have cleared it while this was open. Cheap: two small reads.
  useEffect(() => {
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  return {
    status,
    filter,
    setFilter,
    rows,
    total,
    counts,
    offset,
    setOffset,
    loading,
    error,
    reload,
  }
}
