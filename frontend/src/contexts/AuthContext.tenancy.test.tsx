/**
 * G8 — switching BU on a shared device.
 *
 * `AuthContext.login()` is the only place that detects a tenant switch, and the branch
 * that clears the previous BU's residue (`AuthContext.tsx`, the `ocr_last_tenant`
 * comparison) had no test at all. On a shared accounting workstation this is the whole
 * defence: without it BU-B opens the app and finds BU-A's GL mapping already filled in.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth, type AuthUser } from './AuthContext'
import { appKey, setActiveTenant } from '../lib/storage'

vi.mock('../lib/api/auth', () => ({ revokeSession: vi.fn().mockResolvedValue(undefined) }))

const A: AuthUser = {
  carmen_user_id: 'u-a',
  username: 'Alpha',
  bu: 'bu-alpha',
  uri: 'https://alpha.carmen.example',
  tenant_id: 'tenant-aaaa',
}
const B: AuthUser = {
  ...A,
  carmen_user_id: 'u-b',
  username: 'Beta',
  bu: 'bu-beta',
  tenant_id: 'tenant-bbbb',
}

// A JWT-shaped string: `storeToken` keeps it, `getJwtExpMs` gives up on it quietly.
const TOKEN = 'header.payload.sig'

let auth: ReturnType<typeof useAuth>

function Probe() {
  auth = useAuth()
  return <div data-testid="who">{auth.user?.tenant_id ?? 'none'}</div>
}

function mount() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveTenant(null)
})

describe('tenant switch on a shared device', () => {
  it('wipes the previous BU config when a different BU logs in', () => {
    mount()

    act(() => auth.login(TOKEN, A))
    localStorage.setItem(appKey('accountingConfig'), JSON.stringify({ filePrefix: 'ALPHA' }))
    expect(localStorage.getItem(appKey('accountingConfig'))).toContain('ALPHA')

    act(() => auth.login(TOKEN, B))

    expect(screen.getByTestId('who')).toHaveTextContent('tenant-bbbb')
    // B's namespace is empty, and A's residue is gone from the device entirely.
    expect(localStorage.getItem(appKey('accountingConfig'))).toBeNull()
    setActiveTenant(A.tenant_id)
    expect(localStorage.getItem(appKey('accountingConfig'))).toBeNull()
  })

  it('keeps the same BU config when the same BU logs in again', () => {
    mount()

    act(() => auth.login(TOKEN, A))
    localStorage.setItem(appKey('accountingConfig'), JSON.stringify({ filePrefix: 'ALPHA' }))

    act(() => auth.login(TOKEN, A))

    expect(localStorage.getItem(appKey('accountingConfig'))).toContain('ALPHA')
  })

  it('points the storage namespace at the BU that just logged in', () => {
    mount()
    act(() => auth.login(TOKEN, A))
    expect(appKey('x')).toBe('t:tenant-aaaa:x')
    act(() => auth.login(TOKEN, B))
    expect(appKey('x')).toBe('t:tenant-bbbb:x')
  })
})

describe('logout', () => {
  it('clears the BU config and drops the namespace', async () => {
    mount()
    act(() => auth.login(TOKEN, A))
    localStorage.setItem(appKey('accountingConfig'), JSON.stringify({ filePrefix: 'ALPHA' }))

    await act(async () => {
      await auth.logout()
    })

    expect(appKey('accountingConfig')).toBe('t:anon:accountingConfig')
    setActiveTenant(A.tenant_id)
    expect(localStorage.getItem(appKey('accountingConfig'))).toBeNull()
  })

  it('forgets which BU was last here', async () => {
    mount()
    act(() => auth.login(TOKEN, A))
    await act(async () => {
      await auth.logout()
    })

    expect(sessionStorage.getItem('ocr_last_tenant')).toBeNull()
  })
})
