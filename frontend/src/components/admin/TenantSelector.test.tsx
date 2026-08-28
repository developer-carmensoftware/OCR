import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

/**
 * The tenant filter used to be a plain <select> capped at the endpoint's default 200,
 * so BU #201 was simply not in the list and finding one meant scrolling. It is now a
 * native <datalist> type-ahead over 500.
 */

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => ({ t: (k: string) => k }),
}))

const fetchTenants = vi.fn()
vi.mock('../../lib/api/adminClient', () => ({
  fetchTenants: (...a: unknown[]) => fetchTenants(...a),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const { default: TenantSelector } = await import('./TenantSelector')

const TENANTS = [
  { id: 't-1', name: 'Carmen Cloud', host: 'dev.carmen4.com', bu_code: 'carmencloud' },
  { id: 't-2', name: null, host: 'pilot.carmen4.com', bu_code: 'pilot' },
]

beforeEach(() => {
  fetchTenants.mockReset()
  fetchTenants.mockResolvedValue({ data: TENANTS })
})

const box = () => screen.getByLabelText('admin.common.tenantSelector.filterTitle')

describe('TenantSelector', () => {
  it('asks for more than the endpoint default so no BU is invisible', async () => {
    render(<TenantSelector value="" onChange={() => {}} />)
    await waitFor(() => expect(fetchTenants).toHaveBeenCalled())
    // 200 was the default; the 201st tenant could never be selected.
    expect(fetchTenants.mock.calls[0][0].limit).toBe(500)
  })

  it('offers every tenant as a type-ahead option', async () => {
    const { container } = render(<TenantSelector value="" onChange={() => {}} />)
    await waitFor(() => expect(container.querySelectorAll('option')).toHaveLength(2))
    const values = Array.from(container.querySelectorAll('option')).map(o =>
      o.getAttribute('value')
    )
    expect(values).toContain('Carmen Cloud (carmencloud)')
    // No name on file: falls back to the host rather than rendering a blank row.
    expect(values).toContain('pilot.carmen4.com (pilot)')
  })

  it('reports the id, not the label, when a tenant is chosen', async () => {
    const onChange = vi.fn()
    render(<TenantSelector value="" onChange={onChange} />)
    await waitFor(() => expect(fetchTenants).toHaveBeenCalled())
    fireEvent.change(box(), { target: { value: 'Carmen Cloud (carmencloud)' } })
    expect(onChange).toHaveBeenCalledWith('t-1')
  })

  it('clearing the box means all tenants', async () => {
    const onChange = vi.fn()
    render(<TenantSelector value="t-1" onChange={onChange} />)
    await waitFor(() => expect(box()).toHaveValue('Carmen Cloud (carmencloud)'))
    fireEvent.change(box(), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('shows the current selection when the value is restored from a URL', async () => {
    render(<TenantSelector value="t-2" onChange={() => {}} />)
    await waitFor(() => expect(box()).toHaveValue('pilot.carmen4.com (pilot)'))
  })

  it('does not fire on a half-typed word that matches nothing', async () => {
    const onChange = vi.fn()
    render(<TenantSelector value="" onChange={onChange} />)
    await waitFor(() => expect(fetchTenants).toHaveBeenCalled())
    fireEvent.change(box(), { target: { value: 'Carm' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('snaps back on blur so the box never lies about what is filtered', async () => {
    render(<TenantSelector value="t-1" onChange={() => {}} />)
    await waitFor(() => expect(box()).toHaveValue('Carmen Cloud (carmencloud)'))
    fireEvent.change(box(), { target: { value: 'nonsense' } })
    fireEvent.blur(box())
    expect(box()).toHaveValue('Carmen Cloud (carmencloud)')
  })
})
