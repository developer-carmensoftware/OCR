import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  listNotifications,
  markNotificationsRead,
  type Notification,
} from '../../lib/api/notifications'

const POLL_MS = 60_000

export function useNotifications() {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
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

  const markRead = useCallback(
    async (ids?: string[]) => {
      await markNotificationsRead(ids)
      await refresh()
    },
    [refresh]
  )

  return { items, unreadCount, markRead, refresh }
}
