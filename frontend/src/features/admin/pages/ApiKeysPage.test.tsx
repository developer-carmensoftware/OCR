import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

/**
 * #/admin/api-keys: support's view of Carmen's PMS keys. Carmen generates them, one per BU and
 * PMS (decision-log #44), so this page lists and revokes and never creates. Revoking asks for
 * a reason in a dialog, not a prompt.
 */

vi.mock('@/i18n/LanguageContext', () => ({
  useT: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k} ${JSON.stringify(v)}` : k),
    lang: 'en',
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const fetchApiKeys = vi.fn()
const revokeApiKey = vi.fn()
vi.mock('@/features/admin/api/apiKeys', () => ({
  fetchApiKeys: (...a: unknown[]) => fetchApiKeys(...a),
  revokeApiKey: (...a: unknown[]) => revokeApiKey(...a),
}))
const fetchTenants = vi.fn()
vi.mock('@/features/admin/api/tenants', () => ({
  fetchTenants: (...a: unknown[]) => fetchTenants(...a),
}))

const { default: ApiKeysPage } = await import('./ApiKeysPage')

const ROW = {
  id: 'k-1',
  tenant_id: 't-1',
  tenant_name: 'Grand Hotel (gh01)',
  bu_code: 'gh01',
  tenant_host: 'gh.carmen4.com',
  name: 'comanche hook',
  interface_name: 'comanche',
  key_prefix: 'cpk_abcdefgh',
  scopes: ['pms:events'],
  created_at: '2026-10-07T04:00:00+00:00',
  last_used_at: null,
  last_used_ip: null,
  revoked_at: null,
  revoke_reason: null,
}

/** The list and the status line both read the list endpoint; the status line asks for one. */
function serve(rows: (typeof ROW)[]) {
  fetchApiKeys.mockImplementation(async (p: { limit?: number; sort?: string }) =>
    p.limit === 1 && p.sort === 'last_used_at'
      ? { total: rows.length, limit: 1, offset: 0, data: rows.slice(0, 1) }
      : { total: rows.length, limit: 50, offset: 0, data: rows }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.location.hash = '#/admin/api-keys'
  serve([ROW])
  fetchTenants.mockResolvedValue({
    data: [{ id: 't-1', name: 'Grand Hotel', host: 'gh.carmen4.com', bu_code: 'gh01' }],
  })
  revokeApiKey.mockResolvedValue({ id: 'k-1', revoked: true })
})

describe('ApiKeysPage — list', () => {
  it("shows each key's PMS and offers no way to create one", async () => {
    render(<ApiKeysPage />)
    expect(await screen.findByText('comanche')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'apiKeys.create' })).not.toBeInTheDocument()
  })
})

describe('ApiKeysPage — revoke', () => {
  it('revokes in a dialog, with the reason', async () => {
    render(<ApiKeysPage />)
    await screen.findByText('comanche hook')
    fireEvent.click(screen.getByRole('button', { name: /apiKeys.revokeAria/ }))
    const dialog = screen.getByRole('dialog', { name: 'apiKeys.revokeDialog.title' })
    fireEvent.change(within(dialog).getByLabelText(/apiKeys.revokeDialog\.reason/), {
      target: { value: 'Rotated' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'apiKeys.revokeDialog.submit' }))
    await waitFor(() => expect(revokeApiKey).toHaveBeenCalledWith('k-1', 'Rotated'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('ApiKeysPage — status line and empty state', () => {
  it('says the feed is not set up when no key is active', async () => {
    serve([])
    render(<ApiKeysPage />)
    expect(await screen.findByText('apiKeys.status.none')).toBeInTheDocument()
    expect(await screen.findByText('apiKeys.emptyTitle')).toBeInTheDocument()
  })

  it('reports the last call when a key has been used', async () => {
    serve([{ ...ROW, last_used_at: new Date().toISOString(), last_used_ip: '127.0.0.1' } as never])
    render(<ApiKeysPage />)
    expect(await screen.findByText(/apiKeys.status\.lastCall/)).toBeInTheDocument()
    expect(screen.getByText('apiKeys.status.keysOne')).toBeInTheDocument()
  })
})
