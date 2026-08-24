import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTableQuery } from './useTableQuery'

// Filters used to live in useState, so leaving an admin page and coming back reset them
// and there was no way to hand a colleague the view you were looking at. These pin the
// two halves of the fix: what reaches the URL, and what comes back out of it.

const setHash = (h: string) => {
  window.location.hash = h
}

beforeEach(() => setHash('#/admin/llm-logs'))

const opts = { defaultSort: 'created_at', filters: { tenant_id: '', from: '2026-01-01' } }

describe('useTableQuery URL round-trip', () => {
  it('keeps an untouched page out of the URL', () => {
    renderHook(() => useTableQuery(opts))
    expect(window.location.hash).toBe('#/admin/llm-logs')
  })

  it('writes only what differs from the defaults', () => {
    const { result } = renderHook(() => useTableQuery(opts))
    act(() => result.current.set({ sort: 'cost_usd', dir: 'asc' }))
    expect(window.location.hash).toContain('sort=cost_usd')
    expect(window.location.hash).toContain('dir=asc')
    // `from` was never touched, so it stays implicit.
    expect(window.location.hash).not.toContain('from=')
  })

  it('restores from a pasted URL, numbers as numbers', () => {
    setHash('#/admin/llm-logs?sort=cost_usd&dir=asc&offset=50&tenant_id=t-1')
    const { result } = renderHook(() => useTableQuery(opts))
    expect(result.current.params.sort).toBe('cost_usd')
    expect(result.current.params.dir).toBe('asc')
    expect(result.current.params.tenant_id).toBe('t-1')
    // A string here would make offset + limit concatenate and page into nowhere.
    expect(result.current.params.offset).toBe(50)
  })

  it('leaves the route itself alone', () => {
    const { result } = renderHook(() => useTableQuery(opts))
    act(() => result.current.set({ tenant_id: 't-9' }))
    expect(window.location.hash.split('?')[0]).toBe('#/admin/llm-logs')
  })
})

describe('useTableQuery paging', () => {
  it('sends a changed filter back to page 1', () => {
    const { result } = renderHook(() => useTableQuery(opts))
    act(() => result.current.set({ offset: 100 }))
    act(() => result.current.set({ tenant_id: 't-1' }))
    // Page 4 of the old filter has nothing to do with page 4 of the new one.
    expect(result.current.params.offset).toBe(0)
  })

  it('does not reset the page when only paging', () => {
    const { result } = renderHook(() => useTableQuery(opts))
    act(() => result.current.set({ offset: 100 }))
    expect(result.current.params.offset).toBe(100)
    act(() => result.current.set({ limit: 12 }))
    expect(result.current.params.offset).toBe(100)
  })

  it('reports dirty for filters but not for the page you are on', () => {
    const { result } = renderHook(() => useTableQuery(opts))
    expect(result.current.dirty).toBe(false)
    act(() => result.current.set({ offset: 100 }))
    expect(result.current.dirty).toBe(false)
    act(() => result.current.set({ q: 'gemini' }))
    expect(result.current.dirty).toBe(true)
    act(() => result.current.reset())
    expect(result.current.dirty).toBe(false)
  })
})
