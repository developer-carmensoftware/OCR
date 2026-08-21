import { apiFetch } from './client'
import { API } from './endpoints'
import type { Page } from './page'

export interface Notification {
  id: string
  order_id: string | null
  // Order lifecycle first, then the email-automation outcomes (emitted by
  // `_finish` in email_ingest_service.py — "skipped" deliberately does not notify).
  type: 'approved' | 'rejected' | 'on_hold' | 'missing_slip' | 'document_posted' | 'document_failed'
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

/**
 * A row in the bell: server notifications plus client-synthesized release notes.
 * Release notes borrow the server's field names so the list renders one row shape
 * with no parallel branch — their bilingual copy rides in `payload`. They are
 * never returned by the API; see content/releaseNotes.ts for why they aren't rows.
 */
export interface BellItem extends Omit<Notification, 'type'> {
  type: Notification['type'] | 'release_note'
}

/** A page of notifications plus the badge count, which spans every row, not the page. */
export interface NotificationList extends Page<Notification> {
  unread_count: number
}

export async function listNotifications(limit = 8): Promise<NotificationList> {
  const res = await apiFetch(`${API.notifications.list}?limit=${limit}`)
  if (!res.ok) throw new Error(`Notifications fetch failed (${res.status})`)
  return res.json() as Promise<NotificationList>
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await apiFetch(API.notifications.markRead, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ids ?? null }),
  })
}
