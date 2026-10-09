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

// The posting section (CA-119): its own calls, mocked here so the key tests stay about keys.
const getPmsSettings = vi.fn()
const putPmsSettings = vi.fn()
const putPmsCredential = vi.fn()
vi.mock('@/features/pms/api/pmsSettings', () => ({
  getPmsSettings: (...a: unknown[]) => getPmsSettings(...a),
  putPmsSettings: (...a: unknown[]) => putPmsSettings(...a),
  putPmsCredential: (...a: unknown[]) => putPmsCredential(...a),
}))
vi.mock('@/shared/api/carmen', () => ({
  fetchGLPrefixes: () => Promise.resolve([{ PrefixName: 'JV', Description: 'General journal' }]),
}))
const SETTINGS = { jv_prefix: 'JV', auto_post: false, has_credential: true }

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

describe('posting settings (CA-119)', () => {
  beforeEach(() => {
    serve([])
    sessionStorage.clear()
    getPmsSettings.mockResolvedValue(SETTINGS)
    putPmsSettings.mockImplementation(async (body: object) => ({ ...SETTINGS, ...body }))
    putPmsCredential.mockResolvedValue(SETTINGS)
  })

  it('stores the token Carmen opened the page with, then reads the settings', async () => {
    sessionStorage.setItem('carmen_posting_token', 'fresh-token')
    renderPage()
    await waitFor(() => expect(putPmsCredential).toHaveBeenCalledWith('fresh-token'))
    await waitFor(() => expect(getPmsSettings).toHaveBeenCalled())
    expect(sessionStorage.getItem('carmen_posting_token')).toBeNull()
    expect(putPmsCredential.mock.invocationCallOrder[0]).toBeLessThan(
      getPmsSettings.mock.invocationCallOrder[0]
    )
  })

  it('keeps a token Carmen refused and says so', async () => {
    sessionStorage.setItem('carmen_posting_token', 'dead')
    putPmsCredential.mockRejectedValue(new Error('Carmen rejected this token (HTTP 401)'))
    renderPage()
    expect(await screen.findByText(/Couldn't store the Carmen access/)).toBeInTheDocument()
    expect(sessionStorage.getItem('carmen_posting_token')).toBe('dead')
  })

  it('says when no Carmen access is stored', async () => {
    getPmsSettings.mockResolvedValue({ ...SETTINGS, has_credential: false })
    renderPage()
    expect(await screen.findByText(/No Carmen access is stored/)).toBeInTheDocument()
  })

  it('saves auto-post the moment it is switched', async () => {
    renderPage()
    const sw = await screen.findByRole('switch', { name: 'Post clean days automatically' })
    await waitFor(() => expect(sw).not.toBeDisabled())
    fireEvent.click(sw)
    await waitFor(() =>
      expect(putPmsSettings).toHaveBeenCalledWith({ jv_prefix: 'JV', auto_post: true })
    )
  })
})
