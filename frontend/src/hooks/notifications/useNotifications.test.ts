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
const { markReleaseSeen } = await import('../../lib/releaseNotesSeen')

const SERVER_ROW = {
  id: 'uuid-1',
  order_id: 'order-1',
  type: 'approved' as const,
  payload: { credits: 100 },
  read_at: null,
  created_at: '2026-07-19T03:00:00Z',
}

/** The paged envelope the API returns, around a fixed set of rows. */
function page(rows: (typeof SERVER_ROW)[], unread: number, total = rows.length) {
  return { total, limit: 8, offset: 0, data: rows, unread_count: unread }
}

/** Mount with one unread server notification and wait for the first poll. */
async function setup() {
  listNotifications.mockResolvedValue(page([SERVER_ROW], 1))
  markNotificationsRead.mockResolvedValue(undefined)
  const hook = renderHook(() => useNotifications())
  await waitFor(() => expect(hook.result.current.items.length).toBe(2))
  return hook
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useNotifications — release notes', () => {
  it('surfaces only the newest release, pinned above server notifications', async () => {
    const { result } = await setup()
    // One doorway to #/whats-new, not one row per release — the page lists the rest.
    expect(result.current.items.map(i => i.id)).toEqual(['release:2026-07-20', 'uuid-1'])
  })

  it('counts the unseen release on top of the server unread count', async () => {
    const { result } = await setup()
    expect(result.current.unreadCount).toBe(2) // 1 server + 1 unseen release
  })

  it('does not drift when the poll refreshes the server count', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.refresh()
    })
    // Would climb each refresh if the release delta were folded into stored state.
    expect(result.current.unreadCount).toBe(2)
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

  it('a stale seen mark older than the newest release still reads as unseen', async () => {
    localStorage.setItem('releaseNotesSeen', '2026-07-10')
    const { result } = await setup()
    const newest = result.current.items.find(i => i.id === 'release:2026-07-20')
    expect(newest?.read_at).toBeNull()
    expect(result.current.unreadCount).toBe(2) // 1 server + the newer release
  })

  it('picks up the mark cleared by the What’s New page', async () => {
    const { result } = await setup()
    expect(result.current.unreadCount).toBe(2)
    await act(async () => {
      markReleaseSeen('2026-07-20') // what WhatsNew does on mount
    })
    expect(result.current.unreadCount).toBe(1)
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
    listNotifications.mockResolvedValue(page([], 0))
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

describe('useNotifications — paging', () => {
  it('offers more only while the server says rows are left', async () => {
    listNotifications.mockResolvedValue(page([SERVER_ROW], 1, 30))
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(result.current.hasMore).toBe(true))

    // total===1 row loaded: the synthetic release row must not count towards it,
    // or the bell would offer "show older" with nothing older to show.
    listNotifications.mockResolvedValue(page([SERVER_ROW], 1, 1))
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.hasMore).toBe(false)
  })

  it('loadMore re-requests a bigger window rather than an offset page', async () => {
    listNotifications.mockResolvedValue(page([SERVER_ROW], 1, 30))
    const { result } = renderHook(() => useNotifications())
    await waitFor(() => expect(listNotifications).toHaveBeenCalledWith(8))
    await act(async () => {
      result.current.loadMore()
    })
    await waitFor(() => expect(listNotifications).toHaveBeenCalledWith(16))
  })
})
