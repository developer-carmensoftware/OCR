import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'

/**
 * #/pms: a BU manages its own PMS keys. The business unit comes from the session, the reveal
 * is the compact one (no developer bundle), the 2-active cap disables Create, and the page
 * stays English whatever the language toggle says.
 */

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/shared/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { bu: 'gh01', uri: 'https://gh.carmen4.com', tenant_id: 't-1', username: 'acc' },
  }),
}))

const fetchPmsKeys = vi.fn()
const createPmsKey = vi.fn()
const revokePmsKey = vi.fn()
vi.mock('@/features/pms/api/pmsKeys', () => ({
  fetchPmsKeys: (...a: unknown[]) => fetchPmsKeys(...a),
  createPmsKey: (...a: unknown[]) => createPmsKey(...a),
  revokePmsKey: (...a: unknown[]) => revokePmsKey(...a),
}))

const { default: PmsPage } = await import('./PmsPage')

const row = (over: Record<string, unknown> = {}) => ({
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
  ...over,
})
const KEY = 'cpk_abcdefghSECRETSECRETSECRETSECRETSECRET1'

const serve = (rows: ReturnType<typeof row>[]) =>
  fetchPmsKeys.mockResolvedValue({ total: rows.length, limit: 50, offset: 0, data: rows })

const renderPage = () =>
  render(
    <LanguageProvider>
      <PmsPage />
    </LanguageProvider>
  )

beforeEach(() => {
  vi.clearAllMocks()
  serve([row()])
  createPmsKey.mockResolvedValue({ ...row({ id: 'k-2' }), key: KEY })
  revokePmsKey.mockResolvedValue({ id: 'k-1', revoked: true })
})
afterEach(() => localStorage.removeItem('lang'))

describe('PmsPage', () => {
  it("lists this BU's keys and creates one with the compact reveal", async () => {
    renderPage()
    expect(await screen.findByText('cpk_abcdefgh…')).toBeInTheDocument()
    expect(screen.getByText('gh01')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create key' }))
    const dialog = screen.getByRole('dialog', { name: 'Create API key' })
    // No business-unit picker: the session's BU is shown, not chosen.
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create key' }))
    await waitFor(() => expect(createPmsKey).toHaveBeenCalledWith('PMS webhook'))

    const reveal = await screen.findByRole('dialog', { name: 'Save your API key' })
    expect(within(reveal).getByLabelText('API key')).toHaveValue(KEY)
    expect(within(reveal).getByText(/Paste the key into the PMS settings in Carmen/)).toBeTruthy()
    expect(within(reveal).queryByRole('button', { name: 'Copy setup for Carmen' })).toBeNull()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Save your API key' })).toBeInTheDocument()
    fireEvent.click(within(reveal).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables Create at 2 active keys and says why', async () => {
    serve([row(), row({ id: 'k-2', key_prefix: 'cpk_zzzzzzzz' })])
    renderPage()
    expect(await screen.findByText(/At most 2 active keys/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create key' })).toBeDisabled()
  })

  it('revokes with a reason', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Revoke PMS webhook/ }))
    const dialog = screen.getByRole('dialog', { name: 'Revoke API key' })
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Rotated' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke key' }))
    await waitFor(() => expect(revokePmsKey).toHaveBeenCalledWith('k-1', 'Rotated'))
  })

  it('stays English when the toggle is set to Thai', async () => {
    localStorage.setItem('lang', 'th')
    renderPage()
    expect(await screen.findByRole('heading', { name: 'PMS connection' })).toBeInTheDocument()
  })
})
