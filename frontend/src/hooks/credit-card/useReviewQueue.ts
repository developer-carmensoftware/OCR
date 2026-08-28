import { useCallback, useEffect, useState } from 'react'
import {
  getReviewStatus,
  listPending,
  type ReviewDocument,
  type ReviewStatus,
} from '../../lib/api/emailReview'

export interface ReviewQueueController {
  status: ReviewStatus | null
  rows: ReviewDocument[]
  total: number
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
 * Status and rows are fetched together and gated on one `loading` flag, because they
 * decide the same thing: which of the page's four states to paint. Resolving them
 * separately makes the page flip through a wrong state on the way — the "not set up"
 * screen appearing for a moment on a BU that has twenty documents waiting.
 */
export function useReviewQueue(limit: number): ReviewQueueController {
  const [status, setStatus] = useState<ReviewStatus | null>(null)
  const [rows, setRows] = useState<ReviewDocument[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([getReviewStatus(), listPending(limit, offset)])
      .then(([s, page]) => {
        if (!alive) return
        setStatus(s)
        setRows(page.data)
        setTotal(page.total)
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
  }, [limit, offset, nonce])

  // Coming back to the tab is the moment a stale queue is most obvious — someone else in
  // the BU may have cleared it while this was open. Cheap: two small reads.
  useEffect(() => {
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  return { status, rows, total, offset, setOffset, loading, error, reload }
}
