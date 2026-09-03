import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('../../i18n/LanguageContext', () => ({
  useT: () => ({ t: (k: string) => k }),
}))

const { default: Pager } = await import('./Pager')

const noop = () => {}

/** The size control is a listbox trigger now, not a <select>. */
const size = () => screen.queryByRole('button', { name: 'common.rowsPerPage' })

describe('Pager visibility', () => {
  it('renders nothing below the smallest size — no option would change anything', () => {
    const { container } = render(
      <Pager offset={0} limit={15} total={8} onChange={noop} onLimitChange={noop} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('appears at 20 rows even though page 1 already shows them all', () => {
    // The arrows are dead here, but "show me 15" is a real choice, so the bar belongs.
    render(<Pager offset={0} limit={25} total={20} onChange={noop} onLimitChange={noop} />)
    expect(size()).toBeInTheDocument()
  })

  it('without a size control, it still hides whenever one page holds everything', () => {
    // The bell: a fixed-size list has no reason to show a bar it cannot act on.
    const { container } = render(<Pager offset={0} limit={25} total={20} onChange={noop} />)
    expect(container.firstChild).toBeNull()
    expect(
      render(<Pager offset={0} limit={8} total={20} onChange={noop} />).container.firstChild
    ).not.toBeNull()
  })

  it('omits the size control unless a handler is given', () => {
    render(<Pager offset={0} limit={8} total={99} onChange={noop} />)
    expect(size()).toBeNull()
  })
})

describe('Pager arrows', () => {
  // Scoped to its own render: several of these run per test, and a page-wide query
  // would find every one of them.
  const arrows = (offset: number, total: number) => {
    const onChange = vi.fn()
    const { container } = render(
      <Pager offset={offset} limit={15} total={total} onChange={onChange} />
    )
    const q = within(container)
    return {
      prev: q.getByRole('button', { name: 'common.pagePrev' }),
      next: q.getByRole('button', { name: 'common.pageNext' }),
      onChange,
    }
  }

  it('disables prev on the first page and next on the last', () => {
    expect(arrows(0, 40).prev).toBeDisabled()
    expect(arrows(0, 40).next).toBeEnabled()
    // 30..40 is the last window: 30 + 15 > 40.
    expect(arrows(30, 40).next).toBeDisabled()
    expect(arrows(30, 40).prev).toBeEnabled()
  })

  it('steps by the limit, and never past zero going back', () => {
    const a = arrows(15, 40)
    fireEvent.click(a.next)
    expect(a.onChange).toHaveBeenCalledWith(30)

    const b = arrows(10, 40)
    fireEvent.click(b.prev)
    expect(b.onChange).toHaveBeenCalledWith(0)
  })
})

describe('Pager size control', () => {
  it('picks a size from a list this app drew itself', () => {
    const onLimitChange = vi.fn()
    render(<Pager offset={0} limit={15} total={99} onChange={noop} onLimitChange={onLimitChange} />)
    // Closed: the options are not in the document at all, which is the point — a native
    // <select> would have handed them to the browser to draw from the OS palette.
    expect(screen.queryByRole('option', { hidden: true })).toBeNull()

    fireEvent.click(size()!)
    // `hidden: true`: the panel is a <datalist>, which the UA stylesheet hides and
    // inline-select.css un-hides — jsdom loads no CSS, so it stays hidden to role queries.
    fireEvent.mouseDown(screen.getByRole('option', { name: '50', hidden: true }))
    expect(onLimitChange).toHaveBeenCalledWith(50)
  })
})
