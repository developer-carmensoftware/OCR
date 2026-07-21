import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listNotifications,
  markNotificationsRead,
  type BellItem,
  type Notification,
} from '../../lib/api/notifications'
import { RELEASE_NOTES } from '../../content/releaseNotes'

const POLL_MS = 60_000

// Plain, un-namespaced key: "which release notes has this BROWSER seen" is a UI
// pref, not tenant business data. It deliberately bypasses lib/storage.ts so it
// survives logout and tenant switch — same human, same changelog.
const SEEN_KEY = 'releaseNotesSeen'

const RELEASE_ID_PREFIX = 'release:'

// ponytail: the bell is a notification list, not a changelog page. Three covers
// "I was on leave last week" without anyone having to build pagination.
const MAX_RELEASE_ITEMS = 3

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return '' // storage unavailable — everything reads as unseen
  }
}

/** Release notes as bell rows. Unread is a date compare against the seen mark. */
function releaseRows(seen: string): BellItem[] {
  return RELEASE_NOTES.slice(0, MAX_RELEASE_ITEMS).map(r => ({
    id: `${RELEASE_ID_PREFIX}${r.date}`,
    order_id: null,
    type: 'release_note',
    payload: { en: r.en, th: r.th },
    read_at: r.date > seen ? null : r.date,
    // +07:00, not Z: the dates are hand-written in ICT, and tagging them UTC
    // would report a release shipped this morning as 7 hours old.
    created_at: `${r.date}T00:00:00+07:00`,
  }))
}

export function useNotifications() {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [seen, setSeen] = useState(readSeen)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const data = await listNotifications()
      setItems(data.items)
      setUnreadCount(data.unread_count)
    } catch {
      // silent — bell just shows stale data
    }
  }, [isAuthenticated])

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

  // Release notes PIN to the top rather than interleaving by date: hand-written
  // dates and server timestamps are two different clocks, and sorting them
  // together buries a fresh release under the morning's order notifications.
  const releases = useMemo(() => releaseRows(seen), [seen])
  const merged = useMemo<BellItem[]>(() => [...releases, ...items], [releases, items])

  // Derived, never stored: refresh() overwrites unreadCount from the server every
  // 60s, so folding the release delta INTO that state would drift on a timer.
  const unseenReleases = releases.reduce((n, r) => n + (r.read_at ? 0 : 1), 0)

  const markSeen = useCallback(
    (date: string) => {
      if (!date || date <= seen) return
      try {
        localStorage.setItem(SEEN_KEY, date)
      } catch {
        // storage unavailable — the badge just returns next session
      }
      setSeen(date)
    },
    [seen]
  )

  const markRead = useCallback(
    async (ids?: string[]) => {
      // No ids = mark everything, which includes the release notes.
      if (!ids) {
        markSeen(RELEASE_NOTES[0]?.date ?? '')
        await markNotificationsRead()
        await refresh()
        return
      }

      const releaseDates = ids
        .filter(id => id.startsWith(RELEASE_ID_PREFIX))
        .map(id => id.slice(RELEASE_ID_PREFIX.length))
      // Reading an OLDER note must not clear newer ones, so advance to the max.
      if (releaseDates.length) markSeen(releaseDates.reduce((a, b) => (a > b ? a : b)))

      const serverIds = ids.filter(id => !id.startsWith(RELEASE_ID_PREFIX))
      // An all-synthetic call has nothing for the API. Returning here also avoids
      // POSTing `ids: []`, whose server-side meaning is not worth discovering.
      if (!serverIds.length) return
      await markNotificationsRead(serverIds)
      await refresh()
    },
    [refresh, markSeen]
  )

  return { items: merged, unreadCount: unreadCount + unseenReleases, markRead, refresh }
}
