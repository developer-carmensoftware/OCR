import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AdminCreditOrder } from '../../lib/api/adminClient'

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => ({
    t: (k: string, vars?: Record<string, unknown>) => (vars ? `${k}:${JSON.stringify(vars)}` : k),
    lang: 'en',
  }),
}))

const { default: OrderTable } = await import('./OrderTable')

function order(i: number, company: string): AdminCreditOrder {
  return {
    id: String(i),
    tenant_id: 't',
    tenant_name: company,
    buyer_name: company,
    pack_code: 'starter',
    credits: 500,
    amount_thb: 990,
    status: 'in_progress',
    slip_uploaded_at: '2026-08-01T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z',
  } as unknown as AdminCreditOrder
}

function renderTable(
  orders: AdminCreditOrder[],
  ordersTotal = orders.length,
  search = '',
  // 'to_review' is the tab that actually offers batch actions; only there does the
  // select-all checkbox render at all.
  tab: 'all' | 'to_review' = 'all'
) {
  const onToggleAll = vi.fn()
  const utils = render(
    <OrderTable
      tab={tab}
      stages={[tab]}
      onTab={vi.fn()}
      search={search}
      onSearch={vi.fn()}
      orders={orders}
      ordersTotal={ordersTotal}
      counts={{}}
      loading={false}
      selectedId={null}
      onSelect={vi.fn()}
      checked={[]}
      onToggleCheck={vi.fn()}
      onToggleAll={onToggleAll}
      onClearChecked={vi.fn()}
      onApproveBatch={vi.fn()}
      onHoldBatch={vi.fn()}
      onPostBatch={vi.fn()}
      onVoidBatch={vi.fn()}
      busy={false}
    />
  )
  return { ...utils, onToggleAll }
}

const many = (n: number) => Array.from({ length: n }, (_, i) => order(i, `Co ${i}`))

describe('OrderTable paging', () => {
  // jsdom lays nothing out, so useFitRows never measures and falls back to 6 rows.
  it('shows one measured page, not every row it holds', () => {
    const { container } = renderTable(many(20))
    expect(container.querySelectorAll('tbody tr.orev-row')).toHaveLength(6)
  })

  it('select-all covers everything the search matched, not just the visible page', () => {
    const { onToggleAll } = renderTable(many(20), 20, '', 'to_review')
    fireEvent.click(screen.getByLabelText('orev.selectAll'))
    // 20 ids, not the 6 on screen — a batch approve that silently skipped the rest
    // would be the worst kind of bug on this page.
    expect(onToggleAll).toHaveBeenCalledWith(expect.arrayContaining([]))
    expect(onToggleAll.mock.calls[0][0]).toHaveLength(20)
  })

  it('pages the filtered set, and searching still spans everything loaded', () => {
    const orders = [...many(20), order(99, 'Findme Ltd')]
    const { container } = renderTable(orders, orders.length, 'findme')
    const rows = container.querySelectorAll('tbody tr.orev-row')
    // The match sits well past the first page; a server-side window would have missed it.
    expect(rows).toHaveLength(1)
    expect(rows[0].textContent).toContain('Findme Ltd')
  })

  it('says so when the fetch was capped instead of ending the list silently', () => {
    renderTable(many(20), 340)
    expect(screen.getByRole('status').textContent).toContain('orev.list.truncated')
    expect(screen.getByRole('status').textContent).toContain('340')
  })

  it('stays quiet when everything matching was loaded', () => {
    renderTable(many(20), 20)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
