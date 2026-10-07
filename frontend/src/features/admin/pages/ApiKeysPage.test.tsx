import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

/**
 * #/admin/api-keys: the one-time key lives only in the create dialog's reveal step, and that
 * step must not close by accident. Revoking asks for a reason in a dialog, not a prompt.
 */

vi.mock('@/i18n/LanguageContext', () => ({
  useT: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k} ${JSON.stringify(v)}` : k),
    lang: 'en',
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const fetchApiKeys = vi.fn()
const createApiKey = vi.fn()
const revokeApiKey = vi.fn()
vi.mock('@/features/admin/api/apiKeys', () => ({
  fetchApiKeys: (...a: unknown[]) => fetchApiKeys(...a),
  createApiKey: (...a: unknown[]) => createApiKey(...a),
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
  name: 'PMS webhook',
  key_prefix: 'cpk_abcdefgh',
  scopes: ['pms:events'],
  created_at: '2026-10-07T04:00:00+00:00',
  last_used_at: null,
  last_used_ip: null,
  revoked_at: null,
  revoke_reason: null,
}
const KEY = 'cpk_abcdefghSECRETSECRETSECRETSECRETSECRET1'
const writeText = vi.fn()

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
  createApiKey.mockResolvedValue({ ...ROW, key: KEY })
  revokeApiKey.mockResolvedValue({ id: 'k-1', revoked: true })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

async function openCreateAndPickBu() {
  render(<ApiKeysPage />)
  await screen.findByText('PMS webhook')
  fireEvent.click(screen.getByRole('button', { name: 'admin.apiKeys.create' }))
  const dialog = screen.getByRole('dialog', { name: 'admin.apiKeys.createDialog.title' })
  const submit = within(dialog).getByRole('button', { name: 'admin.apiKeys.createDialog.submit' })
  expect(submit).toBeDisabled()
  await waitFor(() => expect(dialog.querySelectorAll('datalist option')).toHaveLength(1))
  fireEvent.change(within(dialog).getByLabelText('admin.apiKeys.createDialog.bu'), {
    target: { value: 'Grand Hotel (gh01)' },
  })
  expect(submit).toBeEnabled()
  fireEvent.click(submit)
  return screen.findByRole('dialog', { name: 'admin.apiKeys.reveal.title' })
}

describe('ApiKeysPage — create', () => {
  it('creates for the picked BU, shows the key once, and closes only on Done', async () => {
    const reveal = await openCreateAndPickBu()
    expect(createApiKey).toHaveBeenCalledWith({ tenant_id: 't-1', name: 'PMS webhook' })
    expect(within(reveal).getByLabelText('admin.apiKeys.reveal.key')).toHaveValue(KEY)

    // Escape and the backdrop would throw away the only copy of the key.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.click(document.querySelector('.ui-dialog-backdrop')!)
    expect(screen.getByRole('dialog', { name: 'admin.apiKeys.reveal.title' })).toBeInTheDocument()

    fireEvent.click(within(reveal).getByRole('button', { name: 'admin.apiKeys.reveal.done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(KEY)).not.toBeInTheDocument()
  })

  it('copies the whole Carmen setup in one go', async () => {
    const reveal = await openCreateAndPickBu()
    fireEvent.click(within(reveal).getByRole('button', { name: 'admin.apiKeys.reveal.copySetup' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('/api/v1/pms/events')
    expect(text).toContain(`Authorization: Bearer ${KEY}`)
    expect(text).toContain('gh01 (gh.carmen4.com)')
  })
})

describe('ApiKeysPage — revoke', () => {
  it('revokes in a dialog, with the reason', async () => {
    render(<ApiKeysPage />)
    await screen.findByText('PMS webhook')
    fireEvent.click(screen.getByRole('button', { name: /admin\.apiKeys\.revokeAria/ }))
    const dialog = screen.getByRole('dialog', { name: 'admin.apiKeys.revokeDialog.title' })
    fireEvent.change(within(dialog).getByLabelText(/admin\.apiKeys\.revokeDialog\.reason/), {
      target: { value: 'Rotated' },
    })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'admin.apiKeys.revokeDialog.submit' })
    )
    await waitFor(() => expect(revokeApiKey).toHaveBeenCalledWith('k-1', 'Rotated'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('ApiKeysPage — status line and empty state', () => {
  it('says the feed is not set up, and teaches the next step, when no key is active', async () => {
    serve([])
    render(<ApiKeysPage />)
    expect(await screen.findByText('admin.apiKeys.status.none')).toBeInTheDocument()
    expect(await screen.findByText('admin.apiKeys.emptyTitle')).toBeInTheDocument()
  })

  it('reports the last call when a key has been used', async () => {
    serve([{ ...ROW, last_used_at: new Date().toISOString(), last_used_ip: '127.0.0.1' } as never])
    render(<ApiKeysPage />)
    expect(await screen.findByText(/admin\.apiKeys\.status\.lastCall/)).toBeInTheDocument()
    expect(screen.getByText('admin.apiKeys.status.keysOne')).toBeInTheDocument()
  })
})
