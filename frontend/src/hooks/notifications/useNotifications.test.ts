import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Fixed content: the real file changes with every user-visible release, and this
// test is about the merge/seen logic, not about what shipped on any given day.
vi.mock('../../content/releaseNotes', () => ({
  RELEASE_NOTES: [
    { date: '2026-07-20', en: { title: 'New', items: ['a'] }, th: { title: 'ใหม่', items: ['ก'] } },
    { date: '2026-07-10', en: { title: 'Old', items: ['b'] }, th: { title: 'เก่า', items: ['ข'] } },
  ],
  LATEST_RELEASE: '2026-07-20',
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

const listNotifications = vi.fn()
const markNotificationsRead = vi.fn()
vi.mock('../../lib/api/notifications', () => ({
  listNotifications: (...a: unknown[]) => listNotifications(...a),
  markNotificationsRead: (...a: unknown[]) => markNotificationsRead(...a),
}))

const { useNotifications } = await import('./useNotifications')

const SERVER_ROW = {
  id: 'uuid-1',
  order_id: 'order-1',
  type: 'approved' as const,
  payload: { credits: 100 },
  read_at: null,
  created_at: '2026-07-19T03:00:00Z',
}

/** Mount with one unread server notification and wait for the first poll. */
async function setup() {
  listNotifications.mockResolvedValue({ items: [SERVER_ROW], unread_count: 1 })
  markNotificationsRead.mockResolvedValue(undefined)
  const hook = renderHook(() => useNotifications())
  await waitFor(() => expect(hook.result.current.items.length).toBe(3))
  return hook
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useNotifications — release notes', () => {
  it('pins release rows above server notifications', async () => {
    const { result } = await setup()
    expect(result.current.items.map(i => i.id)).toEqual([
      'release:2026-07-20',
      'release:2026-07-10',
      'uuid-1',
    ])
  })

  it('counts unseen releases on top of the server unread count', async () => {
    const { result } = await setup()
    expect(result.current.unreadCount).toBe(3) // 1 server + 2 unseen releases
  })

  it('does not drift when the poll refreshes the server count', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.refresh()
    })
    // Would be 5 if the release delta were folded into stored state each refresh.
    expect(result.current.unreadCount).toBe(3)
  })

  it('marks a release seen locally without calling the API', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.markRead(['release:2026-07-20'])
    })
    expect(markNotificationsRead).not.toHaveBeenCalled()
    expect(localStorage.getItem('releaseNotesSeen')).toBe('2026-07-20')
    expect(result.current.unreadCount).toBe(1) // server row only
  })

  it('reading the newest also clears older releases', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.markRead(['release:2026-07-20'])
    })
    expect(result.current.items.every(i => !i.id.startsWith('release:') || i.read_at)).toBe(true)
  })

  it('reading an older release leaves the newer one unread', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.markRead(['release:2026-07-10'])
    })
    const newest = result.current.items.find(i => i.id === 'release:2026-07-20')
    expect(newest?.read_at).toBeNull()
    expect(result.current.unreadCount).toBe(2) // 1 server + newest release
  })

  it('passes only server ids to the API on a mixed call', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.markRead(['release:2026-07-20', 'uuid-1'])
    })
    expect(markNotificationsRead).toHaveBeenCalledWith(['uuid-1'])
  })

  it('mark-all clears both sides', async () => {
    const { result } = await setup()
    listNotifications.mockResolvedValue({ items: [], unread_count: 0 })
    await act(async () => {
      await result.current.markRead()
    })
    expect(markNotificationsRead).toHaveBeenCalledWith()
    expect(localStorage.getItem('releaseNotesSeen')).toBe('2026-07-20')
    await waitFor(() => expect(result.current.unreadCount).toBe(0))
  })

  it('starts from the stored seen mark', async () => {
    localStorage.setItem('releaseNotesSeen', '2026-07-20')
    const { result } = await setup()
    expect(result.current.unreadCount).toBe(1)
  })
})
