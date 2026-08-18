import { describe, it, expect } from 'vitest'
import { pollMessage, relativeAge, statusTone } from './EmailAutomationPage'

/**
 * The poll answers with four different shapes and only one of them is a summary. The
 * operator reads the toast, not the JSON, so the mapping is the part worth pinning.
 */
describe('pollMessage', () => {
  it('reports a poll that carried mail, with the counts that decide what to do next', () => {
    const m = pollMessage({
      messages: 4,
      posted: 1,
      failed: 1,
      skipped: 1,
      unrouted: 0,
      retry_later: 1,
    })
    expect(m.tone).toBe('success')
    expect(m.key).toBe('admin.email.toast.polled')
    expect(m.vars).toEqual({ messages: 4, posted: 1, failed: 1, skipped: 1, held: 1 })
  })

  it('surfaces mail held unread — the one outcome that leaves no row in the table', () => {
    // REGRESSION GUARD: a switched-off BU (or one out of package, or with the module
    // disabled) has its mail handed back unread and writes nothing to `email_documents`.
    // If this count is not in the toast, a backlog piling up is invisible everywhere.
    const m = pollMessage({ messages: 2, posted: 0, failed: 0, skipped: 0, retry_later: 2 })
    expect(m.vars?.held).toBe(2)
  })

  it('separates "nothing to read" from "something went wrong"', () => {
    const m = pollMessage({ messages: 0, posted: 0, failed: 0, skipped: 0, unrouted: 0 })
    expect(m.tone).toBe('info')
    expect(m.key).toBe('admin.email.toast.noMail')
  })

  it('treats a still-running poll as information, never as a failure', () => {
    // REGRESSION GUARD: the request returns after 25s while `asyncio.shield` keeps the
    // poll alive. Calling that an error would send someone hunting a problem that does
    // not exist, and worse, invite a second poll on top of the first.
    const m = pollMessage({ status: 'running' })
    expect(m.tone).toBe('info')
    expect(m.key).toBe('admin.email.toast.running')
  })

  it('says busy when a poll is already in flight', () => {
    expect(pollMessage({ status: 'busy' }).key).toBe('admin.email.toast.busy')
  })

  it('says disabled loudly — an unconfigured mailbox looks exactly like a quiet one', () => {
    const m = pollMessage({ status: 'disabled', reason: 'IMAP not configured' })
    expect(m.tone).toBe('error')
    expect(m.key).toBe('admin.email.toast.disabled')
  })

  it('reads the confirmation sweep, which counts confirmations rather than messages', () => {
    expect(pollMessage({ checked: 1, confirmed: 1, waiting: 2 })).toMatchObject({
      tone: 'success',
      key: 'admin.email.toast.confirmed',
      vars: { confirmed: 1, checked: 1 },
    })
    // Nothing to confirm is not a success — there was no work to do.
    expect(pollMessage({ checked: 0, confirmed: 0, waiting: 0 }).tone).toBe('info')
  })
})

describe('relativeAge', () => {
  const now = Date.parse('2026-08-17T12:00:00Z')
  const ago = (minutes: number) => new Date(now - minutes * 60000).toISOString()

  it('answers "is it still running" in the unit a person reads at a glance', () => {
    expect(relativeAge(ago(0), now)).toEqual({ key: 'admin.email.age.now', vars: undefined })
    expect(relativeAge(ago(9), now)).toEqual({ key: 'admin.email.age.min', vars: { n: 9 } })
    expect(relativeAge(ago(150), now)).toEqual({ key: 'admin.email.age.hour', vars: { n: 2 } })
    expect(relativeAge(ago(60 * 24 * 3), now)).toEqual({
      key: 'admin.email.age.day',
      vars: { n: 3 },
    })
  })

  it('returns null for a job that has never run, so the tile can say so in its own words', () => {
    // REGRESSION GUARD: this used to render a 19-character timestamp at 1.6rem/800 in
    // a 200px tile, which ran straight out past the card border.
    expect(relativeAge(null)).toBeNull()
    expect(relativeAge(undefined)).toBeNull()
  })
})

describe('statusTone', () => {
  it('maps the four pipeline statuses', () => {
    expect(statusTone('posted')).toBe('ok')
    expect(statusTone('failed')).toBe('error')
    expect(statusTone('skipped')).toBe('warn')
  })

  it('leaves `received` neutral: it means a process died mid-document, not "pending"', () => {
    expect(statusTone('received')).toBe('neutral')
    expect(statusTone('anything-new')).toBe('neutral')
  })
})
