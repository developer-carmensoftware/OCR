import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// The header collapses its action controls into a `⋯` popover below 640px. That
// branch is the whole point of the compact layout, so it gets pinned: at 360px
// the four controls plus the back button and title overflow the row, and the
// old failure mode was silent (the logo spilled under the bell and the header's
// overflow: hidden clipped it).

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

const { default: AppHeader } = await import('./AppHeader')

// jsdom has no matchMedia; the component treats "can't measure" as the full row.
function mockViewport(width: number | null) {
  if (width === null) {
    // @ts-expect-error deleting the optional API is the point of this case
    delete window.matchMedia
    return
  }
  window.matchMedia = ((query: string) => ({
    matches: /max-width:\s*(\d+)px/.test(query)
      ? width <= Number(/max-width:\s*(\d+)px/.exec(query)![1])
      : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

const renderHeader = () =>
  render(
    <AppHeader moduleName="AI JV Automation">
      <button type="button">Theme</button>
    </AppHeader>
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AppHeader — compact action menu', () => {
  it('keeps the controls inline on desktop, with no ⋯ button', () => {
    mockViewport(1280)
    renderHeader()
    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument()
    expect(document.querySelector('.app-header-menu')).not.toHaveAttribute('popover')
  })

  it('collapses the controls into a ⋯ popover on a phone', () => {
    mockViewport(360)
    renderHeader()
    const more = screen.getByRole('button', { name: /more actions/i })
    const menu = document.querySelector('.app-header-menu')
    expect(more).toHaveAttribute('popovertarget', 'app-header-menu')
    expect(menu).toHaveAttribute('popover', 'auto')
    expect(menu).toHaveAttribute('id', 'app-header-menu')
    // One node, not two: rendering the cluster twice would mount UsageIndicator
    // twice and fire its /usage fetch twice.
    expect(document.querySelectorAll('.app-header-menu')).toHaveLength(1)
    expect(screen.getAllByText('Theme')).toHaveLength(1)
  })

  it('falls back to the full row when matchMedia is unavailable', () => {
    mockViewport(null)
    renderHeader()
    expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument()
  })

  it('carries language and theme even when the page passes no controls', () => {
    mockViewport(360)
    render(<AppHeader moduleName="AI JV Automation" />)
    expect(document.querySelector('.app-header-menu')).toBeInTheDocument()
    expect(document.querySelector('.lang-toggle')).toBeInTheDocument()
    expect(document.querySelector('.theme-toggle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /more actions/i })).toBeInTheDocument()
  })
})

// NOTE: the "closed popover must stay hidden" invariant is NOT covered here.
// vitest stubs CSS imports to '', so a stylesheet assertion passes vacuously,
// and reading the file with node:fs doesn't typecheck (node types are scoped to
// tsconfig.node.json on purpose — src is browser code). The invariant is
// documented at the `.app-header-menu:not([popover])` rule in layout.css: never
// declare `display` on that class unconditionally, because an author `display`
// overrides the UA's `[popover]:not(:popover-open) { display: none }` and the
// closed panel then sits inline on top of the header title.
