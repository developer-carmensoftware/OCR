import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listNotifications,
  markNotificationsRead,
  type BellItem,
  type Notification,
} from '../../lib/api/notifications'
import { RELEASE_NOTES } from '../../content/releaseNotes'
import { markReleaseSeen, readReleaseSeen, RELEASE_SEEN_EVENT } from '../../lib/releaseNotesSeen'

// ponytail: 5 min, not 60s. Nothing here is time-critical — a bell row appears
// only after an admin touches an order — and the focus listener below already
// refreshes the moment the user comes back to the tab.
const POLL_MS = 300_000

// The bell is a dropdown, not an inbox: one screenful per page.
const PAGE_SIZE = 8

const RELEASE_ID_PREFIX = 'release:'

/**
 * The newest release note as a single bell row, or nothing if the list is empty.
 *
 * ponytail: one row, not a backlog. The row is a doorway to #/whats-new, which
 * lists every release — three doorways to the same page would just be clutter.
 */
function releaseRow(seen: string): BellItem[] {
  const latest = RELEASE_NOTES[0]
  if (!latest) return []
  return [
    {
      id: `${RELEASE_ID_PREFIX}${latest.date}`,
      order_id: null,
      type: 'release_note',
      payload: { en: latest.en, th: latest.th },
      read_at: latest.date > seen ? null : latest.date,
      // +07:00, not Z: the dates are hand-written in ICT, and tagging them UTC
      // would report a release shipped this morning as 7 hours old.
      created_at: `${latest.date}T00:00:00+07:00`,
    },
  ]
}

export function useNotifications() {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [seen, setSeen] = useState(readReleaseSeen)
  // One window at a time, moved by the pager. ponytail: offset paging, so a row
  // arriving while the reader sits on page 2 shifts what page 2 holds. Harmless for
  // an append-only bell at our volumes; keyset on (created_at, id) if it ever bites.
  const [offset, setOffset] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const page = await listNotifications(PAGE_SIZE, offset)
      setItems(page.data)
      setTotal(page.total)
      setUnreadCount(page.unread_count)
    } catch {
      // silent — bell just shows stale data
    }
  }, [isAuthenticated, offset])

  useEffect(() => {
    if (!isAuthenticated) return
    refresh()
    const tick = () => {
      refresh()
      timerRef.current = setTimeout(tick, POLL_MS)
    }
    timerRef.current = setTimeout(tick, POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('focus', refresh)
    }
  }, [isAuthenticated, refresh])

  // The What's New page clears the mark on mount; this is how the badge behind it
  // finds out without a poll.
  useEffect(() => {
    const sync = () => setSeen(readReleaseSeen())
    window.addEventListener(RELEASE_SEEN_EVENT, sync)
    return () => window.removeEventListener(RELEASE_SEEN_EVENT, sync)
  }, [])

  // The release row PINS to the top rather than sorting in by date: a hand-written
  // date and a server timestamp are two different clocks, and sorting them together
  // buries a fresh release under the morning's order notifications.
  const releases = useMemo(() => releaseRow(seen), [seen])
  // Page 1 only: the row is pinned to the top of the LIST, not repeated at the top of
  // every page — on page 3 it would read as a third release.
  const merged = useMemo<BellItem[]>(
    () => (offset === 0 ? [...releases, ...items] : items),
    [releases, items, offset]
  )

  // Derived, never stored: refresh() overwrites unreadCount from the server on every
  // poll, so folding the release delta INTO that state would drift on a timer. Counted
  // off `releases`, not `merged` — the badge is global, so paging must not change it.
  const unseenReleases = releases.reduce((n, r) => n + (r.read_at ? 0 : 1), 0)

  const markRead = useCallback(
    async (ids?: string[]) => {
      // No ids = mark everything, which includes the release note.
      if (!ids) {
        markReleaseSeen(RELEASE_NOTES[0]?.date ?? '')
        await markNotificationsRead()
        await refresh()
        return
      }

      const releaseDates = ids
        .filter(id => id.startsWith(RELEASE_ID_PREFIX))
        .map(id => id.slice(RELEASE_ID_PREFIX.length))
      if (releaseDates.length) markReleaseSeen(releaseDates.reduce((a, b) => (a > b ? a : b)))

      const serverIds = ids.filter(id => !id.startsWith(RELEASE_ID_PREFIX))
      // An all-synthetic call has nothing for the API. Returning here also avoids
      // POSTing `ids: []`, whose server-side meaning is not worth discovering.
      if (!serverIds.length) return
      await markNotificationsRead(serverIds)
      await refresh()
    },
    [refresh]
  )

  return {
    items: merged,
    unreadCount: unreadCount + unseenReleases,
    // Pager state: `total` counts server rows only, which is what `offset` indexes —
    // the release row is client-side and never part of it.
    offset,
    limit: PAGE_SIZE,
    total,
    setOffset,
    markRead,
    refresh,
  }
}
