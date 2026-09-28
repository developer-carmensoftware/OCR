import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from '@/shared/api/adminAuth'
import { AdminAuthProvider } from './AdminAuthContext'

vi.mock('@/shared/api/adminAuth', () => ({
  adminMe: vi.fn(),
  adminLogout: vi.fn(),
  getAdminToken: vi.fn(() => 'admin-jwt'),
  clearAdminToken: vi.fn(),
  storeAdminToken: vi.fn(),
}))

describe('AdminAuthProvider on mount', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the token when /me fails for a reason that is not about the token', async () => {
    // A 429 from reloading quickly used to clear the token, logging the admin out.
    vi.mocked(client.adminMe).mockRejectedValue(new Error('Failed to fetch admin profile'))
    render(<AdminAuthProvider>x</AdminAuthProvider>)
    await waitFor(() => expect(client.adminMe).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    expect(client.clearAdminToken).not.toHaveBeenCalled()
  })

  it('clears the token when the client reports a 401', async () => {
    vi.mocked(client.adminMe).mockRejectedValue(new Error('Failed to fetch admin profile'))
    render(<AdminAuthProvider>x</AdminAuthProvider>)
    window.dispatchEvent(new CustomEvent('admin:unauthorized'))
    await waitFor(() => expect(client.clearAdminToken).toHaveBeenCalled())
  })
})
