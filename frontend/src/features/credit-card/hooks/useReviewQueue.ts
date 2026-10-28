import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listActivity,
  type ActivityFilter,
  type ReviewDocument,
} from '@/features/credit-card/api/emailReview'
/** Where the page opens before the counts have said otherwise: the work. */
const REVIEW: ActivityFilter = 'review'

export interface ReviewQueueController {
  /** Never null: the page opens on `review` and falls through to `all` when nothing is
   *  waiting (see the fetch effect). `loading` covers the fall-through, so the strip does
   *  not visibly hop. */
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
 * The activity page's data, in one hook: `listActivity` returns the window AND the chip
 * counts, refetched whenever the filter, size or offset moves.
 *
 * There used to be a second call, `getReviewStatus`, whose only reader was the email
 * forwarding pitch. That screen is gone, and so is the call — whether a BU has scanned
 * anything at all is `counts.all`, which this one already answers.
 */
export function useReviewQueue(
  limit: number,
  /** Skips the fall-through below and opens straight on this filter — how the bell's
   *  blocked/failed rows land on All filtered to `unposted` (`ReviewQueue.tsx`'s
   *  `filterFromHash`). Read once, on mount, same as every other opening decision here. */
  initialFilter?: ActivityFilter | null
): ReviewQueueController {
  // The page opens on the work: it is for what somebody here has to do (§24).
  const [filter, setFilterState] = useState<ActivityFilter>(initialFilter || REVIEW)
  // Whether the opening chip has been settled. The fall-through runs once, so a refresh
  // never throws the reader back to the top and neither does working a chip down to zero.
  // Already settled when the caller named a filter explicitly — the fall-through exists to
  // guess one, and there is nothing to guess.
  const landed = useRef(!!initialFilter)
  const [rows, setRows] = useState<ReviewDocument[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  // Content, and — on the very first response — where the page should have opened.
  useEffect(() => {
    let alive = true
    let hopped = false
    setLoading(true)
    listActivity(filter, limit, offset)
      .then(page => {
        if (!alive) return

        // **The opening chip, settled from the counts rather than guessed at.**
        //
        // Review first, because the work is what the page is for. But a BU that scans by
        // hand, or posts without review, has nothing there ever — landing it on "All clear"
        // every morning is a page with nothing to read, so an empty Review hands over to
        // the log.
        //
        // It costs one extra request and only when Review is empty: every chip's count
        // arrives with this first response. Nothing is painted on the way past — `hopped`
        // holds `loading` on, so the reader never sees an empty table flash before the one
        // they land on.
        if (!landed.current) {
          landed.current = true
          if (!page.counts.review) {
            hopped = true
            setFilterState('all')
            return
          }
        }

        setRows(page.data)
        setTotal(page.total)
        setCounts(page.counts)
        setError(false)
      })
      .catch(() => {
        if (alive) setError(true)
      })
      .finally(() => {
        // Not while hopping: the effect is about to run again for the chip we fell through
        // to, and clearing this in between is what would flash the empty state.
        if (alive && !hopped) setLoading(false)
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
  // the BU may have cleared it while this was open. Cheap: one small read.
  useEffect(() => {
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  return {
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
