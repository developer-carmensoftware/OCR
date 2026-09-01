import { useCallback, useEffect, useState } from 'react'
import {
  getReviewStatus,
  listActivity,
  type ActivityFilter,
  type ReviewDocument,
  type ReviewStatus,
} from '../../lib/api/emailReview'

export interface ReviewQueueController {
  /** null until the first status fetch lands. The page must not choose which state to
   *  paint before then — see `loading`. */
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
 * Two calls on two different clocks. `getReviewStatus` is **configuration** — enabled /
 * entitled / ingest_address / blockers — which cannot change because someone turned a
 * page, so it is fetched once per refresh and not per page. Firing both together used to
 * cost two round trips per arrow click, one of which could never return anything new.
 *
 * `listActivity` is the **content**: the window AND the chip counts (it is the only source
 * that knows about manual scans), refetched whenever the filter, size or offset moves.
 *
 * They still share one `loading` flag, because they decide the same thing — which of the
 * page's four states to paint — and resolving them independently makes the page flip
 * through a wrong one on the way: the "not set up" screen appearing for a moment on a BU
 * that has twenty documents waiting. `loading` stays true until status has landed, which
 * is what forbids that.
 */
export function useReviewQueue(limit: number): ReviewQueueController {
  const [status, setStatus] = useState<ReviewStatus | null>(null)
  const [filter, setFilterState] = useState<ActivityFilter>('all')
  const [rows, setRows] = useState<ReviewDocument[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [offset, setOffset] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [statusLoaded, setStatusLoaded] = useState(false)
  // One flag per call, ORed below. Sharing a single flag would let a list success clear a
  // status failure — and without status the page cannot tell "all clear" from "not set up".
  const [listError, setListError] = useState(false)
  const [statusError, setStatusError] = useState(false)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  // Configuration. Not a function of the filter, the size, or the page — only of an
  // explicit refresh.
  useEffect(() => {
    let alive = true
    getReviewStatus()
      .then(s => {
        if (!alive) return
        setStatus(s)
        setStatusError(false)
      })
      .catch(() => {
        if (alive) setStatusError(true)
      })
      .finally(() => {
        if (alive) setStatusLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [nonce])

  // Content.
  useEffect(() => {
    let alive = true
    setListLoading(true)
    listActivity(filter, limit, offset)
      .then(page => {
        if (!alive) return
        setRows(page.data)
        setTotal(page.total)
        setCounts(page.counts)
        setListError(false)
      })
      .catch(() => {
        if (alive) setListError(true)
      })
      .finally(() => {
        if (alive) setListLoading(false)
      })
    return () => {
      alive = false
    }
  }, [filter, limit, offset, nonce])

  // One flag out of two clocks: the page may not decide which state to paint until the
  // configuration behind the not-set-up screen has actually arrived.
  const loading = listLoading || !statusLoaded
  const error = listError || statusError

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
