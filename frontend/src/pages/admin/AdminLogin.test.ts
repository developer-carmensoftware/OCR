/**
 * The sign-in form shows one of five messages, chosen purely by HTTP status.
 * Get the mapping wrong and a locked-out admin is told to retype their password
 * for 15 minutes, so it is pinned here.
 */
import { describe, it, expect } from 'vitest'
import { classify, mmss } from './AdminLogin'
import { AdminLoginError } from '../../lib/api/adminClient'

describe('classify', () => {
  it('maps each status the backend can return', () => {
    expect(classify(new AdminLoginError('x', 401)).kind).toBe('invalid')
    expect(classify(new AdminLoginError('x', 400)).kind).toBe('invalid')
    // Both "Account disabled" and "No active roles assigned" arrive as 403.
    expect(classify(new AdminLoginError('x', 403)).kind).toBe('noAccess')
    expect(classify(new AdminLoginError('x', 423)).kind).toBe('locked')
    expect(classify(new AdminLoginError('x', 500)).kind).toBe('network')
  })

  it('turns the lockout seconds into a wall-clock deadline', () => {
    const before = Date.now()
    const { unlockAt } = classify(new AdminLoginError('locked', 423, 900))
    expect(unlockAt).toBeGreaterThanOrEqual(before + 900_000)
    expect(unlockAt).toBeLessThan(before + 901_000)
  })

  it('still locks when the duration could not be parsed', () => {
    const e = classify(new AdminLoginError('Account locked.', 423))
    expect(e.kind).toBe('locked')
    // No deadline means no countdown and no auto-clear — the banner must not
    // silently disappear as if the lock had lifted.
    expect(e.unlockAt).toBeUndefined()
  })

  it('falls back to generic for anything that is not a login error', () => {
    expect(classify(new Error('boom')).kind).toBe('generic')
    expect(classify(null).kind).toBe('generic')
  })
})

describe('mmss', () => {
  it('pads seconds so the countdown does not jitter in width', () => {
    expect(mmss(900)).toBe('15:00')
    expect(mmss(61)).toBe('1:01')
    expect(mmss(9)).toBe('0:09')
    expect(mmss(0)).toBe('0:00')
  })
})
